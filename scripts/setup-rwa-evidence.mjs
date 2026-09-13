import { readFileSync, existsSync } from 'node:fs';
import { Contract, Interface, JsonRpcProvider, VoidSigner, Wallet, dnsEncode, formatEther, keccak256, toUtf8Bytes } from 'ethers';
import { DEMO_ASSETS } from '../components/app/demo-data.ts';
import { ENSV2_SEPOLIA } from '../lib/ensv2-config.ts';
import { SET_TEXT, assertSigningOptIn, evidenceAuthorities } from '../lib/ens-permission-policy.ts';
import { PERMISSION_ABI, verifyAssetPermissions } from '../lib/ens-permissions.ts';

const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');
const REGISTRY_ABI = [
  'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns(uint256)',
  'function getStatus(uint256 anyId) view returns(uint8)',
  'function findTokenId(string label) view returns(uint256)',
  'function ownerOf(uint256 tokenId) view returns(address)',
];
const ABI = [...PERMISSION_ABI, 'function multicall(bytes[] calls) returns(bytes[] results)'];
const META_KEYS = ['verdict.subject', 'verdict.schema'];
const ZERO = '0x0000000000000000000000000000000000000000';
const catalog = DEMO_ASSETS.filter((asset) => asset.name.endsWith('.rwa.verdict.eth'));

function envFile() {
  if (!existsSync('.env.local')) return {};
  return Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
}

// Only --apply --allow-keystore-signing can load signing custody.
async function signer(name, expected, provider) {
  assertSigningOptIn(APPLY, process.argv.includes('--allow-keystore-signing'));
  const wallet = (await Wallet.fromEncryptedJson(readFileSync(`.secrets/${name}`, 'utf8'),
    readFileSync(`.secrets/${name}.password`, 'utf8').trim())).connect(provider);
  if (wallet.address.toLowerCase() !== expected.toLowerCase()) throw new Error(`Wrong signer for ${name}`);
  return wallet;
}

async function confirmed(txPromise, label) {
  const tx = await txPromise;
  console.log(JSON.stringify({ action: label, hash: tx.hash }));
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction failed: ${tx.hash}`);
}

async function main() {
  if (APPLY) assertSigningOptIn(APPLY, process.argv.includes('--allow-keystore-signing'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL || envFile().SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is required');
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    if (Number((await provider.getNetwork()).chainId) !== ENSV2_SEPOLIA.chainId) throw new Error('RPC must be Ethereum Sepolia');
    if (VERIFY) {
      let failed = 0;
      for (const asset of catalog) {
        const proof = await verifyAssetPermissions(provider, asset.name);
        console.log(JSON.stringify(proof));
        if (!proof.verified) failed += 1;
      }
      if (failed) throw new Error(`${failed} assets have incomplete evidence/permission setup.`);
      return;
    }
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 180 * 86400);
    const iface = new Interface(ABI);
    const plans = [];
    // Read-only preflight: validate every existing grant and every planned registration.
    for (const role of ['auditor', 'monitor']) {
      const entries = catalog.map((asset) => ({ asset, authority: evidenceAuthorities(asset.name)[role] }));
      const a = entries[0].authority;
      const resolver = new Contract(a.resolver, ABI, provider);
      const registry = new Contract(a.registry, REGISTRY_ABI, new VoidSigner(a.worker, provider));
      const proof = await verifyAssetPermissions(provider, entries[0].asset.name);
      const checks = proof.authorities[role].checks;
      const required = ['allKeysAllowed', 'noRootText', 'noRootTextAdmin', 'noUpgrade', 'noUpgradeAdmin', 'allowedWriteVerified', 'unrelatedWriteBlocked', 'issuerWriteBlocked', 'crossWorkerWriteBlocked', 'workerGrantBlocked', 'recoveryAdminVerified'];
      if (required.some((key) => !checks[key])) throw new Error(`${role} worker isolation checks failed; do not register evidence names.`);
      const register = [];
      for (const entry of entries) {
        const label = entry.authority.name.split('.')[0];
        const status = Number(await registry.getStatus(BigInt(keccak256(toUtf8Bytes(label)))));
        if (status === 0) {
          const args = [label, a.admin, ZERO, a.resolver, 0n, expiry];
          await registry.register.staticCall(...args);
          const gas = await registry.register.estimateGas(...args);
          register.push({ name: entry.authority.name, args, gas });
        } else if (status === 2) {
          const owner = await registry.ownerOf(await registry.findTokenId(label));
          if (owner.toLowerCase() !== a.admin.toLowerCase()) throw new Error(`Existing ${entry.authority.name} has an unexpected owner; refusing overwrite.`);
        } else throw new Error(`Existing ${entry.authority.name} is not active/available; manual review required.`);
      }
      const grants = [];
      for (const key of META_KEYS) {
        const setter = iface.encodeFunctionData('setText', [dnsEncode(a.name), key, '']);
        const [, resource] = await resolver.decodeSetter(setter);
        if (!await resolver.hasRoles(resource, SET_TEXT, a.admin)) grants.push(iface.encodeFunctionData('grantSetterRoles', [setter, a.admin]));
      }
      if (grants.length) await provider.call({ from: a.admin, to: a.resolver, data: iface.encodeFunctionData('multicall', [grants]) });
      const metadata = entries.flatMap(({ asset, authority }) => [
        iface.encodeFunctionData('setText', [dnsEncode(authority.name), 'verdict.subject', asset.name]),
        iface.encodeFunctionData('setText', [dnsEncode(authority.name), 'verdict.schema', role === 'auditor' ? 'attestation/1' : 'observation/1']),
      ]);
      const fees = await provider.getFeeData();
      const feeCap = fees.maxFeePerGas || fees.gasPrice;
      if (!feeCap) throw new Error('Cannot determine Sepolia transaction fee cap');
      const workerBudget = register.reduce((sum, item) => sum + item.gas * 12n / 10n, 0n) * feeCap;
      // Conservative budget for the 40-record metadata multicall and grants; not a fee quote.
      const adminBudget = 3_000_000n * feeCap;
      const workerBalance = await provider.getBalance(a.worker);
      const adminBalance = await provider.getBalance(a.admin);
      console.log(JSON.stringify({ mode: APPLY ? 'apply-preflight' : 'read-only-plan', role,
        registerNames: register.map((entry) => entry.name), owner: a.admin, resolver: a.resolver,
        worker: a.worker, workerBalanceETH: formatEther(workerBalance), registrationBudgetETH: formatEther(workerBudget),
        admin: a.admin, adminBalanceETH: formatEther(adminBalance), conservativeAdminBudgetETH: formatEther(adminBudget),
        metadata: 'Publish subject/schema only; no fabricated attestation or reserve results.',
        authority: 'Resolver grants are key-scoped. Registry/.eth owners retain redirection powers; all keys are team-operated.' }));
      if (APPLY && (workerBalance < workerBudget || adminBalance < adminBudget)) throw new Error(`${role} signer needs Sepolia ETH for the displayed budget; no transfers are performed by this script.`);
      plans.push({ role, a, register, grants, metadata });
    }
    if (!APPLY) { console.log('No transactions sent or keystores loaded. Review before --apply --allow-keystore-signing.'); return; }
    for (const plan of plans) {
      const worker = await signer(plan.role === 'auditor' ? 'verdict-auditor' : 'verdict-monitor', plan.a.worker, provider);
      const admin = await signer(plan.role === 'auditor' ? 'verdict-auditor-admin' : 'verdict-monitor-admin', plan.a.admin, provider);
      const registry = new Contract(plan.a.registry, REGISTRY_ABI, worker);
      for (const entry of plan.register) await confirmed(registry.register(...entry.args), `register-${entry.name}`);
      const resolver = new Contract(plan.a.resolver, ABI, admin);
      if (plan.grants.length) await confirmed(resolver.multicall(plan.grants), `${plan.role}-metadata-role-grants`);
      await resolver.multicall.staticCall(plan.metadata);
      await confirmed(resolver.multicall(plan.metadata), `${plan.role}-subjects-and-schemas`);
    }
    for (const asset of catalog) {
      const proof = await verifyAssetPermissions(provider, asset.name);
      console.log(JSON.stringify(proof));
      if (!proof.verified) throw new Error(`Post-setup verification failed: ${asset.name}`);
    }
  } finally { provider.destroy(); }
}

main().catch((error) => {
  console.error(error instanceof Error && !('code' in error) ? error.message : 'RWA evidence setup/verification failed. Review the public preflight output and signer funding; no secret values are logged.');
  process.exitCode = 1;
});

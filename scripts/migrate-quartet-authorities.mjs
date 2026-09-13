import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Contract, Interface, JsonRpcProvider, Wallet, dnsEncode, formatEther, getAddress, isError, keccak256, parseEther, toUtf8Bytes } from 'ethers';
import { ENSV2_SEPOLIA as ENS } from '../lib/ensv2-config.ts';
import { SET_TEXT, SET_TEXT_ADMIN, UPGRADE, assertSigningOptIn } from '../lib/ens-permission-policy.ts';
import { QUARTET_ROLES, QUARTET_REPORT_KEYS, QUARTET_METADATA_KEYS, QUARTET_DISCLOSURE } from '../lib/quartet-authority-policy.ts';
import { PERMISSION_ABI } from '../lib/ens-permissions.ts';

const APPLY = process.argv.includes('--apply');
const CREATE = process.argv.includes('--create-workers');
const STATE = '.secrets/quartet-migration.json';
const CAP = parseEther('0.02');
const IMPL = '0xa9d3814ab151bf6e37a427432795371a8361614e';
const RESOLVER_ABI = [...PERMISSION_ABI,
  'function initialize((address account,uint256 roleBitmap)[] grants,bytes[] calls)',
  'function multicall(bytes[] calls) returns(bytes[])'];
const FACTORY_ABI = ['function deployProxy(address implementation,uint256 salt,bytes data) returns(address proxy)',
  'function verifyContract(address proxy) view returns(address implementation)'];
const REGISTRY_ABI = ['function getResolver(string label) view returns(address)',
  'function getStatus(uint256 anyId) view returns(uint8)', 'function findOwner(string label) view returns(address)',
  'function setResolver(uint256 anyId,address resolver)'];
const iface = new Interface(RESOLVER_ABI);
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { spentWei: '0', roles: {}, transactions: [] };
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
function env() {
  return Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
}
async function wallet(name, expected, provider) {
  assertSigningOptIn(APPLY, process.argv.includes('--allow-keystore-signing'));
  const signer = (await Wallet.fromEncryptedJson(readFileSync(`.secrets/${name}`, 'utf8'), readFileSync(`.secrets/${name}.password`, 'utf8').trim())).connect(provider);
  if (!same(signer.address, expected)) throw new Error(`Wrong encrypted signer: ${name}`);
  return signer;
}
function address(name) { return getAddress(`0x${JSON.parse(readFileSync(`.secrets/${name}`, 'utf8')).address.replace(/^0x/, '')}`); }
async function blocked(provider, from, to, data) {
  try { await provider.call({ from, to, data }); return false; }
  catch (error) { if (isError(error, 'CALL_EXCEPTION')) return true; throw error; }
}
async function verify(provider, role, authorities) {
  const a = authorities[role];
  const contract = new Contract(a.resolver, RESOLVER_ABI, provider);
  const checks = {};
  for (const key of QUARTET_REPORT_KEYS) {
    const setter = iface.encodeFunctionData('setText', [dnsEncode(a.name), key, 'permission-preflight']);
    const [, resource] = await contract.decodeSetter(setter);
    checks[key] = await contract.hasRoles(resource, SET_TEXT, a.worker);
    if (await blocked(provider, a.worker, a.resolver, setter)) throw new Error(`${role}: allowed report write rejected`);
    for (const other of [ENS.actors.namespaceOperator, ...QUARTET_ROLES.filter((r) => r !== role).map((r) => authorities[r].worker)]) {
      if (!await blocked(provider, other, a.resolver, setter)) throw new Error(`${role}: issuer/cross-worker write not isolated`);
    }
  }
  for (const bit of [SET_TEXT, SET_TEXT_ADMIN, UPGRADE, UPGRADE << 128n, 1n << 28n, 1n << 156n]) {
    if (await contract.hasRootRoles(bit, a.worker)) throw new Error(`${role}: dangerous worker root permission`);
  }
  const unrelated = iface.encodeFunctionData('setText', [dnsEncode(a.name), 'verdict.unrelated.probe', 'permission-preflight']);
  if (!await blocked(provider, a.worker, a.resolver, unrelated)) throw new Error(`${role}: arbitrary key write not blocked`);
  const grant = iface.encodeFunctionData('grantSetterRoles', [unrelated, a.worker]);
  if (!await blocked(provider, a.worker, a.resolver, grant)) throw new Error(`${role}: worker can escalate permissions`);
  if (Object.values(checks).some((value) => !value)) throw new Error(`${role}: missing scoped grants`);
  return { verified: true, reportKeys: QUARTET_REPORT_KEYS, scope: 'text-key across this resolver instance', issuerAndCrossWorkerWritesBlocked: true,
    workerRootWriteAdminUpgradeLinkAbsent: true, arbitraryKeyBlocked: true, workerGrantBlocked: true };
}
async function main() {
  if (APPLY || CREATE) assertSigningOptIn(APPLY, process.argv.includes('--allow-keystore-signing'));
  if (CREATE) {
    // Runtime-generated encrypted custody artifacts, never raw key output.
    execFileSync('git', ['check-ignore', '.secrets/verdict-technical', '.secrets/verdict-consensus']);
    mkdirSync('.secrets', { recursive: true, mode: 0o700 });
    for (const role of ['technical', 'consensus']) {
      const path = `.secrets/verdict-${role}`;
      if (existsSync(path)) { if (!existsSync(`${path}.password`)) throw new Error(`${role}: existing keystore missing password file`); continue; }
      if (existsSync(`${path}.password`)) throw new Error(`${role}: orphan password file; manual recovery required`);
      const password = randomBytes(32).toString('base64url');
      const worker = Wallet.createRandom();
      const encrypted = await worker.encrypt(password);
      writeFileSync(`${path}.password`, password, { mode: 0o600, flag: 'wx' });
      writeFileSync(path, encrypted, { mode: 0o600, flag: 'wx' });
      console.log(JSON.stringify({ createdEncryptedWorker: role, address: worker.address }));
    }
  }
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || env().SEPOLIA_RPC_URL);
  try {
    if (Number((await provider.getNetwork()).chainId) !== ENS.chainId) throw new Error('RPC must be Sepolia');
    const authorities = {
      legal: { name: ENS.names.agents.legal, resolver: ENS.proxies.auditorResolver, worker: ENS.actors.auditorWorker, admin: ENS.actors.auditorAdmin },
      custody: { name: ENS.names.agents.custody, resolver: ENS.proxies.monitorResolver, worker: ENS.actors.monitorWorker, admin: ENS.actors.monitorAdmin },
      technical: { name: ENS.names.agents.technical, resolver: state.roles.technical?.resolver, worker: address('verdict-technical'), admin: ENS.actors.auditorAdmin },
      consensus: { name: ENS.names.agents.consensus, resolver: state.roles.consensus?.resolver, worker: address('verdict-consensus'), admin: ENS.actors.monitorAdmin },
    };
    const registry = new Contract(ENS.proxies.agentRegistry, REGISTRY_ABI, provider);
    for (const role of QUARTET_ROLES) {
      if (Number(await registry.getStatus(BigInt(keccak256(toUtf8Bytes(role))))) !== 2 || !same(await registry.findOwner(role), ENS.actors.namespaceOperator)) {
        throw new Error(`${role}: inactive name or unexpected owner; refusing migration`);
      }
      const current = await registry.getResolver(role);
      if (!same(current, ENS.proxies.namespaceResolver) && !(authorities[role].resolver && same(current, authorities[role].resolver))) {
        throw new Error(`${role}: unexpected existing resolver; refusing overwrite`);
      }
    }
    console.log(JSON.stringify({ mode: APPLY ? 'apply-preflight' : 'read-only', gasCapETH: formatEther(CAP), spentETH: formatEther(BigInt(state.spentWei)), authorities, disclosure: QUARTET_DISCLOSURE }));
    if (!APPLY) return;
    const namespace = await wallet('verdict-sepolia-agent', ENS.actors.namespaceOperator, provider);
    async function send(signer, to, data, action) {
      const request = { from: signer.address, to, data, value: 0n };
      await provider.call(request);
      const gasLimit = (await provider.estimateGas(request)) * 12n / 10n;
      const fees = await provider.getFeeData();
      if (!fees.maxFeePerGas || fees.maxPriorityFeePerGas === null) throw new Error('EIP1559 fee data unavailable');
      const maximumCost = gasLimit * fees.maxFeePerGas;
      if (BigInt(state.spentWei) + maximumCost > CAP) throw new Error('Migration gas cap reached; no further transactions sent');
      if ((await provider.getBalance(signer.address)) < maximumCost) throw new Error(`Funding needed: ${signer.address}`);
      const tx = await signer.sendTransaction({ to, data, value: 0n, gasLimit, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
      // Reserve the worst case before waiting, so a restart cannot forget a pending spend.
      state.spentWei = (BigInt(state.spentWei) + maximumCost).toString();
      state.pending = { hash: tx.hash, action, maximumCost: maximumCost.toString() }; save();
      console.log(JSON.stringify({ action, hash: tx.hash }));
      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Missing transaction receipt; reconcile pending transaction before retry');
      state.spentWei = (BigInt(state.spentWei) - maximumCost + receipt.fee).toString();
      state.transactions.push({ action, hash: tx.hash, block: receipt.blockNumber, feeWei: receipt.fee.toString(), status: receipt.status });
      delete state.pending; save();
      if (receipt.status !== 1) throw new Error(`Migration transaction reverted: ${tx.hash}`);
    }
    if (state.pending) throw new Error('Pending migration transaction requires explicit receipt reconciliation before retry');
    const factory = new Contract(ENS.contracts.factory, FACTORY_ABI, provider);
    for (const role of ['technical', 'consensus']) {
      const a = authorities[role];
      // Initializer bypass applies to record setters, not EAC grant authorization.
      // Grant worker keys afterwards through the recovery admin, never via deployer.
      const calls = [];
      const metadata = { 'verdict.schema': 'agent-report/1', 'verdict.agent.role': role, 'verdict.agent.worker': a.worker, 'verdict.agent.publicationMode': 'offchain-ai-dedicated-worker' };
      calls.push(...Object.entries(metadata).map(([key, value]) => iface.encodeFunctionData('setText', [dnsEncode(a.name), key, value])));
      const init = iface.encodeFunctionData('initialize', [[[a.admin, SET_TEXT_ADMIN | UPGRADE | (UPGRADE << 128n)]], calls]);
      const salt = BigInt(keccak256(toUtf8Bytes(`Verdict:quartet:${role}:scoped-v1`)));
      if (!a.resolver) {
        // Static deployment checks initializer grants before paying for deployment.
        a.resolver = getAddress(await factory.connect(namespace).deployProxy.staticCall(IMPL, salt, init));
        if ((await provider.getCode(a.resolver)) !== '0x') throw new Error(`${role}: unknown pre-existing deterministic deployment`);
        state.roles[role] = { resolver: a.resolver, worker: a.worker, admin: a.admin }; save();
      }
      if ((await provider.getCode(a.resolver)) === '0x') {
        await send(namespace, ENS.contracts.factory, factory.interface.encodeFunctionData('deployProxy', [IMPL, salt, init]), `deploy-${role}-resolver`);
      }
      if (!same(await factory.verifyContract(a.resolver), IMPL)) throw new Error(`${role}: factory implementation verification failed`);
    }
    // Existing workers receive ONLY additional report-key rights, not broad root writes.
    for (const role of QUARTET_ROLES) {
      const a = authorities[role];
      const admin = await wallet(role === 'legal' || role === 'technical' ? 'verdict-auditor-admin' : 'verdict-monitor-admin', a.admin, provider);
      const resolver = new Contract(a.resolver, RESOLVER_ABI, provider);
      const calls = [];
      for (const [account, keys] of [[a.worker, QUARTET_REPORT_KEYS], [a.admin, QUARTET_METADATA_KEYS]]) {
        for (const key of keys) {
          const setter = iface.encodeFunctionData('setText', [dnsEncode(a.name), key, '']);
          const [, resource] = await resolver.decodeSetter(setter);
          if (!await resolver.hasRoles(resource, SET_TEXT, account)) calls.push(iface.encodeFunctionData('grantSetterRoles', [setter, account]));
        }
      }
      const metadata = { 'verdict.schema': 'agent-report/1', 'verdict.agent.role': role, 'verdict.agent.worker': a.worker, 'verdict.agent.publicationMode': 'offchain-ai-dedicated-worker' };
      calls.push(...Object.entries(metadata).map(([key, value]) => iface.encodeFunctionData('setText', [dnsEncode(a.name), key, value])));
      await send(admin, a.resolver, iface.encodeFunctionData('multicall', [calls]), `${role}-scoped-report-grants-and-metadata`);
    }
    // Verify isolation first; only then change the four resolver pointers.
    const proofs = {};
    for (const role of QUARTET_ROLES) proofs[role] = await verify(provider, role, authorities);
    for (const role of QUARTET_ROLES) {
      if (!same(await registry.getResolver(role), authorities[role].resolver)) {
        await send(namespace, ENS.proxies.agentRegistry, registry.interface.encodeFunctionData('setResolver', [BigInt(keccak256(toUtf8Bytes(role))), authorities[role].resolver]), `point-${role}-identity`);
      }
    }
    for (const role of QUARTET_ROLES) {
      if (!same(await registry.getResolver(role), authorities[role].resolver)) throw new Error(`${role}: resolver pointer readback failed`);
      proofs[role] = await verify(provider, role, authorities);
    }
    const artifact = { chainId: ENS.chainId, block: await provider.getBlockNumber(), authorities, proofs,
      disclosure: QUARTET_DISCLOSURE, spentETH: formatEther(BigInt(state.spentWei)), transactions: state.transactions,
      publicationStatus: 'Permissions provisioned; no evaluations fabricated or published by migration.' };
    writeFileSync('public/data/quartet-authority-setup.json', JSON.stringify(artifact, null, 2));
    console.log(JSON.stringify(artifact));
    for (const role of ['technical', 'consensus']) console.log(JSON.stringify({ worker: role, address: authorities[role].worker, balanceETH: formatEther(await provider.getBalance(authorities[role].worker)) }));
  } finally { provider.destroy(); }
}
main().catch((error) => {
  if (isError(error, 'CALL_EXCEPTION')) console.error(JSON.stringify({ code: error.code, reason: error.reason, revertName: error.revert?.name, revertData: error.data }));
  console.error(error instanceof Error && !('code' in error) ? error.message : 'Quartet migration failed. Review public transaction hashes/state before retrying; secrets are never logged.');
  process.exitCode = 1;
});

import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  dnsEncode,
  hexlify,
  randomBytes,
} from 'ethers';

const ROOT = process.cwd();
const CHAIN_ID = 11155111;
const ALL_ROLES = BigInt(`0x${'1'.repeat(64)}`);
const ROLE_SET_TEXT = 1n << 4n;
const ROLE_SET_TEXT_ADMIN = ROLE_SET_TEXT << 128n;
const ROLE_UPGRADE = 1n << 124n;
const ROLE_UPGRADE_ADMIN = ROLE_UPGRADE << 128n;
const ADMIN_ROOT_ROLES = ROLE_SET_TEXT_ADMIN | ROLE_UPGRADE | ROLE_UPGRADE_ADMIN;
const RESOLVER_ABI = [
  'function setText(bytes name,string key,string value)',
  'function grantSetterRoles(bytes setter,address account) returns (bool)',
  'function grantRootRoles(uint256 roleBitmap,address account) returns (bool)',
  'function revokeRootRoles(uint256 roleBitmap,address account) returns (bool)',
  'function decodeSetter(bytes setter) pure returns (bytes arg,uint256 resource,uint256 roleBitmap)',
  'function roles(uint256 resource,address account) view returns (uint256)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)',
];
const TARGETS = [
  {
    id: 'auditor',
    resolver: '0x1C6e26A8f56C8B6C9286Fe217851c1FC9e7dA6e6',
    name: 'audit-001.verdict-auditor.eth',
    workerKey: 'verdict-auditor',
    adminKey: 'verdict-auditor-admin',
    keys: [
      'verdict.attestation.documentHash',
      'verdict.attestation.issuedAt',
      'verdict.attestation.expiresAt',
      'verdict.attestation.status',
      'verdict.attestation.ai.model',
      'verdict.attestation.ai.confidence',
      'verdict.attestation.ai.rationale',
      'verdict.attestation.ai.sourceHash',
    ],
  },
  {
    id: 'monitor',
    resolver: '0x6592566d7185bbf811D2508683e4a545297A7C13',
    name: 'risk-001.verdict-monitor.eth',
    workerKey: 'verdict-monitor',
    adminKey: 'verdict-monitor-admin',
    keys: [
      'verdict.observation.observedAt',
      'verdict.observation.severity',
      'verdict.observation.reasonCode',
      'verdict.observation.status',
      'verdict.observation.ai.model',
      'verdict.observation.ai.confidence',
      'verdict.observation.ai.rationale',
      'verdict.observation.ai.sourceHash',
    ],
  },
];

function loadEnv(path) {
  const output = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at > 0) output[line.slice(0, at)] = line.slice(at + 1).replace(/^['"]|['"]$/g, '');
  }
  return output;
}

async function loadWallet(name, provider) {
  const encrypted = readFileSync(join(ROOT, '.secrets', name), 'utf8');
  const password = readFileSync(join(ROOT, '.secrets', `${name}.password`), 'utf8').trim();
  return (await Wallet.fromEncryptedJson(encrypted, password)).connect(provider);
}

async function ensureAdminWallet(name, provider) {
  const keyPath = join(ROOT, '.secrets', name);
  const passwordPath = `${keyPath}.password`;
  if (!existsSync(keyPath)) {
    const wallet = Wallet.createRandom();
    const password = hexlify(randomBytes(32));
    const encrypted = await wallet.encrypt(password);
    writeFileSync(keyPath, encrypted, { mode: 0o600 });
    writeFileSync(passwordPath, `${password}\n`, { mode: 0o600 });
    chmodSync(keyPath, 0o600);
    chmodSync(passwordPath, 0o600);
  }
  return loadWallet(name, provider);
}

async function confirm(txPromise, label) {
  const tx = await txPromise;
  console.log(`${label}: submitted ${tx.hash}`);
  const receipt = await tx.wait(1);
  if (receipt.status !== 1) throw new Error(`${label} reverted: ${tx.hash}`);
  console.log(`${label}: confirmed in block ${receipt.blockNumber}`);
  return tx.hash;
}

async function configure(target, provider) {
  const worker = await loadWallet(target.workerKey, provider);
  const admin = await ensureAdminWallet(target.adminKey, provider);
  const resolver = new Contract(target.resolver, RESOLVER_ABI, worker);
  const adminResolver = resolver.connect(admin);
  const iface = new Interface(RESOLVER_ABI);
  const transactions = [];

  if (!(await resolver.hasRootRoles(ADMIN_ROOT_ROLES, admin.address))) {
    transactions.push(await confirm(
      resolver.grantRootRoles(ADMIN_ROOT_ROLES, admin.address),
      `${target.id}-grant-admin-recovery`,
    ));
  }

  // During the initial migration the funded worker can grant its own scoped
  // roles. If broad access was already removed, use the recovery admin.
  const grantSigner = await resolver.hasRootRoles(ROLE_SET_TEXT_ADMIN, worker.address)
    ? resolver
    : adminResolver;
  for (const key of target.keys) {
    const setter = iface.encodeFunctionData('setText', [dnsEncode(target.name), key, '']);
    const [, resource, role] = await resolver.decodeSetter(setter);
    if (role !== ROLE_SET_TEXT) throw new Error(`Unexpected role decoded for ${key}`);
    const directRoles = await resolver.roles(resource, worker.address);
    if ((directRoles & ROLE_SET_TEXT) !== ROLE_SET_TEXT) {
      transactions.push(await confirm(
        grantSigner.grantSetterRoles(setter, worker.address),
        `${target.id}-grant-${key}`,
      ));
    }
  }

  if (await resolver.hasRootRoles(ALL_ROLES, worker.address)) {
    transactions.push(await confirm(
      resolver.revokeRootRoles(ALL_ROLES, worker.address),
      `${target.id}-revoke-worker-root`,
    ));
  }

  const checks = [];
  for (const key of target.keys) {
    const setter = iface.encodeFunctionData('setText', [dnsEncode(target.name), key, '']);
    const [, resource] = await resolver.decodeSetter(setter);
    checks.push(await resolver.hasRoles(resource, ROLE_SET_TEXT, worker.address));
  }
  if (checks.some((allowed) => !allowed)) throw new Error(`${target.id} is missing an allowed key role`);
  if (await resolver.hasRootRoles(ROLE_SET_TEXT, worker.address)) throw new Error(`${target.id} still has root text write`);
  if (await resolver.hasRootRoles(ROLE_UPGRADE, worker.address)) throw new Error(`${target.id} still has resolver upgrade role`);

  await resolver.setText.staticCall(dnsEncode(target.name), target.keys[0], 'permission-test');
  let unauthorizedBlocked = false;
  try {
    await resolver.setText.staticCall(dnsEncode(target.name), 'verdict.unauthorized.probe', 'must-revert');
  } catch {
    unauthorizedBlocked = true;
  }
  if (!unauthorizedBlocked) throw new Error(`${target.id} can still write an unauthorized key`);

  const probeSetter = iface.encodeFunctionData('setText', [dnsEncode(target.name), target.keys[0], '']);
  await adminResolver.grantSetterRoles.staticCall(probeSetter, worker.address);
  return {
    resolver: target.resolver,
    worker: worker.address,
    admin: admin.address,
    allowedKeys: target.keys,
    broadTextWriteRevoked: true,
    upgradeRoleRevokedFromWorker: true,
    unauthorizedWriteBlocked: true,
    adminRecoveryVerified: true,
    transactions,
  };
}

async function main() {
  const env = loadEnv(join(ROOT, '.env.local'));
  if (!env.SEPOLIA_RPC_URL) throw new Error('SEPOLIA_RPC_URL is missing from .env.local');
  const provider = new JsonRpcProvider(env.SEPOLIA_RPC_URL, CHAIN_ID, { staticNetwork: true });
  if (Number((await provider.getNetwork()).chainId) !== CHAIN_ID) throw new Error('RPC is not Sepolia');
  const results = {};
  for (const target of TARGETS) results[target.id] = await configure(target, provider);
  const output = { chainId: CHAIN_ID, configuredAt: new Date().toISOString(), results };
  const path = join(ROOT, '.secrets', 'ensv2-permissions.json');
  writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

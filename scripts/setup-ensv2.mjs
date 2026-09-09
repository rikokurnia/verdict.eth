import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import {
  AbiCoder,
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  dnsEncode,
  getAddress,
  keccak256,
  namehash,
  randomBytes,
  toUtf8Bytes,
} from 'ethers';

const ROOT = process.cwd();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const YEAR = 31_536_000n;
const SUBNAME_LIFETIME = 180n * 86_400n;
const ALL_ROLES = BigInt(`0x${'1'.repeat(64)}`);

const ADDRESSES = {
  universalResolver: '0xd26f2040d083af1cd2962ba303f4bea0c4faf142',
  ethRegistrar: '0x7d1b7f586a62ac3f54b9a396849757814283270b',
  ethRegistry: '0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e',
  factory: '0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780',
  resolverImplementation: '0xa9d3814ab151bf6e37a427432795371a8361614e',
  registryImplementation: '0x47b442d0cf617c41cabaff5f02f44dd1e5f72546',
  mockUsdc: '0xcbfd80f74375c54e545af34788ff465f96f66f05',
};

const ABIS = {
  factory: [
    'function deployProxy(address implementation,uint256 salt,bytes data) returns (address proxy)',
    'function verifyContract(address proxy) view returns (address implementation)',
    'event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)',
  ],
  registrar: [
    'function isAvailable(string label) view returns (bool)',
    'function makeCommitment(string label,address owner,bytes32 secret,address subregistry,address resolver,uint64 duration,bytes32 referrer) pure returns (bytes32)',
    'function commitmentAt(bytes32 commitment) view returns (uint256)',
    'function commit(bytes32 commitment)',
    'function register(string label,address owner,bytes32 secret,address subregistry,address resolver,uint64 duration,address paymentToken,bytes32 referrer) returns (uint256)',
    'function getRegisterPrice(string label,uint64 duration,address paymentToken) view returns (uint256 base,uint256 premium)',
    'function MIN_COMMITMENT_AGE() view returns (uint256)',
  ],
  erc20: [
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner,address spender) view returns (uint256)',
    'function approve(address spender,uint256 amount) returns (bool)',
  ],
  registry: [
    'function initialize((address account,uint256 roleBitmap)[] grants)',
    'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
    'function getStatus(uint256 anyId) view returns (uint8)',
    'function setParent(address parent,string label)',
    'function getParent() view returns (address parent,string label)',
    'function roleCount(uint256 anyId) view returns (uint256)',
  ],
  resolver: [
    'function initialize((address account,uint256 roleBitmap)[] grants,bytes[] calls)',
    'function setText(bytes name,string key,string value)',
    'function resolve(bytes name,bytes data) view returns (bytes result)',
    'function multicall(bytes[] calls) returns (bytes[] results)',
  ],
  universalResolver: [
    'function resolve(bytes name,bytes data) view returns (bytes result,address resolver)',
    'function findResolver(bytes name) view returns (address resolver,bytes32 node,uint256 offset)',
  ],
};

const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];

function loadEnv(path) {
  const output = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at > 0) output[line.slice(0, at)] = line.slice(at + 1);
  }
  return output;
}

async function loadWallet(name, provider) {
  const encrypted = readFileSync(join(ROOT, '.secrets', name), 'utf8');
  const password = readFileSync(join(ROOT, '.secrets', `${name}.password`), 'utf8').trim();
  return (await Wallet.fromEncryptedJson(encrypted, password)).connect(provider);
}

function loadState() {
  try {
    return JSON.parse(readFileSync(join(ROOT, '.secrets', 'ensv2-state.json'), 'utf8'));
  } catch {
    return { registrations: {}, proxies: {}, txs: {} };
  }
}

function saveState(state) {
  const path = join(ROOT, '.secrets', 'ensv2-state.json');
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

async function confirmed(txPromise, label, state) {
  const tx = await txPromise;
  console.log(`${label}: submitted ${tx.hash}`);
  const receipt = await tx.wait(1);
  if (receipt.status !== 1) throw new Error(`${label} reverted: ${tx.hash}`);
  state.txs[label] = tx.hash;
  saveState(state);
  console.log(`${label}: confirmed in block ${receipt.blockNumber}`);
  return receipt;
}

function resolverSalt(owner) {
  const coder = AbiCoder.defaultAbiCoder();
  return BigInt(
    keccak256(
      coder.encode(
        ['bytes32', 'address', 'uint256'],
        [keccak256(toUtf8Bytes('OwnedResolver')), owner, 0n],
      ),
    ),
  );
}

function registrySalt(fullName) {
  const coder = AbiCoder.defaultAbiCoder();
  return BigInt(
    keccak256(
      coder.encode(
        ['bytes32', 'bytes32', 'uint256'],
        [keccak256(toUtf8Bytes('UserRegistry')), namehash(fullName), 0n],
      ),
    ),
  );
}

async function ensureProxy({ key, wallet, implementation, salt, initData, state }) {
  if (state.proxies[key]) {
    const code = await wallet.provider.getCode(state.proxies[key]);
    if (code !== '0x') return state.proxies[key];
  }

  const factory = new Contract(ADDRESSES.factory, ABIS.factory, wallet);
  const receipt = await confirmed(factory.deployProxy(implementation, salt, initData), `deploy-${key}`, state);
  let deployed;
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === 'ProxyDeployed') deployed = parsed.args.proxyAddress;
    } catch {
      // Ignore logs emitted by the proxy initializer.
    }
  }
  if (!deployed) throw new Error(`${key} deployment did not emit ProxyDeployed`);
  const verifiedImplementation = await factory.verifyContract(deployed);
  if (verifiedImplementation.toLowerCase() !== implementation.toLowerCase()) {
    throw new Error(`${key} proxy failed factory verification`);
  }
  state.proxies[key] = getAddress(deployed);
  saveState(state);
  return state.proxies[key];
}

async function ensureRootRegistration({ label, owner, resolver, subregistry, payer, state }) {
  const registrar = new Contract(ADDRESSES.ethRegistrar, ABIS.registrar, payer);
  if (!(await registrar.isAvailable(label))) return;

  let entry = state.registrations[label];
  if (!entry) {
    entry = {
      secret: `0x${Buffer.from(randomBytes(32)).toString('hex')}`,
      owner,
      resolver,
      subregistry,
      duration: YEAR.toString(),
    };
    state.registrations[label] = entry;
    saveState(state);
  }

  const commitment = await registrar.makeCommitment(
    label,
    owner,
    entry.secret,
    subregistry,
    resolver,
    YEAR,
    ZERO_HASH,
  );
  const committedAt = await registrar.commitmentAt(commitment);
  if (committedAt === 0n) {
    await confirmed(registrar.commit(commitment), `commit-${label}`, state);
  }
}

async function revealRootRegistration({ label, owner, resolver, subregistry, payer, state }) {
  const registrar = new Contract(ADDRESSES.ethRegistrar, ABIS.registrar, payer);
  if (!(await registrar.isAvailable(label))) return;
  const entry = state.registrations[label];
  await confirmed(
    registrar.register(
      label,
      owner,
      entry.secret,
      subregistry,
      resolver,
      YEAR,
      ADDRESSES.mockUsdc,
      ZERO_HASH,
    ),
    `register-${label}`,
    state,
  );
}

async function ensureParent(registryAddress, wallet, parentAddress, label, state) {
  const registry = new Contract(registryAddress, ABIS.registry, wallet);
  const [currentParent, currentLabel] = await registry.getParent();
  if (currentParent.toLowerCase() === parentAddress.toLowerCase() && currentLabel === label) return;
  await confirmed(registry.setParent(parentAddress, label), `parent-${label}`, state);
}

async function ensureSubname({ registryAddress, wallet, label, owner, resolver, subregistry = ZERO_ADDRESS, expiry, state }) {
  const registry = new Contract(registryAddress, ABIS.registry, wallet);
  const id = BigInt(keccak256(toUtf8Bytes(label)));
  if (Number(await registry.getStatus(id)) === 2) return;
  await confirmed(
    registry.register(label, owner, subregistry, resolver, ALL_ROLES, expiry),
    `subname-${label}-${registryAddress.slice(2, 8)}`,
    state,
  );
}

async function setTextRecords(resolverAddress, wallet, fullName, records, state) {
  const resolver = new Contract(resolverAddress, ABIS.resolver, wallet);
  const iface = new Interface(ABIS.resolver);
  const textIface = new Interface(TEXT_ABI);
  const encodedName = dnsEncode(fullName);
  const calls = [];
  for (const [key, value] of Object.entries(records)) {
    const query = textIface.encodeFunctionData('text', [namehash(fullName), key]);
    const currentResult = await resolver.resolve(encodedName, query);
    const [currentValue] = textIface.decodeFunctionResult('text', currentResult);
    if (currentValue === value) continue;
    calls.push(iface.encodeFunctionData('setText', [encodedName, key, value]));
  }
  if (calls.length) {
    await confirmed(resolver.multicall(calls), `records-${fullName}`, state);
  }
}

async function resolveText(provider, fullName, key) {
  const resolverIface = new Interface(TEXT_ABI);
  const universal = new Contract(ADDRESSES.universalResolver, ABIS.universalResolver, provider);
  const call = resolverIface.encodeFunctionData('text', [namehash(fullName), key]);
  const [result, resolver] = await universal.resolve(dnsEncode(fullName), call);
  const [value] = resolverIface.decodeFunctionResult('text', result);
  return { value, resolver };
}

async function main() {
  const env = loadEnv(join(ROOT, '.env.local'));
  if (!env.SEPOLIA_RPC_URL) throw new Error('SEPOLIA_RPC_URL is missing from .env.local');
  const provider = new JsonRpcProvider(env.SEPOLIA_RPC_URL, 11155111, { staticNetwork: true });
  if (Number((await provider.getNetwork()).chainId) !== 11155111) throw new Error('RPC is not Sepolia');

  const namespace = await loadWallet('verdict-sepolia-agent', provider);
  const auditor = await loadWallet('verdict-auditor', provider);
  const monitor = await loadWallet('verdict-monitor', provider);
  const state = loadState();

  const resolverInit = new Interface(ABIS.resolver).encodeFunctionData('initialize', [[[namespace.address, ALL_ROLES]], []]);
  const auditorResolverInit = new Interface(ABIS.resolver).encodeFunctionData('initialize', [[[auditor.address, ALL_ROLES]], []]);
  const monitorResolverInit = new Interface(ABIS.resolver).encodeFunctionData('initialize', [[[monitor.address, ALL_ROLES]], []]);
  const registryInit = (owner) => new Interface(ABIS.registry).encodeFunctionData('initialize', [[[owner, ALL_ROLES]]]);

  const namespaceResolver = await ensureProxy({ key: 'namespaceResolver', wallet: namespace, implementation: ADDRESSES.resolverImplementation, salt: resolverSalt(namespace.address), initData: resolverInit, state });
  const auditorResolver = await ensureProxy({ key: 'auditorResolver', wallet: auditor, implementation: ADDRESSES.resolverImplementation, salt: resolverSalt(auditor.address), initData: auditorResolverInit, state });
  const monitorResolver = await ensureProxy({ key: 'monitorResolver', wallet: monitor, implementation: ADDRESSES.resolverImplementation, salt: resolverSalt(monitor.address), initData: monitorResolverInit, state });

  const verdictRegistry = await ensureProxy({ key: 'verdictRegistry', wallet: namespace, implementation: ADDRESSES.registryImplementation, salt: registrySalt('verdict.eth'), initData: registryInit(namespace.address), state });
  const acmeRegistry = await ensureProxy({ key: 'acmeRegistry', wallet: namespace, implementation: ADDRESSES.registryImplementation, salt: registrySalt('acme.verdict.eth'), initData: registryInit(namespace.address), state });
  const auditorRegistry = await ensureProxy({ key: 'auditorRegistry', wallet: auditor, implementation: ADDRESSES.registryImplementation, salt: registrySalt('verdict-auditor.eth'), initData: registryInit(auditor.address), state });
  const monitorRegistry = await ensureProxy({ key: 'monitorRegistry', wallet: monitor, implementation: ADDRESSES.registryImplementation, salt: registrySalt('verdict-monitor.eth'), initData: registryInit(monitor.address), state });

  const roots = [
    { label: 'verdict', owner: namespace.address, resolver: namespaceResolver, subregistry: verdictRegistry },
    { label: 'verdict-auditor', owner: auditor.address, resolver: auditorResolver, subregistry: auditorRegistry },
    { label: 'verdict-monitor', owner: monitor.address, resolver: monitorResolver, subregistry: monitorRegistry },
  ];

  const token = new Contract(ADDRESSES.mockUsdc, ABIS.erc20, namespace);
  let totalPrice = 0n;
  const registrar = new Contract(ADDRESSES.ethRegistrar, ABIS.registrar, namespace);
  for (const root of roots) {
    if (await registrar.isAvailable(root.label)) {
      const [base, premium] = await registrar.getRegisterPrice(root.label, YEAR, ADDRESSES.mockUsdc);
      totalPrice += base + premium;
    }
  }
  if ((await token.balanceOf(namespace.address)) < totalPrice) throw new Error('Insufficient mock USDC for registrations');
  if ((await token.allowance(namespace.address, ADDRESSES.ethRegistrar)) < totalPrice) {
    await confirmed(token.approve(ADDRESSES.ethRegistrar, totalPrice), 'approve-registration-usdc', state);
  }

  for (const root of roots) await ensureRootRegistration({ ...root, payer: namespace, state });

  const minAge = await registrar.MIN_COMMITMENT_AGE();
  let waitSeconds = 0;
  for (const root of roots) {
    if (!(await registrar.isAvailable(root.label))) continue;
    const entry = state.registrations[root.label];
    const commitment = await registrar.makeCommitment(root.label, root.owner, entry.secret, root.subregistry, root.resolver, YEAR, ZERO_HASH);
    const committedAt = await registrar.commitmentAt(commitment);
    const block = await provider.getBlock('latest');
    waitSeconds = Math.max(waitSeconds, Number(committedAt + minAge - BigInt(block.timestamp)));
  }
  if (waitSeconds > 0) {
    console.log(`commitments: waiting ${waitSeconds + 2}s for reveal window`);
    await new Promise((resolve) => setTimeout(resolve, (waitSeconds + 2) * 1000));
  }
  for (const root of roots) await revealRootRegistration({ ...root, payer: namespace, state });

  await ensureParent(verdictRegistry, namespace, ADDRESSES.ethRegistry, 'verdict', state);
  await ensureParent(auditorRegistry, auditor, ADDRESSES.ethRegistry, 'verdict-auditor', state);
  await ensureParent(monitorRegistry, monitor, ADDRESSES.ethRegistry, 'verdict-monitor', state);

  const expiry = BigInt(Math.floor(Date.now() / 1000)) + SUBNAME_LIFETIME;
  await ensureSubname({ registryAddress: verdictRegistry, wallet: namespace, label: 'acme', owner: namespace.address, resolver: namespaceResolver, subregistry: acmeRegistry, expiry, state });
  await ensureParent(acmeRegistry, namespace, verdictRegistry, 'acme', state);
  await ensureSubname({ registryAddress: acmeRegistry, wallet: namespace, label: 'usd-yield-001', owner: namespace.address, resolver: namespaceResolver, expiry, state });
  await ensureSubname({ registryAddress: verdictRegistry, wallet: namespace, label: 'treasury-agent', owner: namespace.address, resolver: namespaceResolver, expiry, state });
  await ensureSubname({ registryAddress: auditorRegistry, wallet: auditor, label: 'audit-001', owner: auditor.address, resolver: auditorResolver, expiry, state });
  await ensureSubname({ registryAddress: monitorRegistry, wallet: monitor, label: 'risk-001', owner: monitor.address, resolver: monitorResolver, expiry, state });

  const now = Math.floor(Date.now() / 1000);
  const assetName = 'usd-yield-001.acme.verdict.eth';
  const auditName = 'audit-001.verdict-auditor.eth';
  const riskName = 'risk-001.verdict-monitor.eth';
  const agentName = 'treasury-agent.verdict.eth';

  await setTextRecords(namespaceResolver, namespace, assetName, {
    'verdict.schema': 'asset/1',
    'verdict.asset.displayName': 'USD Yield 001',
    'verdict.asset.ticker': 'USDY-001',
    'verdict.asset.issuer': 'acme.verdict.eth',
    'verdict.asset.class': 'Yield',
    'verdict.asset.documentUri': 'https://verdict.vercel.app/verdict-overview.md',
    'verdict.asset.deployments': JSON.stringify({ 'eip155:11155111': ADDRESSES.mockUsdc }),
    'verdict.asset.status': 'active',
    'verdict.asset.attestation': auditName,
    'verdict.asset.observation': riskName,
  }, state);

  await setTextRecords(auditorResolver, auditor, auditName, {
    'verdict.schema': 'attestation/1',
    'verdict.subject': assetName,
    'verdict.attestation.auditor': 'verdict-auditor.eth',
    'verdict.attestation.subjectId': `eip155:11155111:${ADDRESSES.mockUsdc.toLowerCase()}`,
    'verdict.attestation.documentHash': keccak256(toUtf8Bytes('Verdict fictional audit evidence v1')),
    'verdict.attestation.issuedAt': String(now),
    'verdict.attestation.expiresAt': String(now + 30 * 86_400),
    'verdict.attestation.status': 'active',
    'verdict.attestation.methodologyUri': 'https://verdict.vercel.app/verdict-overview.md',
  }, state);

  await setTextRecords(monitorResolver, monitor, riskName, {
    'verdict.schema': 'observation/1',
    'verdict.subject': assetName,
    'verdict.observation.monitor': 'verdict-monitor.eth',
    'verdict.observation.observedAt': String(now),
    'verdict.observation.severity': 'info',
    'verdict.observation.reasonCode': 'SOURCE_OK',
    'verdict.observation.evidenceUri': 'https://verdict.vercel.app/verdict-overview.md',
    'verdict.observation.status': 'active',
  }, state);

  await setTextRecords(namespaceResolver, namespace, agentName, {
    'verdict.schema': 'agent/1',
    'agent-context': 'Verdict treasury agent. Resolves ENS evidence and runs deterministic policy v0.',
    'agent-endpoint[web]': 'https://verdict.vercel.app/agents',
    'verdict.agent.policy': 'verdict-demo-policy-v0',
  }, state);

  const live = await resolveText(provider, assetName, 'verdict.asset.attestation');
  if (live.value !== auditName) throw new Error('Universal Resolver verification failed');

  const auditorContractAsIssuer = new Contract(auditorResolver, ABIS.resolver, namespace);
  let unauthorizedBlocked = false;
  try {
    await auditorContractAsIssuer.setText.staticCall(dnsEncode(auditName), 'verdict.attestation.status', 'revoked');
  } catch {
    unauthorizedBlocked = true;
  }
  if (!unauthorizedBlocked) throw new Error('Issuer unexpectedly has permission to write auditor evidence');

  console.log(JSON.stringify({
    chainId: 11155111,
    addresses: ADDRESSES,
    actors: { namespace: namespace.address, auditor: auditor.address, monitor: monitor.address },
    names: { asset: assetName, audit: auditName, risk: riskName, agent: agentName },
    proxies: state.proxies,
    verification: { universalResolver: true, unauthorizedIssuerWriteBlocked: true },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

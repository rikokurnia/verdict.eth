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
  toUtf8Bytes,
} from 'ethers';

const ROOT = process.cwd();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ALL_ROLES = BigInt(`0x${'1'.repeat(64)}`);
const SUBNAME_LIFETIME = 180n * 86_400n;

const ADDRESSES = {
  universalResolver: '0xd26f2040d083af1cd2962ba303f4bea0c4faf142',
  ethRegistry: '0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e',
  factory: '0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780',
  resolverImplementation: '0xa9d3814ab151bf6e37a427432795371a8361614e',
  registryImplementation: '0x47b442d0cf617c41cabaff5f02f44dd1e5f72546',
};

const AGENT_NODES = [
  {
    label: 'legal',
    name: 'legal.agent.verdict.eth',
    title: 'Legal & Compliance Inspector',
    role: 'legal-compliance',
    eyebrow: '01 / INSPECTOR',
    context: 'Independent legal and compliance inspector for RWA assets. Audits issuer jurisdiction, regulatory filings, and authority delegation.',
  },
  {
    label: 'custody',
    name: 'custody.agent.verdict.eth',
    title: 'Custody & Backing Inspector',
    role: 'custody-backing',
    eyebrow: '02 / INSPECTOR',
    context: 'Independent custody and reserve monitor for tokenized real-world assets. Tracks offchain bank reserves, attestations, and collateral ratios.',
  },
  {
    label: 'technical',
    name: 'technical.agent.verdict.eth',
    title: 'Smart Contract Tech Inspector',
    role: 'smart-contract-tech',
    eyebrow: '03 / INSPECTOR',
    context: 'Independent smart contract technical inspector. Verifies onchain bytecode, access control roles, proxy implementations, and token standards.',
  },
  {
    label: 'consensus',
    name: 'consensus.agent.verdict.eth',
    title: 'Consensus Synthesizer Core',
    role: 'consensus-synthesis',
    eyebrow: '04 / SYNTHESIS CORE',
    context: 'Consensus synthesis engine for Verdict. Aggregates multi-agent inspector telemetry, resolves onchain conflicts, and writes cryptographic verdicts to ENS.',
  },
];

const ABIS = {
  factory: [
    'function deployProxy(address implementation,uint256 salt,bytes data) returns (address proxy)',
    'function verifyContract(address proxy) view returns (address implementation)',
    'event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)',
  ],
  registry: [
    'function initialize((address account,uint256 roleBitmap)[] grants)',
    'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
    'function getStatus(uint256 anyId) view returns (uint8)',
    'function setParent(address parent,string label)',
    'function getParent() view returns (address parent,string label)',
  ],
  resolver: [
    'function setText(bytes name,string key,string value)',
    'function resolve(bytes name,bytes data) view returns (bytes result)',
    'function multicall(bytes[] calls) returns (bytes[] results)',
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
  return JSON.parse(readFileSync(join(ROOT, '.secrets', 'ensv2-state.json'), 'utf8'));
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

async function main() {
  const env = loadEnv(join(ROOT, '.env.local'));
  const provider = new JsonRpcProvider(env.SEPOLIA_RPC_URL, 11155111, { staticNetwork: true });
  const namespace = await loadWallet('verdict-sepolia-agent', provider);
  const state = loadState();

  console.log('Using wallet:', namespace.address);

  const coder = AbiCoder.defaultAbiCoder();
  const registrySalt = BigInt(keccak256(coder.encode(
    ['bytes32', 'bytes32', 'uint256'],
    [keccak256(toUtf8Bytes('UserRegistry')), namehash('agent.verdict.eth'), 0n],
  )));
  const registryInit = new Interface(ABIS.registry).encodeFunctionData('initialize', [[[namespace.address, ALL_ROLES]]]);

  let agentRegistry = state.proxies.agentRegistry;
  if (!agentRegistry || (await provider.getCode(agentRegistry)) === '0x') {
    console.log('Deploying agentRegistry via factory...');
    const factory = new Contract(ADDRESSES.factory, ABIS.factory, namespace);
    const receipt = await confirmed(factory.deployProxy(ADDRESSES.registryImplementation, registrySalt, registryInit), 'deploy-agentRegistry', state);
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog(log);
        if (parsed?.name === 'ProxyDeployed') agentRegistry = parsed.args.proxyAddress;
      } catch { /* ignore initializer logs */ }
    }
    if (!agentRegistry) throw new Error('agentRegistry deployment did not emit ProxyDeployed');
    const verified = await factory.verifyContract(agentRegistry);
    if (verified.toLowerCase() !== ADDRESSES.registryImplementation.toLowerCase()) throw new Error('agentRegistry failed factory verification');
    state.proxies.agentRegistry = getAddress(agentRegistry);
    saveState(state);
    console.log('agentRegistry deployed at:', agentRegistry);
  } else {
    console.log('deploy-agentRegistry: already deployed at', agentRegistry);
  }

  const namespaceResolver = state.proxies.namespaceResolver;
  const verdictRegistry = new Contract(state.proxies.verdictRegistry, ABIS.registry, namespace);
  const agentRegistryContract = new Contract(agentRegistry, ABIS.registry, namespace);

  // Set parent on agentRegistry: parent = verdictRegistry, label = 'agent'
  const [agentParent, agentLabel] = await agentRegistryContract.getParent().catch(() => [ZERO_ADDRESS, '']);
  if (agentParent.toLowerCase() !== state.proxies.verdictRegistry.toLowerCase() || agentLabel !== 'agent') {
    await confirmed(agentRegistryContract.setParent(state.proxies.verdictRegistry, 'agent'), 'parent-agent', state);
  } else {
    console.log('parent-agent: already set');
  }

  // Register 'agent' on verdictRegistry
  const expiry = BigInt(Math.floor(Date.now() / 1000)) + SUBNAME_LIFETIME;
  const agentId = BigInt(keccak256(toUtf8Bytes('agent')));
  if (Number(await verdictRegistry.getStatus(agentId)) !== 2) {
    await confirmed(
      verdictRegistry.register('agent', namespace.address, agentRegistry, namespaceResolver, ALL_ROLES, expiry),
      'subname-agent',
      state,
    );
  } else {
    console.log('subname-agent: already registered on verdictRegistry');
  }

  const textIface = new Interface(TEXT_ABI);
  const setIface = new Interface(ABIS.resolver);
  const resolver = new Contract(namespaceResolver, ABIS.resolver, namespace);

  // Register the 4 agent subnames under agentRegistry and set text records
  for (const agent of AGENT_NODES) {
    const fullName = agent.name;
    const label = agent.label;
    const id = BigInt(keccak256(toUtf8Bytes(label)));

    if (Number(await agentRegistryContract.getStatus(id)) !== 2) {
      await confirmed(
        agentRegistryContract.register(label, namespace.address, ZERO_ADDRESS, namespaceResolver, ALL_ROLES, expiry),
        `subname-${label}.agent`,
        state,
      );
    } else {
      console.log(`subname-${label}.agent: already registered`);
    }

    const records = {
      'verdict.schema': 'agent/1',
      'verdict.agent.role': agent.role,
      'verdict.profile.authority': 'Verdict Core Agent Protocol',
      'name': agent.title,
      'description': agent.context,
      'agent-context': agent.context,
      'agent-endpoint': `https://verdict.network/api/agents/${agent.label}`,
      'agent-endpoint[mcp]': `https://verdict.network/api/mcp/${agent.label}`,
    };

    const encodedName = dnsEncode(fullName);
    const queries = Object.entries(records).map(([key, value]) => ({
      key,
      value,
      query: textIface.encodeFunctionData('text', [namehash(fullName), key]),
    }));

    const currents = await Promise.all(
      queries.map((q) => resolver.resolve(encodedName, q.query).catch(() => null)),
    );

    const calls = [];
    currents.forEach((raw, i) => {
      if (raw === null) {
        calls.push(setIface.encodeFunctionData('setText', [encodedName, queries[i].key, queries[i].value]));
        return;
      }
      const [currentValue] = textIface.decodeFunctionResult('text', raw);
      if (currentValue !== queries[i].value) {
        calls.push(setIface.encodeFunctionData('setText', [encodedName, queries[i].key, queries[i].value]));
      }
    });

    if (calls.length) {
      await confirmed(resolver.multicall(calls), `records-${fullName}`, state);
    } else {
      console.log(`records-${fullName}: already current`);
    }
  }

  console.log('Done! All 4 agent subnames registered and configured onchain on Sepolia.');
}

main().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});

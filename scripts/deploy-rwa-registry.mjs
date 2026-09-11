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

// marketId, label, title, ticker, issuer, class, networks, sourceUrl
const ASSETS = [
  ['blackrock-usd-institutional-digital-liquidity-fund', 'buidl', 'BlackRock USD Institutional Digital Liquidity Fund', 'BUIDL', 'BlackRock / Securitize', 'Treasury', 'ethereum,solana,polygon', 'https://securitize.io/'],
  ['hashnote-usyc', 'usyc', 'Circle USYC', 'USYC', 'Circle (Hashnote)', 'Treasury', 'ethereum,solana', 'https://usyc.hashnote.com/'],
  ['ondo-us-dollar-yield', 'usdy', 'Ondo US Dollar Yield', 'USDY', 'Ondo', 'Treasury', 'ethereum,solana,arbitrum', 'https://ondo.finance/'],
  ['ousg', 'ousg', 'Ondo Short-Term U.S. Government Bond Fund', 'OUSG', 'Ondo', 'Treasury', 'ethereum,polygon,solana', 'https://ondo.finance/'],
  ['franklin-templeton-benji', 'benji', 'Franklin Templeton BENJI', 'BENJI', 'Franklin Templeton', 'Money Market', 'stellar,polygon,ethereum', 'https://digitalassets.franklintempleton.com/benji/'],
  ['superstate-short-duration-us-government-securities-fund-ustb', 'ustb', 'Invesco Short Duration US Government Securities Fund', 'USTB', 'Superstate / Invesco', 'Treasury', 'ethereum', 'https://superstate.co/'],
  ['janus-henderson-anemoy-treasury-fund', 'jtrsy', 'Janus Henderson Anemoy Treasury Fund', 'JTRSY', 'Janus Henderson / Anemoy', 'Treasury', 'ethereum', 'https://centrifuge.io/'],
  ['eutbl', 'eutbl', 'Spiko EU T-Bills Money Market Fund', 'EUTBL', 'Spiko', 'Money Market', 'ethereum', 'https://www.coingecko.com/en/coins/eutbl'],
  ['spiko-amundi-overnight-swap-fund-eur', 'spiko-eur', 'Spiko Amundi Overnight Swap Fund (EUR)', 'EURSAFO', 'Spiko / Amundi', 'Money Market', 'ethereum', 'https://www.coingecko.com/en/coins/spiko-amundi-overnight-swap-fund-eur'],
  ['janus-henderson-anemoy-aaa-clo-fund', 'jaaa', 'Janus Henderson Anemoy AAA CLO Fund', 'JAAA', 'Janus Henderson / Anemoy', 'Private Credit', 'ethereum', 'https://centrifuge.io/'],
  ['ylds', 'ylds', 'YLDS', 'YLDS', 'Figure', 'Money Market', 'provenance', 'https://figure.com/'],
  ['tether-gold', 'xaut', 'Tether Gold', 'XAUT', 'Tether', 'Gold', 'ethereum,tron', 'https://tether.to/'],
  ['pax-gold', 'paxg', 'PAX Gold', 'PAXG', 'Paxos', 'Gold', 'ethereum', 'https://paxos.com/'],
  ['kinesis-gold', 'kau', 'Kinesis Gold', 'KAU', 'Kinesis', 'Gold', 'ethereum', 'https://kinesis.money/'],
  ['nvidia-xstock', 'nvdax', 'NVIDIA xStock', 'NVDAX', 'Backed / xStocks', 'Tokenized Stock', 'ethereum,solana', 'https://xstocks.fi/'],
  ['tesla-xstock', 'tslax', 'Tesla xStock', 'TSLAX', 'Backed / xStocks', 'Tokenized Stock', 'ethereum,solana', 'https://xstocks.fi/'],
  ['syrup', 'syrup', 'Maple Finance', 'SYRUP', 'Maple Finance', 'Private Credit', 'ethereum,solana', 'https://maple.finance/'],
  ['figure-heloc', 'figr-heloc', 'Figure Heloc', 'FIGR_HELOC', 'Figure', 'Private Credit', 'provenance', 'https://figure.com/'],
  ['blockchain-capital', 'bcap', 'Blockchain Capital', 'BCAP', 'Blockchain Capital', 'Private Equity', 'ethereum', 'https://blockchain.capital/'],
  ['onyc', 'onyc', 'OnRe Tokenized Reinsurance', 'ONYC', 'OnRe', 'Insurance', 'solana', 'https://www.coingecko.com/en/coins/onyc'],
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)),
]);

async function fetchContract(marketId) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${marketId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      { headers: { accept: 'application/json' }, signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const detail = await res.json();
    const addr = detail?.detail_platforms?.ethereum?.contract_address;
    return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
  } catch {
    return null;
  }
}

async function main() {
  const env = loadEnv(join(ROOT, '.env.local'));
  const provider = new JsonRpcProvider(env.SEPOLIA_RPC_URL, 11155111, { staticNetwork: true });
  const namespace = await loadWallet('verdict-sepolia-agent', provider);
  const state = loadState();

  const coder = AbiCoder.defaultAbiCoder();
  const registrySalt = BigInt(keccak256(coder.encode(
    ['bytes32', 'bytes32', 'uint256'],
    [keccak256(toUtf8Bytes('UserRegistry')), namehash('rwa.verdict.eth'), 0n],
  )));
  const registryInit = new Interface(ABIS.registry).encodeFunctionData('initialize', [[[namespace.address, ALL_ROLES]]]);

  let rwaRegistry = state.proxies.rwaRegistry;
  if (!rwaRegistry || (await provider.getCode(rwaRegistry)) === '0x') {
    const factory = new Contract(ADDRESSES.factory, ABIS.factory, namespace);
    const receipt = await confirmed(factory.deployProxy(ADDRESSES.registryImplementation, registrySalt, registryInit), 'deploy-rwaRegistry', state);
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog(log);
        if (parsed?.name === 'ProxyDeployed') rwaRegistry = parsed.args.proxyAddress;
      } catch { /* ignore initializer logs */ }
    }
    if (!rwaRegistry) throw new Error('rwaRegistry deployment did not emit ProxyDeployed');
    const verified = await factory.verifyContract(rwaRegistry);
    if (verified.toLowerCase() !== ADDRESSES.registryImplementation.toLowerCase()) throw new Error('rwaRegistry failed factory verification');
    state.proxies.rwaRegistry = getAddress(rwaRegistry);
    saveState(state);
  } else {
    console.log('deploy-rwaRegistry: already deployed');
  }

  const namespaceResolver = state.proxies.namespaceResolver;
  const verdictRegistry = new Contract(state.proxies.verdictRegistry, ABIS.registry, namespace);
  const rwaRegistryContract = new Contract(rwaRegistry, ABIS.registry, namespace);

  const [rwaParent, rwaLabel] = await rwaRegistryContract.getParent().catch(() => [ZERO_ADDRESS, '']);
  if (rwaParent.toLowerCase() !== state.proxies.verdictRegistry.toLowerCase() || rwaLabel !== 'rwa') {
    await confirmed(rwaRegistryContract.setParent(state.proxies.verdictRegistry, 'rwa'), 'parent-rwa', state);
  } else {
    console.log('parent-rwa: already set');
  }

  const expiry = BigInt(Math.floor(Date.now() / 1000)) + SUBNAME_LIFETIME;
  const rwaId = BigInt(keccak256(toUtf8Bytes('rwa')));
  if (Number(await verdictRegistry.getStatus(rwaId)) !== 2) {
    await confirmed(
      verdictRegistry.register('rwa', namespace.address, rwaRegistry, namespaceResolver, ALL_ROLES, expiry),
      'subname-rwa',
      state,
    );
  } else {
    console.log('subname-rwa: already registered');
  }

  const textIface = new Interface(TEXT_ABI);
  const setIface = new Interface(ABIS.resolver);
  const resolver = new Contract(namespaceResolver, ABIS.resolver, namespace);

  for (const [marketId, label, title, ticker, issuer, assetClass, networks, sourceUrl] of ASSETS) {
    const fullName = `${label}.rwa.verdict.eth`;
    try {
      await withTimeout((async () => {
        const id = BigInt(keccak256(toUtf8Bytes(label)));
        if (Number(await rwaRegistryContract.getStatus(id)) !== 2) {
          await confirmed(
            rwaRegistryContract.register(label, namespace.address, ZERO_ADDRESS, namespaceResolver, ALL_ROLES, expiry),
            `subname-${label}`,
            state,
          );
        }
        const contract = await fetchContract(marketId);
        console.log(`contract ${label}: ${contract ?? 'unavailable — skipped, rerun backfills'}`);
        const records = {
          'verdict.schema': 'rwa-profile/1',
          'verdict.profile.authority': 'verdict-curator (unofficial)',
          'verdict.asset.displayName': title,
          'verdict.asset.ticker': ticker,
          'verdict.asset.issuer': issuer,
          'verdict.asset.class': assetClass,
          'verdict.asset.networks': networks,
          'issuer.url': sourceUrl,
          'coingecko.id': marketId,
          ...(contract ? { 'contract.ethereum': contract } : {}),
        };
        const encodedName = dnsEncode(fullName);
        const queries = Object.entries(records).map(([key, value]) => ({
          key,
          value,
          query: textIface.encodeFunctionData('text', [namehash(fullName), key]),
        }));
        // Parallel reads (flaky RPC: one slow call no longer blocks the rest).
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
      })(), 150_000, fullName);
    } catch (error) {
      console.log(`gap-${label}: ${error.message || error} — rerun backfills`);
    }
    await sleep(3000); // CoinGecko rate-limit courtesy
  }

  console.log(JSON.stringify({ branch: 'rwa.verdict.eth', registry: rwaRegistry, assets: ASSETS.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

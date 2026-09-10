import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  dnsEncode,
  keccak256,
  namehash,
  toUtf8Bytes,
} from 'ethers';

const ROOT = process.cwd();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ALL_ROLES = BigInt(`0x${'1'.repeat(64)}`);
const UINT64_MAX = (1n << 64n) - 1n;
const SUBNAME_LIFETIME = 180n * 86_400n;

// Registry roles (ENSv2 Permissioned Registry).
const R = {
  REGISTRAR: 1n << 0n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  CAN_TRANSFER_ADMIN: (1n << 28n) << 128n,
  UPGRADE: 1n << 124n,
};
const admin = (role) => role << 128n;
// Dangerous on ROOT: can override name owners. Everything else stays, so the
// namespace keeps issuing/renewing subnames after emancipation.
const DANGEROUS = R.SET_RESOLVER | R.SET_SUBREGISTRY | R.UNREGISTER | R.UPGRADE | R.SET_PARENT
  | admin(R.SET_RESOLVER) | admin(R.SET_SUBREGISTRY) | admin(R.UNREGISTER) | admin(R.UPGRADE) | admin(R.SET_PARENT)
  | R.CAN_TRANSFER_ADMIN;
const SAFE_ROOT = R.REGISTRAR | R.RENEW;

const UNIVERSAL_RESOLVER = '0xd26f2040d083af1cd2962ba303f4bea0c4faf142';
const CANONICAL = 'usd-yield-001.acme.verdict.eth';
// Namespace aliases: arb./base. share the acme subregistry, so
// usd-yield-001.arb.verdict.eth reads the same records as canonical.
const ALIAS_PARENTS = ['arb.verdict.eth', 'base.verdict.eth'];
const ALIASED_ASSET = (parent) => `usd-yield-001.${parent}`;
const STALE_ALIAS = 'arb-usd-yield-001.acme.verdict.eth'; // superseded attempt, cleaned up
const SOULBOUND = 'kyc-001.acme.verdict.eth';
const FOREVER = 'genesis.acme.verdict.eth';

const ABIS = {
  registry: [
    'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
    'function unregister(uint256 anyId)',
    'function getStatus(uint256 anyId) view returns (uint8)',
    'function getExpiry(uint256 anyId) view returns (uint64)',
    'function getSubregistry(string label) view returns (address)',
    'function findTokenId(string label) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)',
    'function revokeRootRoles(uint256 roleBitmap,address account) returns (bool)',
    'function safeTransferFrom(address from,address to,uint256 id,uint256 value,bytes data)',
  ],
  resolver: [
    'function multicall(bytes[] calls) returns (bytes[] results)',
  ],
  universalResolver: [
    'function resolve(bytes name,bytes data) view returns (bytes result,address resolver)',
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

const labelOf = (name) => name.split('.')[0];

async function main() {
  const env = loadEnv(join(ROOT, '.env.local'));
  const provider = new JsonRpcProvider(env.SEPOLIA_RPC_URL, 11155111, { staticNetwork: true });
  const namespace = await loadWallet('verdict-sepolia-agent', provider);
  const state = loadState();
  const acmeRegistry = state.proxies.acmeRegistry;
  const namespaceResolver = state.proxies.namespaceResolver;
  const registry = new Contract(acmeRegistry, ABIS.registry, namespace);
  const resolver = new Contract(namespaceResolver, ABIS.resolver, namespace);
  const universal = new Contract(UNIVERSAL_RESOLVER, ABIS.universalResolver, provider);
  const textIface = new Interface(TEXT_ABI);

  async function resolveText(name, key) {
    const query = textIface.encodeFunctionData('text', [namehash(name), key]);
    const [raw, answerResolver] = await universal.resolve(dnsEncode(name), query);
    const [value] = textIface.decodeFunctionResult('text', raw);
    return { value: String(value), resolver: String(answerResolver) };
  }

  const expiry = BigInt(Math.floor(Date.now() / 1000)) + SUBNAME_LIFETIME;
  const verdictRegistry = new Contract(state.proxies.verdictRegistry, ABIS.registry, namespace);

  // 0. Clean up the superseded flat alias attempt (must run pre-emancipation).
  {
    const staleId = BigInt(keccak256(toUtf8Bytes(labelOf(STALE_ALIAS))));
    if (Number(await registry.getStatus(staleId)) === 2) {
      await confirmed(registry.unregister(staleId), 'unregister-arb-usd-yield-001', state);
    } else {
      console.log('unregister-arb-usd-yield-001: already gone');
    }
  }

  // 1. Namespace alias pair: arb./base. share the acme subregistry, so
  // usd-yield-001.arb.verdict.eth reads the same records as canonical.
  for (const parent of ALIAS_PARENTS) {
    const label = labelOf(parent);
    const id = BigInt(keccak256(toUtf8Bytes(label)));
    if (Number(await verdictRegistry.getStatus(id)) !== 2) {
      await confirmed(
        verdictRegistry.register(label, namespace.address, acmeRegistry, namespaceResolver, ALL_ROLES, expiry),
        `subname-${label}`,
        state,
      );
    } else {
      console.log(`subname-${label}: already registered`);
    }
    const linked = await verdictRegistry.getSubregistry(label);
    if (linked.toLowerCase() !== acmeRegistry.toLowerCase()) {
      throw new Error(`Alias parent ${parent} does not share the acme subregistry`);
    }
    console.log(`alias-parent ${parent}: shares subregistry ${linked.slice(0, 10)}`);
  }
  // Verify edit-once-resolve-everywhere:
  // 1) both parents share the acme subregistry (namespace aliasing, onchain);
  // 2) each parent declares its canonical target (reader follows it, since
  //    this deployment's resolver predates setAlias — proven by ABI dump);
  // 3) canonical records resolve through the Universal Resolver.
  const canonicalTitle = (await resolveText(CANONICAL, 'verdict.asset.displayName')).value;
  const canonicalTicker = (await resolveText(CANONICAL, 'verdict.asset.ticker')).value;
  if (!canonicalTitle) throw new Error('Canonical records missing');
  const textCalls = [];
  for (const parent of ALIAS_PARENTS) {
    const current = await resolveText(parent, 'verdict.alias.canonical').catch(() => ({ value: '' }));
    if (current.value !== CANONICAL) {
      const setIface = new Interface(['function setText(bytes name,string key,string value)']);
      const call = setIface.encodeFunctionData('setText', [dnsEncode(parent), 'verdict.alias.canonical', CANONICAL]);
      const resolverContract = new Contract(namespaceResolver, ABIS.resolver, namespace);
      await confirmed(resolverContract.multicall([call]), `alias-pointer-${labelOf(parent)}`, state);
    } else {
      console.log(`alias-pointer-${labelOf(parent)}: already set`);
    }
    const check = await resolveText(parent, 'verdict.alias.canonical');
    if (check.value !== CANONICAL) throw new Error(`Alias pointer missing on ${parent}`);
    console.log(`alias-verify ${parent}: shares subregistry + declares canonical ${check.value}`);
  }
  console.log(`canonical-verify ${CANONICAL}: "${canonicalTitle} · ${canonicalTicker}"`);

  // 2. Soulbound: zero-role registration — no transfer admin for anyone.
  {
    const id = BigInt(keccak256(toUtf8Bytes(labelOf(SOULBOUND))));
    if (Number(await registry.getStatus(id)) !== 2) {
      await confirmed(
        registry.register(labelOf(SOULBOUND), namespace.address, ZERO_ADDRESS, namespaceResolver, 0n, expiry),
        'subname-kyc-001',
        state,
      );
    } else {
      console.log('subname-kyc-001: already registered');
    }
    const tokenId = await registry.findTokenId(labelOf(SOULBOUND));
    const owner = await registry.ownerOf(tokenId);
    if (owner.toLowerCase() !== namespace.address.toLowerCase()) throw new Error('Soulbound owner mismatch');
    let transferBlocked = false;
    try {
      await registry.safeTransferFrom.staticCall(namespace.address, state.proxies.auditorRegistry, tokenId, 1n, '0x');
    } catch {
      transferBlocked = true;
    }
    if (!transferBlocked) throw new Error('Soulbound name unexpectedly transferable');
    console.log(`soulbound-verify ${SOULBOUND}: owner ${owner.slice(0, 10)} · transfer reverts as designed`);
  }

  // 3. Forever: maximum uint64 expiry — renewable never, expiring never.
  {
    const id = BigInt(keccak256(toUtf8Bytes(labelOf(FOREVER))));
    if (Number(await registry.getStatus(id)) !== 2) {
      await confirmed(
        registry.register(labelOf(FOREVER), namespace.address, ZERO_ADDRESS, namespaceResolver, ALL_ROLES, UINT64_MAX),
        'subname-genesis',
        state,
      );
    } else {
      console.log('subname-genesis: already registered');
    }
    const onchainExpiry = await registry.getExpiry(id);
    if (onchainExpiry !== UINT64_MAX) throw new Error('Forever expiry mismatch');
    console.log(`forever-verify ${FOREVER}: expiry ${onchainExpiry} (uint64 max)`);
  }

  // 4. Emancipate the acme registry LAST: revoke parent-override powers on
  // ROOT so even the namespace cannot unregister, resolver-swap, remount,
  // or re-enable transfers under acme. Registrar + renew stay.
  {
    const dangerousHeld = await registry.hasRootRoles(DANGEROUS, namespace.address);
    if (dangerousHeld) {
      await registry.revokeRootRoles.staticCall(DANGEROUS, namespace.address);
      await confirmed(registry.revokeRootRoles(DANGEROUS, namespace.address), 'emancipate-acme', state);
    } else {
      console.log('emancipate-acme: already emancipated');
    }
    if (await registry.hasRootRoles(DANGEROUS, namespace.address)) throw new Error('Emancipation failed');
    if (!(await registry.hasRootRoles(SAFE_ROOT, namespace.address))) throw new Error('Registrar/renew lost — abort');
    console.log('emancipate-verify acme.verdict.eth: dangerous root roles gone · registrar+renew kept');
  }

  console.log(JSON.stringify({
    aliasParents: ALIAS_PARENTS, canonical: CANONICAL, soulbound: SOULBOUND, forever: FOREVER,
    emancipation: 'acme.verdict.eth dangerous root roles revoked',
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

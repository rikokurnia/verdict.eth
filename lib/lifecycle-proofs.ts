import { Contract, Interface, JsonRpcProvider, dnsEncode, keccak256, namehash, toUtf8Bytes } from 'ethers';
import { ENSV2_SEPOLIA } from './ensv2-config';

const REGISTRY_ABI = [
  'function getSubregistry(string label) view returns (address)',
  'function getExpiry(uint256 anyId) view returns (uint64)',
  'function findTokenId(string label) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function roles(uint256 anyId,address account) view returns (uint256)',
  'function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)',
];
const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const textInterface = new Interface(TEXT_ABI);

const UINT64_MAX = (BigInt(1) << BigInt(64)) - BigInt(1);
const CAN_TRANSFER_ADMIN = (BigInt(1) << BigInt(28)) << BigInt(128);
const DANGEROUS =
  (BigInt(1) << BigInt(24)) | (BigInt(1) << BigInt(20)) | (BigInt(1) << BigInt(12)) | (BigInt(1) << BigInt(124)) | (BigInt(1) << BigInt(8)) |
  ((BigInt(1) << BigInt(24)) << BigInt(128)) | ((BigInt(1) << BigInt(20)) << BigInt(128)) | ((BigInt(1) << BigInt(12)) << BigInt(128)) |
  ((BigInt(1) << BigInt(124)) << BigInt(128)) | ((BigInt(1) << BigInt(8)) << BigInt(128)) | CAN_TRANSFER_ADMIN;
const SAFE_ROOT = (BigInt(1) << BigInt(0)) | (BigInt(1) << BigInt(16));

const labelHash = (label: string) => BigInt(keccak256(toUtf8Bytes(label)));

function provider() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  return new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
}

async function resolveText(universal: Contract, name: string, key: string, blockTag: number) {
  const query = textInterface.encodeFunctionData('text', [namehash(name), key]);
  const [raw, resolver] = await universal.resolve(dnsEncode(name), query, { blockTag });
  const [value] = textInterface.decodeFunctionResult('text', raw);
  return { value: String(value), resolver: String(resolver) };
}

export type LifecycleProofs = {
  ok: boolean;
  sourceBlock: number | null;
  aliases: {
    parent: string;
    path: string;
    sharesSubregistry: boolean;
    pointer: string;
    pathTitle: string;
    followedTitle: string;
    canonicalTitle: string;
    identical: boolean;
  }[];
  soulbound: {
    name: string;
    owner: string;
    transferAdminHeld: boolean;
    blocked: boolean;
  } | null;
  forever: {
    name: string;
    expiry: string;
    isMax: boolean;
  } | null;
  emancipation: {
    registry: string;
    dangerousHeld: boolean;
    registrarHeld: boolean;
    emancipated: boolean;
  } | null;
};

export async function readLifecycleProofs(): Promise<LifecycleProofs> {
  const rpc = provider();
  const sourceBlock = await rpc.getBlockNumber();
  const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, rpc);
  const verdictRegistry = new Contract(ENSV2_SEPOLIA.proxies.verdictRegistry, REGISTRY_ABI, rpc);
  const acmeRegistry = new Contract(ENSV2_SEPOLIA.proxies.acmeRegistry, REGISTRY_ABI, rpc);

  const canonicalTitle = (await resolveText(universal, ENSV2_SEPOLIA.names.asset, 'verdict.asset.displayName', sourceBlock)).value;
  const aliases = await Promise.all(
    ENSV2_SEPOLIA.names.aliasParents.map(async (parent) => {
      const label = parent.split('.')[0];
      const path = `usd-yield-001.${parent}`;
      const [subregistry, pointer, pathTitle] = await Promise.all([
        verdictRegistry.getSubregistry(label) as Promise<string>,
        resolveText(universal, parent, 'verdict.alias.canonical', sourceBlock).then((r) => r.value).catch(() => ''),
        resolveText(universal, path, 'verdict.asset.displayName', sourceBlock).then((r) => r.value).catch(() => ''),
      ]);
      // Direct leaf reads are empty (deployment predates resolver setAlias);
      // readers follow the onchain pointer to the canonical records.
      const followedTitle = pointer
        ? await resolveText(universal, pointer, 'verdict.asset.displayName', sourceBlock).then((r) => r.value).catch(() => '')
        : '';
      return {
        parent,
        path,
        sharesSubregistry: subregistry.toLowerCase() === ENSV2_SEPOLIA.proxies.acmeRegistry.toLowerCase(),
        pointer,
        pathTitle,
        followedTitle,
        canonicalTitle,
        identical: pointer === ENSV2_SEPOLIA.names.asset && followedTitle !== '' && followedTitle === canonicalTitle,
      };
    }),
  );

  const soulLabel = ENSV2_SEPOLIA.names.soulbound.split('.')[0];
  const soulTokenId = (await acmeRegistry.findTokenId(soulLabel)) as bigint;
  const soulOwner = (await acmeRegistry.ownerOf(soulTokenId)) as string;
  const soulRoles = (await acmeRegistry.roles(labelHash(soulLabel), soulOwner)) as bigint;

  const foreverLabel = ENSV2_SEPOLIA.names.forever.split('.')[0];
  const foreverExpiry = (await acmeRegistry.getExpiry(labelHash(foreverLabel))) as bigint;

  // The soulbound owner is the namespace operator (same deployer wallet),
  // so its root roles reflect the emancipation state.
  const rootCheck = await Promise.all([
    acmeRegistry.hasRootRoles(DANGEROUS, soulOwner),
    acmeRegistry.hasRootRoles(SAFE_ROOT, soulOwner),
  ]).catch(() => [null, null] as (boolean | null)[]);

  return {
    ok: true,
    sourceBlock,
    aliases,
    soulbound: {
      name: ENSV2_SEPOLIA.names.soulbound,
      owner: soulOwner,
      transferAdminHeld: (soulRoles & CAN_TRANSFER_ADMIN) !== BigInt(0),
      blocked: (soulRoles & CAN_TRANSFER_ADMIN) === BigInt(0) && soulOwner !== '0x0000000000000000000000000000000000000000',
    },
    forever: {
      name: ENSV2_SEPOLIA.names.forever,
      expiry: foreverExpiry.toString(),
      isMax: foreverExpiry === UINT64_MAX,
    },
    emancipation: {
      registry: 'acme.verdict.eth',
      dangerousHeld: rootCheck[0] ?? true,
      registrarHeld: rootCheck[1] ?? false,
      emancipated: rootCheck[0] === false && rootCheck[1] === true,
    },
  };
}

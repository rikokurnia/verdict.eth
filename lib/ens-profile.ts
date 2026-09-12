import { Contract, Interface, JsonRpcProvider, dnsEncode, keccak256, namehash, toUtf8Bytes } from 'ethers';
import { ENSV2_SEPOLIA } from './ensv2-config';

const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const REGISTRY_ABI = [
  'function getState(uint256 anyId) view returns (uint8 status,uint64 expiry,address latestOwner,uint256 tokenId,bytes32 resource)',
];
const textInterface = new Interface(TEXT_ABI);

export const PROFILE_KEYS = [
  'verdict.schema',
  'verdict.profile.authority',
  'verdict.asset.displayName',
  'verdict.asset.ticker',
  'verdict.asset.issuer',
  'verdict.asset.class',
  'verdict.asset.networks',
  'issuer.url',
  'coingecko.id',
  'contract.ethereum',
  'contract.sepolia',
  'contract.polygon',
  'contract.arbitrum',
  'contract.base',
  'contract.solana',
  'contract.stellar',
  'contract.gnosis',
  'contract.avalanche',
  'contract.bsc',
  'contract.tron',
  'contract.provenance',
  'contract.aptos',
  'verdict.quartet.score',
  'verdict.quartet.status',
  'verdict.quartet.policy',
  'verdict.quartet.reason',
  'verdict.quartet.summary',
  'verdict.quartet.runAt',
  'verdict.quartet.validity',
  'verdict.quartet.sourceHash',
];

export type EnsProfile = {
  ok: boolean;
  name: string;
  sourceBlock: number | null;
  resolver: string;
  records: Record<string, string>;
  registration: { status: number; statusLabel: string; expiry: number; owner: string; tokenId: string } | null;
};

const STATUS_LABELS = ['AVAILABLE', 'RESERVED', 'REGISTERED'];

export async function readEnsProfile(name: string): Promise<EnsProfile> {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  const rpc = new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
  const sourceBlock = await rpc.getBlockNumber();
  const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, rpc);

  const rows = await Promise.all(
    PROFILE_KEYS.map(async (key) => {
      try {
        const query = textInterface.encodeFunctionData('text', [namehash(name), key]);
        const [raw, resolver] = await universal.resolve(dnsEncode(name), query, { blockTag: sourceBlock });
        const [value] = textInterface.decodeFunctionResult('text', raw);
        return { key, value: String(value), resolver: String(resolver) };
      } catch {
        return { key, value: '', resolver: '' };
      }
    }),
  );
  const records = Object.fromEntries(rows.map(({ key, value }) => [key, value]));
  const resolver = rows.find((r) => r.resolver)?.resolver ?? '';

  let registration: EnsProfile['registration'] = null;
  if (name.endsWith('.rwa.verdict.eth')) {
    try {
      const rwaRegistry = new Contract(ENSV2_SEPOLIA.proxies.rwaRegistry, REGISTRY_ABI, rpc);
      const label = name.split('.')[0];
      const id = BigInt(keccak256(toUtf8Bytes(label)));
      const state = (await rwaRegistry.getState(id, { blockTag: sourceBlock })) as unknown as {
        status: number; expiry: bigint; latestOwner: string; tokenId: bigint;
      };
      registration = {
        status: Number(state.status),
        statusLabel: STATUS_LABELS[Number(state.status)] ?? 'UNKNOWN',
        expiry: Number(state.expiry),
        owner: String(state.latestOwner),
        tokenId: String(state.tokenId),
      };
    } catch {
      registration = null;
    }
  }

  return {
    ok: Boolean(records['verdict.asset.displayName']),
    name,
    sourceBlock,
    resolver,
    records,
    registration,
  };
}

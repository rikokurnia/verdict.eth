import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Contract, Interface, JsonRpcProvider, Wallet, dnsEncode, keccak256, namehash, toUtf8Bytes, verifyMessage } from 'ethers';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';

/** Least-privilege auditor branch: owner may set text records on their own name, and delegate that. */
export const AUDITOR_BRANCH_BITMAP = (BigInt(1) << BigInt(4)) | ((BigInt(1) << BigInt(4)) << BigInt(128));
export const AUDITOR_BRANCH_ROLES = 'ROLE_SET_TEXT (bit 4) + ROLE_SET_TEXT_ADMIN (bit 132), name-scoped';

const REGISTRY_ABI = [
  'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
  'function getStatus(uint256 anyId) view returns (uint8)',
  'function findTokenId(string label) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];
const RESOLVER_ABI = [
  'function setText(bytes name,string key,string value)',
  'function multicall(bytes[] calls) returns (bytes[] results)',
];
const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const textInterface = new Interface(TEXT_ABI);

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SUBNAME_LIFETIME = BigInt(180 * 86_400);
const MAX_POLICY_CHARS = 2000;

export function validLabel(label: string): boolean {
  return /^[a-z0-9-]{1,32}$/.test(label) && !label.startsWith('-') && !label.endsWith('-');
}

export function mintMessage(label: string, address: string, timestamp: string) {
  return [`Verdict Auditor Factory — claim ${label}.verdict.eth`, `Owner: ${address}`, `Timestamp: ${timestamp}`].join('\n');
}

export function parseMintMessage(message: string): { label: string; address: string; timestamp: string } | null {
  const lines = message.trim().split('\n');
  const label = /^Verdict Auditor Factory — claim ([a-z0-9-]{1,32})\.verdict\.eth$/.exec(lines[0] ?? '')?.[1];
  const address = /^Owner: (0x[0-9a-fA-F]{40})$/.exec(lines[1] ?? '')?.[1];
  const timestamp = /^Timestamp: (\S+)$/.exec(lines[2] ?? '')?.[1];
  if (!label || !address || !timestamp) return null;
  return { label, address, timestamp };
}

function loadEnvFile(): Record<string, string> {
  try {
    const output: Record<string, string> = {};
    for (const raw of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const at = line.indexOf('=');
      if (at > 0) output[line.slice(0, at)] = line.slice(at + 1).replace(/^['"]|['"]$/g, '');
    }
    return output;
  } catch {
    return {};
  }
}

function rpc() {
  const file = loadEnvFile();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || file.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  return new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
}

export async function namespaceWallet(provider: JsonRpcProvider) {
  const encrypted = readFileSync(join(process.cwd(), '.secrets', 'verdict-sepolia-agent'), 'utf8');
  const password = readFileSync(join(process.cwd(), '.secrets', 'verdict-sepolia-agent.password'), 'utf8').trim();
  return (await Wallet.fromEncryptedJson(encrypted, password)).connect(provider);
}

export async function subnameStatus(label: string): Promise<{ available: boolean; owner: string | null }> {
  const provider = rpc();
  const registry = new Contract(ENSV2_SEPOLIA.proxies.verdictRegistry, REGISTRY_ABI, provider);
  const id = BigInt(keccak256(toUtf8Bytes(label)));
  let status = 0;
  try {
    status = Number(await registry.getStatus(id));
  } catch {
    return { available: false, owner: null };
  }
  if (status !== 0 && status !== 2) return { available: status === 0, owner: null };
  if (status === 0) return { available: true, owner: null };
  try {
    const tokenId = (await registry.findTokenId(label)) as bigint;
    const owner = (await registry.ownerOf(tokenId)) as string;
    return { available: false, owner };
  } catch {
    return { available: false, owner: null };
  }
}

export async function readAgentBranch(subname: string): Promise<{ owner: string; policy: string; context: string }> {
  const provider = rpc();
  const label = subname.split('.')[0];
  const registry = new Contract(ENSV2_SEPOLIA.proxies.verdictRegistry, REGISTRY_ABI, provider);
  const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, provider);
  const blockTag = await provider.getBlockNumber();
  const tokenId = (await registry.findTokenId(label)) as bigint;
  const owner = (await registry.ownerOf(tokenId)) as string;
  async function text(key: string) {
    try {
      const query = textInterface.encodeFunctionData('text', [namehash(subname), key]);
      const [raw] = await universal.resolve(dnsEncode(subname), query, { blockTag });
      const [value] = textInterface.decodeFunctionResult('text', raw);
      return String(value);
    } catch {
      return '';
    }
  }
  const [policy, context] = await Promise.all([text('agent.policy'), text('agent-context')]);
  return { owner, policy, context };
}

export type MintResult = {
  subname: string;
  owner: string;
  roles: string;
  roleBitmap: string;
  transactions: { register: { hash: string; blockNumber: number }; records: { hash: string; blockNumber: number } };
  policy: string;
  context: string;
};

export async function mintAuditorBranch(label: string, owner: string, policy: string): Promise<MintResult> {
  const cleanPolicy = policy.slice(0, MAX_POLICY_CHARS);
  const provider = rpc();
  const wallet = await namespaceWallet(provider);
  const subname = `${label}.verdict.eth`;
  const expiry = BigInt(Math.floor(Date.now() / 1000)) + SUBNAME_LIFETIME;

  const registry = new Contract(ENSV2_SEPOLIA.proxies.verdictRegistry, REGISTRY_ABI, wallet);
  const id = BigInt(keccak256(toUtf8Bytes(label)));
  if (Number(await registry.getStatus(id)) !== 0) throw new Error('Subname is no longer available');

  const registerTx = await registry.register(label, owner, ZERO_ADDRESS, ENSV2_SEPOLIA.proxies.namespaceResolver, AUDITOR_BRANCH_BITMAP, expiry);
  const registerReceipt = await registerTx.wait(1);
  if (registerReceipt.status !== 1) throw new Error(`Registration reverted: ${registerTx.hash}`);

  const context = `Custom auditor ${subname} operated by ${owner}. Inspection policy published in agent.policy.`;
  const resolver = new Contract(ENSV2_SEPOLIA.proxies.namespaceResolver, RESOLVER_ABI, wallet);
  const iface = new Interface(RESOLVER_ABI);
  const calls = [
    iface.encodeFunctionData('setText', [dnsEncode(subname), 'agent.policy', cleanPolicy]),
    iface.encodeFunctionData('setText', [dnsEncode(subname), 'agent-context', context]),
  ];
  await resolver.multicall.staticCall(calls);
  const recordsTx = await resolver.multicall(calls);
  const recordsReceipt = await recordsTx.wait(1);
  if (recordsReceipt.status !== 1) throw new Error(`Record write reverted: ${recordsTx.hash}`);

  // Read back the live record as mint proof.
  const live = await readAgentBranch(subname);
  if (live.policy !== cleanPolicy) throw new Error('Policy read-back mismatch after mint');

  return {
    subname,
    owner,
    roles: AUDITOR_BRANCH_ROLES,
    roleBitmap: `0x${AUDITOR_BRANCH_BITMAP.toString(16)}`,
    transactions: {
      register: { hash: String(registerTx.hash), blockNumber: Number(registerReceipt.blockNumber) },
      records: { hash: String(recordsTx.hash), blockNumber: Number(recordsReceipt.blockNumber) },
    },
    policy: live.policy,
    context: live.context,
  };
}

export function verifyMintSignature(message: string, signature: string, expectedAddress: string) {
  const recovered = verifyMessage(message, signature);
  if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error('Signature does not match the claimed owner address');
  }
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Contract, Interface, JsonRpcProvider, Wallet, dnsEncode, keccak256, namehash, toUtf8Bytes, verifyMessage } from 'ethers';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { validCustomAgentName } from '@/lib/custom-agent-store';
import {
  AUDITOR_BRANCH_BITMAP,
  AUDITOR_BRANCH_ROLES,
  MAX_POLICY_CHARS,
  SUBNAME_LIFETIME_SECONDS,
  ZERO_ADDRESS,
} from '@/lib/auditor-branch-policy';
export { AUDITOR_BRANCH_BITMAP, AUDITOR_BRANCH_ROLES };
export { validLabel, mintMessage, parseMintMessage } from '@/lib/agent-mint-request';
export { sponsoredMintEnabled } from '@/lib/agent-relayer-config';

/** Least-privilege auditor branch: owner may set text records on their own name, and delegate that. */

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
  return new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId);
}

export async function namespaceWallet(provider: JsonRpcProvider) {
  const operator = ENSV2_SEPOLIA.actors.namespaceOperator;
  // Single-line alternative to the keystore pair: far harder to mangle when
  // pasting into hosted env vars. The derived address is checked against the
  // namespace operator so a wrong key fails loudly instead of mysteriously.
  const privateKey = (process.env.VERDICT_RELAYER_PRIVATE_KEY || '').trim();
  if (privateKey) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error('Relayer private key is malformed. Paste a 0x-prefixed 64-hex-character key.');
    }
    const wallet = new Wallet(privateKey).connect(provider);
    if (wallet.address.toLowerCase() !== operator.toLowerCase()) {
      throw new Error(`Relayer private key unlocks ${wallet.address}, expected operator ${operator}. Wrong key pasted.`);
    }
    return wallet;
  }
  const json = process.env.VERDICT_RELAYER_KEYSTORE_JSON;
  const secret = process.env.VERDICT_RELAYER_KEYSTORE_PASSWORD;
  if (json || secret) {
    if (!json || !secret) throw new Error('Relayer keystore and password must both be configured.');
    try {
      // Vercel env values often pick up pasted whitespace; the local
      // .secrets file path already trims, so trim here too.
      return (await Wallet.fromEncryptedJson(json.trim(), secret.trim())).connect(provider);
    } catch {
      throw new Error('Relayer keystore could not be decrypted. Check server configuration.');
    }
  }
  if (process.env.VERCEL) throw new Error('Sponsored ENS relayer is not configured.');
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
    throw new Error('Registry status read failed.');
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

export async function readAgentBranch(subname: string): Promise<{ owner: string; policy: string; context: string; sourceBlock: number }> {
  if (!validCustomAgentName(subname)) throw new Error('Expected a custom factory name directly under verdict.eth.');
  const provider = rpc();
  try {
    const label = subname.split('.')[0];
    const registry = new Contract(ENSV2_SEPOLIA.proxies.verdictRegistry, REGISTRY_ABI, provider);
    const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, provider);
    const blockTag = await provider.getBlockNumber();
    const id = BigInt(keccak256(toUtf8Bytes(label)));
    if (Number(await registry.getStatus(id, { blockTag })) !== 2) throw new Error('Custom agent name is not active.');
    const tokenId = (await registry.findTokenId(label, { blockTag })) as bigint;
    const owner = (await registry.ownerOf(tokenId, { blockTag })) as string;
    async function text(key: string) {
      const query = textInterface.encodeFunctionData('text', [namehash(subname), key]);
      const [raw, resolver] = await universal.resolve(dnsEncode(subname), query, { blockTag });
      if (String(resolver).toLowerCase() !== ENSV2_SEPOLIA.proxies.namespaceResolver.toLowerCase()) throw new Error('Custom agent resolver differs from factory configuration.');
      if (raw === '0x') return '';
      const [value] = textInterface.decodeFunctionResult('text', raw);
      return String(value);
    }
    const [policy, context] = await Promise.all([text('agent.policy'), text('agent-context')]);
    return { owner, policy, context, sourceBlock: blockTag };
  } finally { provider.destroy(); }
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
  if ((await provider.getBalance(wallet.address)) === BigInt(0)) {
    throw new Error('The sponsored relayer needs Sepolia ETH. Please fund the operator wallet.');
  }
  const subname = `${label}.verdict.eth`;
  const expiry = BigInt(Math.floor(Date.now() / 1000)) + SUBNAME_LIFETIME_SECONDS;

  const registry = new Contract(ENSV2_SEPOLIA.proxies.verdictRegistry, REGISTRY_ABI, wallet);
  const id = BigInt(keccak256(toUtf8Bytes(label)));
  if (Number(await registry.getStatus(id)) !== 0) throw new Error('Subname is no longer available');

  const registerArgs = [label, owner, ZERO_ADDRESS, ENSV2_SEPOLIA.proxies.namespaceResolver, AUDITOR_BRANCH_BITMAP, expiry] as const;
  await registry.register.staticCall(...registerArgs);
  const registerTx = await registry.register(...registerArgs);
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
  if (live.owner.toLowerCase() !== owner.toLowerCase()) throw new Error('Owner read-back mismatch after mint');
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

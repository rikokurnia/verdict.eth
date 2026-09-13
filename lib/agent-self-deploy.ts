import {
  BrowserProvider,
  Contract,
  Interface,
  dnsEncode,
  keccak256,
  toUtf8Bytes,
  type Eip1193Provider,
} from 'ethers';
import { ENSV2_SEPOLIA } from './ensv2-config.ts';
import {
  AGENT_REGISTRY_ABI,
  AGENT_RESOLVER_ABI,
  AUDITOR_BRANCH_BITMAP,
  MAX_POLICY_CHARS,
  SUBNAME_LIFETIME_SECONDS,
  ZERO_ADDRESS,
  branchContext,
} from './auditor-branch-policy.ts';

export type SelfDeployPhase =
  | 'checking-wallet'
  | 'registering'
  | 'publishing-policy'
  | 'confirming';

export type SelfDeployResult = {
  subname: string;
  owner: string;
  register: { hash: string; blockNumber: number };
  records: { hash: string; blockNumber: number };
};

function friendly(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Transaction failed.';
  if (/user rejected|user denied|rejected the request|ACTION_REJECTED/i.test(message)) {
    return new Error('You rejected the wallet confirmation. Nothing was published.');
  }
  if (/insufficient funds|insufficient balance|gas required exceeds/i.test(message)) {
    return new Error('Your wallet needs Sepolia ETH for gas. Fund it from a Sepolia faucet, then try again.');
  }
  return error instanceof Error ? error : new Error(message);
}

/**
 * Self-pay auditor-branch deployment: the user's own wallet sends both
 * transactions (register + policy publish) and pays Sepolia gas. Used when
 * the sponsored relayer is unavailable — e.g. broken relayer keystore on a
 * hosted deployment. No server secrets involved.
 */
export async function selfDeployAuditorBranch(
  ethereumProvider: Eip1193Provider,
  label: string,
  owner: string,
  policy: string,
  onPhase: (phase: SelfDeployPhase) => void,
): Promise<SelfDeployResult> {
  const cleanPolicy = policy.trim().slice(0, MAX_POLICY_CHARS);
  const subname = `${label}.verdict.eth`;
  try {
    onPhase('checking-wallet');
    const provider = new BrowserProvider(ethereumProvider);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== ENSV2_SEPOLIA.chainId) {
      throw new Error('Switch your wallet to the Sepolia network, then deploy again.');
    }
    const signer = await provider.getSigner(owner);
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
      throw new Error('Connected wallet does not match the claiming owner address.');
    }
    if ((await provider.getBalance(signerAddress)) === BigInt(0)) {
      throw new Error('Your wallet needs Sepolia ETH for gas. Fund it from a Sepolia faucet, then try again.');
    }

    const registry = new Contract(ENSV2_SEPOLIA.proxies.verdictRegistry, AGENT_REGISTRY_ABI, signer);
    const id = BigInt(keccak256(toUtf8Bytes(label)));
    if (Number(await registry.getStatus(id)) !== 0) {
      throw new Error('Subname is no longer available.');
    }

    onPhase('registering');
    const expiry = BigInt(Math.floor(Date.now() / 1000)) + SUBNAME_LIFETIME_SECONDS;
    const registerArgs = [label, owner, ZERO_ADDRESS, ENSV2_SEPOLIA.proxies.namespaceResolver, AUDITOR_BRANCH_BITMAP, expiry] as const;
    await registry.register.staticCall(...registerArgs);
    const registerTx = await registry.register(...registerArgs);
    const registerReceipt = await registerTx.wait(1);
    if (!registerReceipt || registerReceipt.status !== 1) {
      throw new Error(`Registration reverted: ${registerTx.hash}`);
    }

    onPhase('publishing-policy');
    const resolver = new Contract(ENSV2_SEPOLIA.proxies.namespaceResolver, AGENT_RESOLVER_ABI, signer);
    const iface = new Interface(AGENT_RESOLVER_ABI);
    const calls = [
      iface.encodeFunctionData('setText', [dnsEncode(subname), 'agent.policy', cleanPolicy]),
      iface.encodeFunctionData('setText', [dnsEncode(subname), 'agent-context', branchContext(subname, owner)]),
    ];
    await resolver.multicall.staticCall(calls);
    const recordsTx = await resolver.multicall(calls);
    const recordsReceipt = await recordsTx.wait(1);
    if (!recordsReceipt || recordsReceipt.status !== 1) {
      throw new Error(`Policy publish reverted: ${recordsTx.hash}`);
    }

    onPhase('confirming');
    return {
      subname,
      owner,
      register: { hash: String(registerTx.hash), blockNumber: Number(registerReceipt.blockNumber) },
      records: { hash: String(recordsTx.hash), blockNumber: Number(recordsReceipt.blockNumber) },
    };
  } catch (error) {
    throw friendly(error);
  }
}

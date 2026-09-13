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
  | 'switching-network'
  | 'registering'
  | 'publishing-policy'
  | 'confirming';

export type SelfDeployResult = {
  subname: string;
  owner: string;
  register: { hash: string; blockNumber: number };
  records: { hash: string; blockNumber: number };
};

const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

/**
 * Bring the wallet onto Sepolia without making the user dig through network
 * settings: request a programmatic switch, adding the chain first when the
 * wallet reports it unknown (EIP-3326 error 4902). Returns true when a switch
 * was attempted — the caller must then drop the pre-switch provider, because
 * ethers caches the old chain on it and every later call throws NETWORK_ERROR
 * (event="changed").
 */
async function ensureSepolia(
  provider: BrowserProvider,
  onPhase: (phase: SelfDeployPhase) => void,
): Promise<boolean> {
  try {
    if (Number((await provider.getNetwork()).chainId) === ENSV2_SEPOLIA.chainId) return false;
  } catch {
    // Detection itself failed — attempt the switch anyway.
  }
  onPhase('switching-network');
  try {
    await provider.send('wallet_switchEthereumChain', [{ chainId: SEPOLIA_CHAIN_ID_HEX }]);
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 4902) {
      await provider.send('wallet_addEthereumChain', [{
        chainId: SEPOLIA_CHAIN_ID_HEX,
        chainName: 'Sepolia',
        nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://rpc.sepolia.org'],
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
      }]);
    } else {
      throw error;
    }
  }
  return true;
}

function friendly(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Transaction failed.';
  if (/user rejected|user denied|rejected the request|ACTION_REJECTED/i.test(message)) {
    return new Error('You rejected the wallet confirmation. Nothing was published.');
  }
  if (/switch.*not supported|method not found|unsupported method|not support switching/i.test(message)) {
    return new Error('Your wallet could not switch networks automatically. Switch to Sepolia manually, then deploy again.');
  }
  if (/network changed|NETWORK_ERROR|underlying network changed/i.test(message)) {
    return new Error('Wallet network changed mid-deploy. Make sure you are on Sepolia, then deploy again — nothing was published.');
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
    let provider = new BrowserProvider(ethereumProvider);
    if (await ensureSepolia(provider, onPhase)) {
      // The pre-switch instance cached the old chain: every later call on it
      // throws NETWORK_ERROR (event="changed"). Start over on Sepolia.
      try {
        await (provider as unknown as { destroy?: () => unknown }).destroy?.();
      } catch {
        // Older ethers without destroy — the fresh instance below is enough.
      }
      provider = new BrowserProvider(ethereumProvider);
      let onSepolia = false;
      try {
        onSepolia = Number((await provider.getNetwork()).chainId) === ENSV2_SEPOLIA.chainId;
      } catch {
        onSepolia = false;
      }
      if (!onSepolia) {
        throw new Error('Switch your wallet to the Sepolia network, then deploy again.');
      }
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

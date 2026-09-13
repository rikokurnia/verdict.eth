import { BrowserProvider, type Eip1193Provider } from 'ethers';
import { mintMessage } from './agent-mint-request.ts';

/** Privy wallets expose an EIP-1193 provider, not a wallet.signMessage method. */
export async function signAgentDeployment(
  ethereumProvider: Eip1193Provider,
  address: string,
  label: string,
  policy: string,
) {
  const provider = new BrowserProvider(ethereumProvider);
  const signer = await provider.getSigner(address);
  const owner = await signer.getAddress();
  const message = mintMessage(label, owner, new Date().toISOString(), policy);
  const signature = await signer.signMessage(message);
  return { owner, message, signature };
}

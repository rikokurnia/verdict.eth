'use client';

import { useEffect, useRef, useState } from 'react';
import { Wallet, X, ArrowUpRight } from 'lucide-react';

type Provider = {
  request: (args: { method: string }) => Promise<unknown>;
  on?: (event: string, cb: (data: unknown) => void) => void;
  removeListener?: (event: string, cb: (data: unknown) => void) => void;
};
export default function WalletConnect() {
  const [account, setAccount] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  async function connect() {
    const p = (window as Window & { ethereum?: Provider }).ethereum;
    if (!p) { setMessage('No browser wallet detected. Open this site in your wallet’s browser, or install an Ethereum browser wallet, then try again.'); return; }
    setPending(true); setMessage('Approve the connection in your wallet.');
    try {
      const accounts = await p.request({ method: 'eth_requestAccounts' });
      const getAccount = (v: unknown) => Array.isArray(v) && typeof v[0] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v[0]) ? v[0] : '';
      const address = getAccount(accounts);
      if (!address) throw new Error('No account was shared.');
      cleanup.current?.();
      const update = (v: unknown) => setAccount(getAccount(v));
      const disconnect = () => setAccount('');
      p.on?.('accountsChanged', update); p.on?.('disconnect', disconnect);
      cleanup.current = () => { p.removeListener?.('accountsChanged', update); p.removeListener?.('disconnect', disconnect); };
      setAccount(address); setMessage('Connected. Your wallet remains in control. The dashboard still uses illustrative data.');
    } catch (e) {
      const code = (e as { code?: number }).code;
      setMessage(code === 4001 ? 'Connection cancelled. You can try again whenever you’re ready.' : code === -32002 ? 'A connection request is already open. Check your wallet.' : 'Could not connect. Unlock your wallet and try again.');
    } finally { setPending(false); }
  }
  function forget() { cleanup.current?.(); cleanup.current = null; setAccount(''); setMessage('Account hidden from this session. To revoke this site’s permission, disconnect it in your wallet.'); }
  return <><button ref={trigger} className="cosmic-wallet" onClick={() => { setMessage(''); dialog.current?.showModal(); }}><Wallet size={16}/><span>{account ? `${account.slice(0,6)}…${account.slice(-4)}` : 'Connect wallet'}</span></button>
    <dialog ref={dialog} className="cosmic-wallet-dialog" aria-labelledby="wallet-title" onClick={e => { if (e.target === dialog.current) dialog.current.close(); }} onClose={() => trigger.current?.focus()}>
      <button className="cosmic-dialog-close" aria-label="Close wallet dialog" onClick={() => dialog.current?.close()}><X size={20}/></button>
      <Wallet size={26}/><h2 id="wallet-title">{account ? 'Your wallet. Your control.' : 'Bring your wallet.'}</h2><p>Connect an Ethereum browser wallet. No signature, transaction, or token approval is requested.</p>
      {account && <code>{account}</code>}
      <button className="cosmic-button" disabled={pending} onClick={account ? forget : connect}>{pending ? 'Check your wallet…' : account ? 'Forget this account' : 'Connect browser wallet'}<ArrowUpRight size={16}/></button>
      <p className="cosmic-wallet-status" role="status">{message}</p>
    </dialog>
  </>;
}

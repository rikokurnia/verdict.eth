'use client';

import { useRef } from 'react';
import { Wallet, X, ArrowUpRight, LogOut, CheckCircle2 } from 'lucide-react';
import { useWallet } from './wallet-context';

export default function WalletConnect() {
  const {
    account,
    isConnected,
    pending,
    message,
    connect,
    disconnect,
    isDialogOpen,
    openDialog,
    closeDialog,
  } = useWallet();

  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={trigger}
        className="cosmic-wallet"
        onClick={openDialog}
        aria-haspopup="dialog"
      >
        <Wallet size={16} />
        <span>
          {isConnected ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
        </span>
      </button>

      {isDialogOpen && (
        <dialog
          open
          className="cosmic-wallet-dialog"
          aria-labelledby="wallet-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <button
            className="cosmic-dialog-close"
            aria-label="Close wallet dialog"
            onClick={closeDialog}
          >
            <X size={20} />
          </button>

          <Wallet size={28} style={{ color: '#70A5FF' }} />
          <h2 id="wallet-title">
            {isConnected ? 'Wallet Connected' : 'Connect to Verdict'}
          </h2>
          <p>
            {isConnected
              ? 'Your wallet session is active across landing page and evidence workspace.'
              : 'Connect an Ethereum browser wallet or use demo mode. No signing or token spending requested.'}
          </p>

          {account && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
              <CheckCircle2 size={16} color="#34D399" />
              <code style={{ fontSize: 13 }}>{account}</code>
            </div>
          )}

          {!isConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
              <button
                className="cosmic-button"
                disabled={pending}
                onClick={() => connect(false)}
              >
                {pending ? 'Check your wallet…' : 'Connect Browser Wallet'}
                <ArrowUpRight size={16} />
              </button>
              <button
                type="button"
                className="cosmic-button secondary"
                style={{
                  background: 'rgba(144, 183, 227, 0.12)',
                  border: '1px solid rgba(144, 183, 227, 0.25)',
                  color: '#EDF4FB',
                }}
                onClick={() => connect(true)}
              >
                Connect Demo Wallet
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
              <button
                className="cosmic-button"
                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5' }}
                onClick={() => {
                  disconnect();
                }}
              >
                <LogOut size={16} />
                Disconnect Session
              </button>
            </div>
          )}

          {message && (
            <p className="cosmic-wallet-status" role="status">
              {message}
            </p>
          )}
        </dialog>
      )}
    </>
  );
}

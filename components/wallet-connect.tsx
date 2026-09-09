'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, LogOut, CheckCircle2, ChevronDown, ExternalLink } from 'lucide-react';
import { useWallet } from './wallet-context';

export default function WalletConnect() {
  const { account, isConnected, ready, connect, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isConnected) {
    return (
      <button
        type="button"
        className="cosmic-wallet"
        onClick={connect}
        disabled={!ready}
        aria-label="Connect wallet with Privy"
      >
        <Wallet size={16} />
        <span>Connect wallet</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="cosmic-wallet"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        style={{
          background: 'rgba(8, 26, 48, 0.85)',
          borderColor: 'rgba(112, 165, 255, 0.4)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#34D399',
            boxShadow: '0 0 8px #34D399',
            marginRight: 4,
          }}
          aria-hidden="true"
        />
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}>
          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connected'}
        </span>
        <ChevronDown size={14} style={{ opacity: 0.7, marginLeft: 2 }} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 230,
            background: 'rgba(6, 18, 34, 0.95)',
            border: '1px solid rgba(163, 209, 255, 0.28)',
            borderRadius: 12,
            padding: 12,
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(112, 165, 255, 0.1)',
            backdropFilter: 'blur(16px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ padding: '4px 6px', borderBottom: '1px solid rgba(163, 209, 255, 0.12)' }}>
            <span style={{ fontSize: 10, letterSpacing: '0.1em', color: '#9DB6CD', textTransform: 'uppercase', display: 'block' }}>
              Connected via Privy
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <CheckCircle2 size={13} color="#34D399" />
              <code style={{ fontSize: 12, color: '#F5F9FD', fontFamily: 'monospace' }}>
                {account.slice(0, 8)}…{account.slice(-6)}
              </code>
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#FCA5A5',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => {
              setMenuOpen(false);
              disconnect();
            }}
          >
            <LogOut size={14} />
            <span>Disconnect Session</span>
          </button>
        </div>
      )}
    </div>
  );
}

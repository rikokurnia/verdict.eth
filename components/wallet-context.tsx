'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (data: unknown) => void) => void;
  removeListener?: (event: string, cb: (data: unknown) => void) => void;
};

interface WalletContextType {
  account: string;
  isConnected: boolean;
  pending: boolean;
  message: string;
  connect: (useMockFallback?: boolean) => Promise<void>;
  disconnect: () => void;
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

const STORAGE_KEY = 'verdict_wallet_account';
const DEMO_FALLBACK_ACCOUNT = '0x71C8407D83F5cD93De2A2D4078864a78De1A2E3b';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const cleanup = useRef<(() => void) | null>(null);

  // Restore saved connection on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^0x[0-9a-fA-F]{40}$/.test(saved)) {
        setAccount(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setMessage('');
  }, []);

  const connect = useCallback(async (useMockFallback = false) => {
    if (typeof window === 'undefined') return;
    const p = (window as Window & { ethereum?: Provider }).ethereum;

    if (!p) {
      if (useMockFallback) {
        setAccount(DEMO_FALLBACK_ACCOUNT);
        try {
          localStorage.setItem(STORAGE_KEY, DEMO_FALLBACK_ACCOUNT);
        } catch {}
        setIsDialogOpen(false);
        setMessage('Connected via Demo Account.');
        return;
      }
      setMessage('No browser wallet detected. Install MetaMask/Rabby or connect with Demo account.');
      return;
    }

    setPending(true);
    setMessage('Approve connection in your wallet...');
    try {
      const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[];
      const address = Array.isArray(accounts) && accounts[0] && /^0x[0-9a-fA-F]{40}$/.test(accounts[0])
        ? accounts[0]
        : '';

      if (!address) throw new Error('No account found');

      cleanup.current?.();
      const update = (v: unknown) => {
        const addr = Array.isArray(v) && v[0] ? String(v[0]) : '';
        setAccount(addr);
        if (addr) {
          try { localStorage.setItem(STORAGE_KEY, addr); } catch {}
        } else {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
      };

      const handleDisconnect = () => {
        setAccount('');
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      };

      p.on?.('accountsChanged', update);
      p.on?.('disconnect', handleDisconnect);
      cleanup.current = () => {
        p.removeListener?.('accountsChanged', update);
        p.removeListener?.('disconnect', handleDisconnect);
      };

      setAccount(address);
      try {
        localStorage.setItem(STORAGE_KEY, address);
      } catch {}
      setIsDialogOpen(false);
      setMessage('Connected successfully.');
    } catch (e) {
      const code = (e as { code?: number })?.code;
      if (code === 4001) {
        setMessage('Connection cancelled. You can try again whenever you’re ready.');
      } else if (code === -32002) {
        setMessage('A connection request is already open. Check your wallet.');
      } else {
        setMessage('Could not connect. Unlock your wallet and try again.');
      }
    } finally {
      setPending(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    setAccount('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setIsDialogOpen(false);
    setMessage('');
    // Automatically redirect to landing page
    router.push('/');
  }, [router]);

  return (
    <WalletContext.Provider
      value={{
        account,
        isConnected: Boolean(account),
        pending,
        message,
        connect,
        disconnect,
        isDialogOpen,
        openDialog,
        closeDialog,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}

'use client';

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrivyProvider, usePrivy, useWallets, useConnectWallet } from '@privy-io/react-auth';

interface WalletContextType {
  account: string;
  isConnected: boolean;
  ready: boolean;
  connect: () => void;
  disconnect: () => void;
  openDialog: () => void;
  closeDialog: () => void;
  isDialogOpen: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

function InnerWalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { connectWallet } = useConnectWallet();
  const router = useRouter();

  // Persistent user preference for manual disconnection
  const [manuallyDisconnected, setManuallyDisconnected] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('verdict_wallet_disconnected') === 'true';
    }
    return false;
  });

  // Connected state: only when not manually disconnected, and either external wallet is connected or authenticated session exists
  const isConnected = useMemo(() => {
    if (manuallyDisconnected) return false;
    return Boolean((wallets && wallets.length > 0 && !!wallets[0]?.address) || authenticated);
  }, [manuallyDisconnected, wallets, authenticated]);

  // Primary address resolution from connected external wallet or Privy session:
  const account = useMemo(() => {
    if (manuallyDisconnected) return '';
    if (wallets && wallets.length > 0 && wallets[0]?.address) {
      return wallets[0].address;
    }
    if (user?.wallet?.address) {
      return user.wallet.address;
    }
    const walletAccount = user?.linkedAccounts?.find(
      (a) => a.type === 'wallet' && 'address' in a && typeof a.address === 'string'
    ) as { address: string } | undefined;
    if (walletAccount?.address) {
      return walletAccount.address;
    }
    if (user?.id) {
      const clean = user.id.replace(/[^0-9a-fA-F]/g, '');
      return `0x${clean.padEnd(40, '0').slice(0, 40)}`;
    }
    return '';
  }, [manuallyDisconnected, wallets, user]);

  const [pendingConnect, setPendingConnect] = useState(false);

  useEffect(() => {
    if (ready && pendingConnect) {
      setPendingConnect(false);
      setManuallyDisconnected(false);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('verdict_wallet_disconnected');
      }
      connectWallet();
    }
  }, [ready, pendingConnect, connectWallet]);

  // 1-click external wallet connection without requiring secondary SIWE signature
  const connect = useCallback(() => {
    setManuallyDisconnected(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('verdict_wallet_disconnected');
    }
    if (!ready) {
      setPendingConnect(true);
      return;
    }
    connectWallet();
  }, [ready, connectWallet]);

  const disconnect = useCallback(async () => {
    setManuallyDisconnected(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('verdict_wallet_disconnected', 'true');
    }
    try {
      if (wallets && wallets.length > 0) {
        await Promise.allSettled(
          wallets.map(async (w) => {
            try {
              await w.disconnect();
            } catch {}
          })
        );
      }
      if (authenticated) {
        await logout();
      }
    } catch {
      // ignore
    }
  }, [wallets, authenticated, logout]);

  return (
    <WalletContext.Provider
      value={{
        account,
        isConnected,
        ready,
        connect,
        disconnect,
        openDialog: connect,
        closeDialog: () => {},
        isDialogOpen: false,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmttlm9oh02gx0djvrs1cqsnk';

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#70A5FF',
          showWalletLoginFirst: true,
          logo: '/icon.svg',
          walletList: ['detected_wallets', 'metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect'],
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
          },
        },
      }}
    >
      <InnerWalletBridge>{children}</InnerWalletBridge>
    </PrivyProvider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}

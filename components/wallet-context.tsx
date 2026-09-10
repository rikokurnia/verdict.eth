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

  // Connected state: either external wallet connected via 1-click connectWallet, or authenticated session
  const isConnected = useMemo(() => {
    return Boolean((wallets && wallets.length > 0 && !!wallets[0]?.address) || authenticated);
  }, [wallets, authenticated]);

  // Primary address resolution from connected external wallet or Privy session:
  const account = useMemo(() => {
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
  }, [wallets, user]);

  const [pendingConnect, setPendingConnect] = useState(false);

  useEffect(() => {
    if (ready && pendingConnect) {
      setPendingConnect(false);
      connectWallet();
    }
  }, [ready, pendingConnect, connectWallet]);

  // 1-click external wallet connection without requiring secondary SIWE signature
  const connect = useCallback(() => {
    if (!ready) {
      setPendingConnect(true);
      return;
    }
    connectWallet();
  }, [ready, connectWallet]);

  const disconnect = useCallback(async () => {
    try {
      if (wallets && wallets.length > 0) {
        for (const w of wallets) {
          try {
            w.disconnect();
          } catch {}
        }
      }
      await logout();
    } catch {
      // ignore
    }
    router.push('/');
  }, [wallets, logout, router]);

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

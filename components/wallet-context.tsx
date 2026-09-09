'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';

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
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();

  // Primary address resolution from Privy session:
  const account = useMemo(() => {
    if (!authenticated || !user) return '';
    if (wallets && wallets.length > 0 && wallets[0]?.address) {
      return wallets[0].address;
    }
    if (user.wallet?.address) {
      return user.wallet.address;
    }
    // Check linked accounts for wallet
    const walletAccount = user.linkedAccounts?.find(
      (a) => a.type === 'wallet' && 'address' in a && typeof a.address === 'string'
    ) as { address: string } | undefined;
    if (walletAccount?.address) {
      return walletAccount.address;
    }
    // Fallback if authenticated via social/email without explicit wallet
    if (user.id) {
      const clean = user.id.replace(/[^0-9a-fA-F]/g, '');
      return `0x${clean.padEnd(40, '0').slice(0, 40)}`;
    }
    return '';
  }, [authenticated, user, wallets]);

  const connect = useCallback(() => {
    if (!ready) return;
    login();
  }, [ready, login]);

  const disconnect = useCallback(async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    router.push('/');
  }, [logout, router]);

  return (
    <WalletContext.Provider
      value={{
        account,
        isConnected: authenticated,
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
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
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

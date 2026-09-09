import type { Metadata } from 'next';
import '@fontsource-variable/archivo';
import '@fontsource-variable/archivo-narrow';
import '@fontsource-variable/inter';
import './scrollcraft.css';
import './globals.css';
import { WalletProvider } from '@/components/wallet-context';

export const metadata: Metadata = {
  title: 'Verdict | One name. Every reason.',
  description: 'An ENS-native evidence layer for tokenized assets. Discover independent authorities, inspect the sources, and understand the decision.',
  openGraph: { title: 'Verdict | One name. Every reason.', description: 'Tokenized assets, with the evidence attached.', type: 'website' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Clock3,
  Bot,
  Wallet,
  LogOut,
} from 'lucide-react';
import { VerdictMark } from '@/components/marks';
import Dock from '@/components/Dock';
import { useWallet } from '@/components/wallet-context';

const ROUTES = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/lifecycle', label: 'Lifecycle', icon: Clock3 },
];

export function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="v-page-head">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [compact, setCompact] = useState(false);
  const { account, isConnected, disconnect, openDialog } = useWallet();

  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const touch = matchMedia('(max-width: 768px), (hover: none)');
    const sync = () => {
      setReduced(motion.matches);
      setCompact(touch.matches);
    };
    sync();
    motion.addEventListener('change', sync);
    touch.addEventListener('change', sync);
    return () => {
      motion.removeEventListener('change', sync);
      touch.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduced) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [reduced]);

  const current = ROUTES.find(
    (r) => pathname === r.href || (r.href !== '/dashboard' && pathname.startsWith(r.href + '/')),
  );

  return (
    <div className="v-app v-wave-workspace">
      {/* Background Video with Cosmic Mountains & Ambient Gradients */}
      <div className="v-video-background" aria-hidden="true">
        <video
          ref={videoRef}
          className="v-bg-video"
          src="/assets/dashboard-bg.mp4"
          poster="/assets/dashboard-bg-poster.webp"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
        <div className="v-video-overlay" />
      </div>

      <a href="#v-main" className="v-skip">
        Skip to content
      </a>

      <header className="v-workspace-header">
        <Link href="/" className="v-brand" aria-label="Verdict home">
          <VerdictMark className="v-brand-symbol" />
          <span className="v-brand-text">Verdict</span>
        </Link>

        <div className="v-workspace-location">
          <span>WORKSPACE</span>
          <span className="v-location-divider">/</span>
          <span className="v-location-current">{current?.label ?? 'Overview'}</span>
        </div>

        <div className="v-workspace-actions">
          {isConnected ? (
            <div className="v-wallet-badge">
              <span className="v-wallet-dot" aria-hidden="true" />
              <span className="v-wallet-addr">{account.slice(0, 6)}…{account.slice(-4)}</span>
              <button
                type="button"
                className="v-wallet-disconnect-btn"
                onClick={disconnect}
                title="Disconnect session & return to landing"
              >
                <LogOut size={13} />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="v-wallet-connect-btn"
              onClick={openDialog}
            >
              <Wallet size={14} />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </header>

      <main id="v-main" className="v-content" tabIndex={-1}>
        {children}
      </main>

      <footer className="v-workspace-footer">
        <div className="v-footer-left">
          <span className="v-footer-badge">ONE NAME. EVERY REASON.</span>
          <span>Canonical ENS evidence layer for tokenized assets</span>
        </div>
        <div className="v-footer-right">
          <Link href="/" className="v-footer-link">
            About Verdict
          </Link>
          <span className="v-footer-disclaimer">Illustrative data. No live onchain verification.</span>
        </div>
      </footer>

      <div className="v-dock-shell">
        <Dock
          items={ROUTES.map((r) => ({
            href: r.href,
            label: r.label,
            icon: <r.icon size={20} strokeWidth={1.6} aria-hidden="true" />,
            current:
              pathname === r.href || (r.href !== '/dashboard' && pathname.startsWith(r.href + '/')),
            onClick: undefined,
            className: '',
          }))}
          baseItemSize={44}
          magnification={compact ? 44 : 60}
          panelHeight={58}
          dockHeight={88}
          distance={120}
        />
      </div>
    </div>
  );
}

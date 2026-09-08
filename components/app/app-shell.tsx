'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Diamond,
  KeyRound,
  Clock3,
  Bot,
  Activity,
  TerminalSquare,
  Settings,
  Pause,
  Play,
  ArrowUpRight,
} from 'lucide-react';
import { VerdictMark } from '@/components/marks';
import Dock from '@/components/Dock';

const ROUTES = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/assets', label: 'Assets', icon: Diamond },
  { href: '/authorities', label: 'Authorities', icon: KeyRound },
  { href: '/lifecycle', label: 'Lifecycle', icon: Clock3 },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/debug', label: 'Resolver', icon: TerminalSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
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
  const [paused, setPaused] = useState(false);

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
    try {
      setPaused(localStorage.getItem('verdict-video-paused') === 'true');
    } catch {}
    return () => {
      motion.removeEventListener('change', sync);
      touch.removeEventListener('change', sync);
    };
  }, []);

  const motionOff = reduced || paused;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (motionOff) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [motionOff]);

  const current = ROUTES.find(
    (r) => pathname === r.href || (r.href !== '/dashboard' && pathname.startsWith(r.href + '/')),
  );

  function toggleMotion() {
    setPaused((p) => {
      const next = !p;
      try {
        localStorage.setItem('verdict-video-paused', String(next));
      } catch {}
      return next;
    });
  }

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
          <span className="v-terminal-tag">TRUST TERMINAL</span>
        </Link>

        <div className="v-workspace-location">
          <span>WORKSPACE</span>
          <span className="v-location-divider">/</span>
          <span className="v-location-current">{current?.label ?? 'Asset Detail'}</span>
        </div>

        <div className="v-workspace-actions">
          <span className="v-network-badge">
            <span className="v-network-pulse" aria-hidden="true" />
            Sepolia <small>DEMO</small>
          </span>

          <button
            className="v-motion-toggle"
            onClick={toggleMotion}
            disabled={reduced}
            aria-label={
              reduced
                ? 'Motion disabled by system preference'
                : paused
                ? 'Resume background video'
                : 'Pause background video'
            }
            title={reduced ? 'Reduced motion enabled' : paused ? 'Resume video' : 'Pause video'}
            aria-pressed={motionOff}
          >
            {motionOff ? <Play size={14} /> : <Pause size={14} />}
            <span className="v-motion-label">{motionOff ? 'Video Paused' : 'Video Active'}</span>
          </button>

          <Link href="/" className="v-header-link">
            Landing <ArrowUpRight size={13} />
          </Link>
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
            About Verdict <ArrowUpRight size={13} />
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

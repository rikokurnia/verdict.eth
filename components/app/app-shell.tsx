'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, Diamond, KeyRound, Clock3, Bot, Activity, TerminalSquare, Settings, Menu, X,
} from 'lucide-react';

const MAIN = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/assets', label: 'Assets', icon: Diamond },
  { href: '/authorities', label: 'Authorities', icon: KeyRound },
  { href: '/lifecycle', label: 'Lifecycle', icon: Clock3 },
  { href: '/agents', label: 'Agents', icon: Bot },
];
const OPS = [
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/debug', label: 'Resolver Debug', icon: TerminalSquare },
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open ]);
  return (
    <div className={'v-app' + (open ? ' nav-open' : '')}>
      <a href="#v-main" className="v-skip" style={{ position: 'fixed', top: -100 }}>Skip to content</a>
      {open && <button className="v-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside className="v-sidebar" aria-label="Dashboard navigation">
        <Link href="/dashboard" className="v-brand" onClick={() => setOpen(false)}>
          <span className="v-brand-mark">V</span>Verdict
        </Link>
        <nav className="v-nav">
          {MAIN.map((i) => (
            <Link key={i.href} href={i.href} aria-current={pathname === i.href || pathname?.startsWith(i.href + '/') ? 'page' : undefined} onClick={() => setOpen(false)}>
              <i.icon />{i.label}
            </Link>
          ))}
          <div className="v-nav-label">Operations</div>
          {OPS.map((i) => (
            <Link key={i.href} href={i.href} aria-current={pathname === i.href ? 'page' : undefined} onClick={() => setOpen(false)}>
              <i.icon />{i.label}
            </Link>
          ))}
        </nav>
        <div className="v-side-foot">
          <span className="v-net"><i />Network: Sepolia</span>
          <Link href="/settings" style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', padding: '4px 10px' }} onClick={() => setOpen(false)}>
            <Settings size={16} />Settings
          </Link>
        </div>
      </aside>
      <div className="v-main">
        <header className="v-topbar">
          <button className="v-menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div>
            <div className="v-crumbs">verdict.eth · Sepolia</div>
            <h1>Trust terminal</h1>
          </div>
          <div className="v-top-actions">
            <input className="v-search" placeholder="Search ENS name, asset, ticker…  ⌘K" aria-label="Search assets" />
          </div>
        </header>
        <main id="v-main" className="v-content">{children}</main>
      </div>
    </div>
  );
}

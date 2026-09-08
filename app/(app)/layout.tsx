import type { ReactNode } from 'react';
import AppShell from '@/components/app/app-shell';
import './app-shell.css';
import './wave-workspace.css';

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

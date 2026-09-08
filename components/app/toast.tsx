'use client';

import { useCallback, useState } from 'react';

export type ToastKind = 'pass' | 'review' | 'blocked' | 'info';
export type Toast = { id: number; kind: ToastKind; title: string; body: string };

let nextId = 1;
const KIND_CLS: Record<ToastKind, string> = {
  pass: 'v-toast-pass', review: 'v-toast-review', blocked: 'v-toast-blocked', info: '',
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, title: string, body: string) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-2), { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return { toasts, push };
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="v-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className={'v-toast ' + KIND_CLS[t.kind]} key={t.id}>
          <strong>{t.title}</strong>
          <span>{t.body}</span>
        </div>
      ))}
    </div>
  );
}

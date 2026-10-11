import React from 'react';
import { Logo } from '../../ui';

/** Split layout: form on the left, brand panel on the right (desktop only). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-surface">
      <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-16">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[360px]">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-fg-3">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <p className="text-sm text-fg-4">© {new Date().getFullYear()} Hali e-shop · Malé, Maldives</p>
      </div>
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-navy-900 lg:flex">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(60%_50%_at_70%_20%,rgba(235,58,65,0.35),transparent)]" />
        <div className="relative max-w-md px-10 text-center">
          <Logo className="mx-auto h-auto w-80" />
          <p className="mt-8 text-lg font-medium text-white">Orders, stock and deliveries in one place.</p>
          <p className="mt-2 text-sm text-navy-200">
            Instagram, Viber, WhatsApp and SMS orders · purchase batches · courier handovers.
          </p>
        </div>
      </div>
    </div>
  );
}

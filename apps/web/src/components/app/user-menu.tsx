'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/lib/auth-client';

export function UserMenu({ email, operatorId }: { email: string; operatorId: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex items-center gap-2 rounded-full border border-line-strong bg-raised py-1 pr-3 pl-1 text-sm text-ink transition-colors hover:bg-hover"
        aria-label="Kontomeny"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <UserRound className="size-3.5" aria-hidden />
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{email}</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-[var(--radius-control)] border border-line bg-raised p-1 shadow-overlay"
        >
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium text-ink">{email}</p>
            <p className="mt-0.5 font-mono text-xs text-subtle">Konto-id {operatorId}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link
              href="/profil"
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-ink outline-none data-[highlighted]:bg-hover"
            >
              <Settings className="size-4 text-subtle" aria-hidden />
              Profil och CV
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-ink outline-none data-[highlighted]:bg-hover"
          >
            <LogOut className="size-4 text-subtle" aria-hidden />
            {signingOut ? 'Loggar ut…' : 'Logga ut'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

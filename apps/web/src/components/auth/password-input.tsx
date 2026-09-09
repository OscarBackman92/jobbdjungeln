'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui';

/**
 * A password field that can be revealed.
 *
 * Hiding a password protects against someone reading over a shoulder, which is
 * rarely the actual risk; typos on a phone keyboard are. So it can be shown.
 */
export function PasswordInput(props: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Dölj lösenordet' : 'Visa lösenordet'}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-subtle transition-colors hover:text-ink"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </span>
  );
}

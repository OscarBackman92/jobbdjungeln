'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui';

/**
 * Client-side providers.
 *
 * The query client is created inside state rather than at module scope: on the
 * server a module-level client would be shared between requests, and one user's
 * cached data could be handed to another.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Server components already deliver fresh data on navigation; this
            // stops the client refetching the same thing a moment later.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250} skipDelayDuration={0}>
          {children}
        </TooltipProvider>
        <Toaster
          position="bottom-center"
          richColors
          closeButton
          toastOptions={{
            className: 'text-sm',
            classNames: {
              closeButton: '!left-auto !right-1 !top-1',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

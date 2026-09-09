'use client';

import { SALARY_CLAIM_MAX_LENGTH } from '@jobbdjungeln/core';
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from '@/components/ui';

/**
 * Asked once, at the moment of applying.
 *
 * The salary expectation is worth recording because it is impossible to
 * reconstruct later — and it is the number people most often wish they had
 * written down when the recruiter finally calls.
 */
export function SalaryClaimDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (claim: string) => void;
}) {
  const [claim, setClaim] = useState('');
  const [error, setError] = useState<string | undefined>();

  function submit() {
    if (!claim.trim()) {
      setError('Skriv vad du begärde, även om det var ungefärligt.');
      return;
    }
    setError(undefined);
    onSubmit(claim.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[min(28rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Vad begärde du i lön?</DialogTitle>
          <DialogDescription>
            Sparas på ansökan så du vet vad du sagt när rekryteraren hör av sig.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Löneanspråk" error={error} required>
            {(props) => (
              <Input
                {...props}
                value={claim}
                maxLength={SALARY_CLAIM_MAX_LENGTH}
                placeholder="t.ex. 45 000 kr/mån"
                autoFocus
                onChange={(event) => setClaim(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && submit()}
              />
            )}
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button variant="primary" loading={pending} onClick={submit}>
            Spara och flytta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import {
  isValidSalaryClaim,
  SALARY_CLAIM_MAX_LENGTH,
  SALARY_CLAIM_NONE,
} from '@jobbdjungeln/core';
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
 * Optional — many ads never ask for a number. Skip with {@link SALARY_CLAIM_NONE}
 * so the field is never filled with garbage just to get past the prompt.
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

  function submit(value: string = claim) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Ange ett belopp, eller välj „Angav ingen lön”.');
      return;
    }
    if (!isValidSalaryClaim(trimmed)) {
      setError('Ange ett belopp med siffror, till exempel 45 000 kr/mån.');
      return;
    }
    setError(undefined);
    onSubmit(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[min(28rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Vad begärde du i lön?</DialogTitle>
          <DialogDescription>
            Frivilligt — sparas på ansökan så du vet vad du sagt när rekryteraren hör av sig.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Löneanspråk" error={error} hint="Hoppa över om annonsen inte frågade.">
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
          <Button variant="ghost" disabled={pending} onClick={() => submit(SALARY_CLAIM_NONE)}>
            Angav ingen lön
          </Button>
          <Button variant="primary" loading={pending} onClick={() => submit()}>
            Spara och flytta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

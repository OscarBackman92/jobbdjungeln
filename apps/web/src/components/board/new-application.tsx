'use client';

import {
  APPLICATION_SOURCES,
  SOURCE_LABELS,
  type Status,
  stageForStatus,
  today as todayIso,
} from '@jobbdjungeln/core';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorNote,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { createApplicationAction } from '@/server/actions/applications';

/**
 * Add a row by hand.
 *
 * Most rows arrive from the ad search, but plenty of applications start
 * somewhere the search cannot reach — a tip, a LinkedIn post, an e-mail — and
 * those have to be as easy to record, or the tracker stops being complete.
 */
export function NewApplicationButton({
  defaultStatus,
  label,
}: {
  defaultStatus: Status;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const needsSalary = stageForStatus(defaultStatus) !== 'bevakad';

  function submit(formData: FormData) {
    setError(undefined);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createApplicationAction({
        company: String(formData.get('company') ?? ''),
        title: String(formData.get('title') ?? ''),
        location: String(formData.get('location') ?? ''),
        status: defaultStatus,
        source: (formData.get('source') as string) || undefined,
        adUrl: String(formData.get('adUrl') ?? ''),
        deadline: String(formData.get('deadline') ?? ''),
        appliedAt: String(formData.get('appliedAt') ?? ''),
        salaryClaim: String(formData.get('salaryClaim') ?? ''),
      });

      if (result.ok) {
        toast.success('Tillagd');
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {label}
      </Button>

      <DialogContent className="sm:w-[min(34rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Bara arbetsgivare och roll är obligatoriskt. Resten kan fyllas i senare.
          </DialogDescription>
        </DialogHeader>

        <form action={submit}>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {error && Object.keys(fieldErrors).length === 0 ? (
              <div className="sm:col-span-2">
                <ErrorNote description={error} />
              </div>
            ) : null}

            <Field label="Arbetsgivare" required error={fieldErrors.company}>
              {(props) => <Input {...props} name="company" autoFocus required />}
            </Field>
            <Field label="Roll" required error={fieldErrors.title}>
              {(props) => <Input {...props} name="title" required />}
            </Field>
            <Field label="Ort">{(props) => <Input {...props} name="location" />}</Field>
            <Field label="Hittad via">
              {(props) => (
                <Select name="source">
                  <SelectTrigger {...props}>
                    <SelectValue placeholder="Välj" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {SOURCE_LABELS[source]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field
              label="Länk till annonsen"
              className="sm:col-span-2"
              error={fieldErrors.adUrl}
            >
              {(props) => <Input {...props} name="adUrl" type="url" placeholder="https://" />}
            </Field>

            {needsSalary ? (
              <>
                <Field label="Sökt datum">
                  {(props) => (
                    <Input {...props} name="appliedAt" type="date" defaultValue={todayIso()} />
                  )}
                </Field>
                <Field
                  label="Löneanspråk"
                  required
                  error={fieldErrors.salaryClaim}
                  hint="Vad du begärde — bra att ha när rekryteraren ringer."
                >
                  {(props) => (
                    <Input {...props} name="salaryClaim" placeholder="t.ex. 45 000 kr/mån" />
                  )}
                </Field>
              </>
            ) : (
              <Field label="Sista ansökningsdag" className="sm:col-span-2">
                {(props) => <Input {...props} name="deadline" type="date" />}
              </Field>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Spara
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import {
  APPLICATION_SOURCES,
  formatLongDate,
  isSafeExternalUrl,
  SOURCE_LABELS,
  type Status,
  today as todayIso,
} from '@jobbdjungeln/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { StatusMenu } from '@/components/board/status-menu';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
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
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import {
  addEventAction,
  deleteApplicationAction,
  updateApplicationAction,
} from '@/server/actions/applications';

export interface ApplicationDetail {
  id: string;
  company: string;
  title: string;
  location: string;
  status: Status;
  source: string | null;
  adUrl: string;
  applyUrl: string;
  adDescription: string;
  appliedAt: string | null;
  deadline: string | null;
  applyBy: string | null;
  nextActionAt: string | null;
  salaryClaim: string;
  contactName: string;
  contactInfo: string;
  notes: string;
  events: Array<{
    id: string;
    occurredAt: string;
    note: string;
    eventType: string;
    origin: string;
  }>;
}

const EVENT_TYPES = [
  { value: 'anteckning', label: 'Anteckning' },
  { value: 'samtal', label: 'Telefonsamtal' },
  { value: 'mejl', label: 'Mejl' },
  { value: 'intervju', label: 'Intervju' },
  { value: 'test', label: 'Test / arbetsprov' },
  { value: 'referens', label: 'Referenstagning' },
] as const;

async function fetchDetail(id: string): Promise<ApplicationDetail> {
  const response = await fetch(`/api/applications/${id}`);
  if (!response.ok) throw new Error('Kunde inte hämta ansökan.');
  return response.json();
}

/**
 * The detail sheet.
 *
 * Everything about one row in one place: the editable fields, the ad text it was
 * saved from, and the timeline. Loaded on open rather than with the board, so a
 * list of two hundred rows does not carry two hundred ad descriptions with it.
 */
export function ApplicationSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['application', id],
    queryFn: () => fetchDetail(id ?? ''),
    enabled: id !== null,
  });

  function save(formData: FormData) {
    if (!id) return;
    setError(undefined);
    startTransition(async () => {
      const result = await updateApplicationAction({
        id,
        company: String(formData.get('company') ?? ''),
        title: String(formData.get('title') ?? ''),
        location: String(formData.get('location') ?? ''),
        source: (formData.get('source') as string) || undefined,
        adUrl: String(formData.get('adUrl') ?? ''),
        appliedAt: String(formData.get('appliedAt') ?? ''),
        deadline: String(formData.get('deadline') ?? ''),
        applyBy: String(formData.get('applyBy') ?? ''),
        nextActionAt: String(formData.get('nextActionAt') ?? ''),
        salaryClaim: String(formData.get('salaryClaim') ?? ''),
        contactName: String(formData.get('contactName') ?? ''),
        contactInfo: String(formData.get('contactInfo') ?? ''),
        notes: String(formData.get('notes') ?? ''),
      });
      if (result.ok) {
        toast.success('Sparat');
        await queryClient.invalidateQueries({ queryKey: ['application', id] });
      } else {
        setError(result.error);
      }
    });
  }

  function addNote(formData: FormData) {
    if (!id) return;
    startTransition(async () => {
      const result = await addEventAction({
        applicationId: id,
        occurredAt: String(formData.get('occurredAt') ?? todayIso()),
        note: String(formData.get('note') ?? ''),
        eventType: String(formData.get('eventType') ?? 'anteckning'),
      });
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: ['application', id] });
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    if (!id) return;
    if (!confirm('Ta bort den här raden permanent? Det går inte att ångra.')) return;
    startTransition(async () => {
      const result = await deleteApplicationAction(id);
      if (result.ok) {
        toast.success('Raden är borttagen');
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:w-[min(46rem,calc(100vw-2rem))]">
        {isPending ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError || !data ? (
          <div className="p-5">
            <ErrorNote
              description="Kunde inte hämta ansökan."
              action={
                <Button size="sm" onClick={() => void refetch()}>
                  Försök igen
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{data.title}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-sm text-muted">{data.company}</span>
                <StatusMenu id={data.id} status={data.status} salaryClaim={data.salaryClaim} />
                {isSafeExternalUrl(data.applyUrl || data.adUrl) ? (
                  <a
                    href={data.applyUrl || data.adUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] text-brand-text hover:underline"
                  >
                    Annonsen
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            </DialogHeader>

            <Tabs defaultValue="detaljer" className="flex min-h-0 flex-1 flex-col">
              <div className="px-5 pt-3">
                <TabsList>
                  <TabsTrigger value="detaljer">Detaljer</TabsTrigger>
                  <TabsTrigger value="tidslinje">Tidslinje ({data.events.length})</TabsTrigger>
                  {data.adDescription ? (
                    <TabsTrigger value="annons">Annonstext</TabsTrigger>
                  ) : null}
                </TabsList>
              </div>

              <TabsContent value="detaljer" className="flex min-h-0 flex-1 flex-col">
                <form action={save} className="flex min-h-0 flex-1 flex-col">
                  <DialogBody className="grid gap-4 sm:grid-cols-2">
                    {error ? (
                      <div className="sm:col-span-2">
                        <ErrorNote description={error} />
                      </div>
                    ) : null}

                    <Field label="Arbetsgivare" required>
                      {(props) => (
                        <Input {...props} name="company" defaultValue={data.company} required />
                      )}
                    </Field>
                    <Field label="Roll" required>
                      {(props) => (
                        <Input {...props} name="title" defaultValue={data.title} required />
                      )}
                    </Field>
                    <Field label="Ort">
                      {(props) => (
                        <Input {...props} name="location" defaultValue={data.location} />
                      )}
                    </Field>
                    <Field label="Hittad via">
                      {(props) => (
                        <Select name="source" defaultValue={data.source ?? undefined}>
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
                    <Field label="Länk till annonsen" className="sm:col-span-2">
                      {(props) => (
                        <Input {...props} name="adUrl" type="url" defaultValue={data.adUrl} />
                      )}
                    </Field>

                    <Field label="Sökt datum">
                      {(props) => (
                        <Input
                          {...props}
                          name="appliedAt"
                          type="date"
                          defaultValue={data.appliedAt ?? ''}
                        />
                      )}
                    </Field>
                    <Field label="Sista ansökningsdag">
                      {(props) => (
                        <Input
                          {...props}
                          name="deadline"
                          type="date"
                          defaultValue={data.deadline ?? ''}
                        />
                      )}
                    </Field>
                    <Field label="Sök senast" hint="Din egen påminnelse.">
                      {(props) => (
                        <Input
                          {...props}
                          name="applyBy"
                          type="date"
                          defaultValue={data.applyBy ?? ''}
                        />
                      )}
                    </Field>
                    <Field label="Följ upp" hint="Dyker upp på Översikt.">
                      {(props) => (
                        <Input
                          {...props}
                          name="nextActionAt"
                          type="date"
                          defaultValue={data.nextActionAt ?? ''}
                        />
                      )}
                    </Field>

                    <Field label="Löneanspråk">
                      {(props) => (
                        <Input {...props} name="salaryClaim" defaultValue={data.salaryClaim} />
                      )}
                    </Field>
                    <Field label="Kontaktperson">
                      {(props) => (
                        <Input {...props} name="contactName" defaultValue={data.contactName} />
                      )}
                    </Field>
                    <Field label="Kontaktuppgift" className="sm:col-span-2">
                      {(props) => (
                        <Input {...props} name="contactInfo" defaultValue={data.contactInfo} />
                      )}
                    </Field>
                    <Field label="Anteckningar" className="sm:col-span-2">
                      {(props) => (
                        <Textarea {...props} name="notes" rows={4} defaultValue={data.notes} />
                      )}
                    </Field>
                  </DialogBody>

                  <DialogFooter>
                    <Button type="button" variant="danger" onClick={remove} disabled={pending}>
                      <Trash2 aria-hidden />
                      Ta bort
                    </Button>
                    <Button type="submit" variant="primary" loading={pending}>
                      Spara
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              <TabsContent value="tidslinje" className="flex min-h-0 flex-1 flex-col">
                <DialogBody className="flex flex-col gap-4">
                  <form
                    action={addNote}
                    className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-sunken p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                      <Input name="note" placeholder="Vad hände?" required maxLength={500} />
                      <Input name="occurredAt" type="date" defaultValue={todayIso()} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Select name="eventType" defaultValue="anteckning">
                        <SelectTrigger className="h-9 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="submit" size="sm" variant="primary" loading={pending}>
                        <Plus aria-hidden />
                        Lägg till
                      </Button>
                    </div>
                  </form>

                  {data.events.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted">
                      Inget loggat ännu. Statusbyten hamnar här automatiskt.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-0 border-l border-line pl-4">
                      {data.events.map((event) => (
                        <li key={event.id} className="relative py-2">
                          <span
                            className="absolute top-3.5 -left-[1.3125rem] size-2 rounded-full bg-brand ring-2 ring-[var(--surface-raised)]"
                            aria-hidden
                          />
                          <p className="text-sm text-ink">{event.note}</p>
                          <p className="mt-0.5 text-[13px] text-subtle">
                            {formatLongDate(event.occurredAt)}
                            {event.origin === 'auto' ? ' · automatiskt' : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </DialogBody>
              </TabsContent>

              {data.adDescription ? (
                <TabsContent value="annons" className="flex min-h-0 flex-1 flex-col">
                  <DialogBody>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
                      {data.adDescription}
                    </p>
                  </DialogBody>
                </TabsContent>
              ) : null}
            </Tabs>
          </>
        )}
        {pending ? (
          <span className="sr-only" aria-live="polite">
            <Loader2 aria-hidden /> Sparar…
          </span>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

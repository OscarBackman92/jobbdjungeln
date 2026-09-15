'use client';

import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPES,
  clipboardText,
  daysBetween,
  formatShortDate,
  PERIOD_STATUS_LABELS,
  type PeriodStatus,
  plural,
  type ReportRow,
  today as todayIso,
} from '@jobbdjungeln/core';
import { AlertTriangle, Check, ClipboardCopy, Download, Plus, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import { updateApplicationAction } from '@/server/actions/applications';
import {
  reopenPeriodAction,
  saveActivityAction,
  submitPeriodAction,
  toggleReportExclusionAction,
} from '@/server/actions/report';

/** Enough of a period to render it in the month picker. */
export interface PeriodOption {
  key: string;
  label: string;
  status: PeriodStatus;
}

export interface PeriodView extends PeriodOption {
  windowOpens: string;
  windowCloses: string;
  jobCount: number;
  activityCount: number;
  missingOccupationCount: number;
  banner: string | null;
  rows: ReportRow[];
  excludedRows: ReportRow[];
}

const STATUS_TONES: Record<PeriodStatus, 'neutral' | 'brand' | 'positive' | 'warning'> = {
  pagaende: 'neutral',
  klar: 'brand',
  rapporterad: 'positive',
  forsenad: 'warning',
};

function rowDomId(row: ReportRow): string {
  return `report-row-${row.kind}-${row.id}`;
}

/**
 * The monthly activity report.
 *
 * Everything is already in the tracker, so this view only assembles it: one
 * clipboard button that hands over the rows in the order the AF form asks for
 * them, and a CSV for anyone who would rather keep their own copy.
 */
export function ReportView({
  period,
  periods,
}: {
  period: PeriodView;
  periods: PeriodOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addingActivity, setAddingActivity] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submitted = period.status === 'rapporterad';
  const windowOpen = period.status === 'klar' || period.status === 'forsenad';
  const today = todayIso();
  const daysLeft = daysBetween(today, period.windowCloses);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  function focusRow(row: ReportRow) {
    const id = rowDomId(row);
    setHighlightId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2500);
  }

  const firstMissing = period.rows.find((row) => row.missingOccupation) ?? null;

  async function copyRows() {
    try {
      await navigator.clipboard.writeText(clipboardText(period.rows));
      toast.success(plural(period.rows.length, 'rad kopierad', 'rader kopierade'));
    } catch {
      toast.error('Webbläsaren tillät inte kopiering. Ladda ner CSV i stället.');
    }
  }

  function submit() {
    if (!submitted && !windowOpen) return;
    startTransition(async () => {
      const result = submitted
        ? await reopenPeriodAction(period.key)
        : await submitPeriodAction(period.key);
      if (result.ok) {
        toast.success(
          submitted ? 'Månaden är öppnad igen' : 'Månaden är markerad som rapporterad',
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggleExclusion(row: ReportRow, excluded: boolean) {
    startTransition(async () => {
      const result = await toggleReportExclusionAction({
        kind: row.kind,
        id: row.id,
        excluded,
        note: '',
      });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  function saveOccupation(row: ReportRow, occupationLabel: string) {
    if (row.kind !== 'job') return;
    startTransition(async () => {
      const result = await updateApplicationAction({ id: row.id, occupationLabel });
      if (result.ok) {
        toast.success('Yrkesroll sparad');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function saveAppliedAt(row: ReportRow, appliedAt: string) {
    if (row.kind !== 'job') return;
    startTransition(async () => {
      const result = await updateApplicationAction({ id: row.id, appliedAt });
      if (result.ok) {
        toast.success('Sökt-datum uppdaterat');
        setEditingDateId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function addActivity(formData: FormData) {
    startTransition(async () => {
      const result = await saveActivityAction({
        type: String(formData.get('type') ?? 'ovrigt'),
        occurredOn: String(formData.get('occurredOn') ?? todayIso()),
        title: String(formData.get('title') ?? ''),
        organisation: String(formData.get('organisation') ?? ''),
        note: String(formData.get('note') ?? ''),
      });
      if (result.ok) {
        toast.success('Aktivitet tillagd');
        setAddingActivity(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const markButton = (
    <Button
      size="sm"
      variant={submitted || windowOpen ? 'primary' : 'secondary'}
      onClick={submit}
      loading={pending}
      disabled={!submitted && !windowOpen}
    >
      {submitted ? <Undo2 aria-hidden /> : <Check aria-hidden />}
      {submitted
        ? 'Öppna igen'
        : windowOpen && daysLeft >= 0
          ? `Markera som rapporterad · ${plural(daysLeft, 'dag', 'dagar')} kvar att rapportera`
          : 'Markera som rapporterad'}
    </Button>
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={period.key}
            onValueChange={(value) => router.push(`/rapport?manad=${value}`)}
          >
            <SelectTrigger className="w-52" aria-label="Välj månad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge tone={STATUS_TONES[period.status]}>
            {PERIOD_STATUS_LABELS[period.status]}
          </Badge>

          <span className="text-[13px] text-subtle">
            Rapportfönster {formatShortDate(period.windowOpens)}–
            {formatShortDate(period.windowCloses)}
          </span>

          <div className="no-print ml-auto flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAddingActivity(true)}>
              <Plus aria-hidden />
              Aktivitet
            </Button>
            <Button size="sm" onClick={copyRows} disabled={period.rows.length === 0}>
              <ClipboardCopy aria-hidden />
              Kopiera rader
            </Button>
            <Button size="sm" asChild>
              <a href={`/api/export?typ=rapport&manad=${period.key}`}>
                <Download aria-hidden />
                CSV
              </a>
            </Button>
            {!submitted && !windowOpen ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">{markButton}</span>
                </TooltipTrigger>
                <TooltipContent>
                  Kan markeras från {formatShortDate(period.windowOpens)}
                </TooltipContent>
              </Tooltip>
            ) : (
              markButton
            )}
          </div>
        </div>

        {period.banner ? (
          <p className="rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            {period.banner}
          </p>
        ) : null}

        {period.missingOccupationCount > 0 ? (
          <p className="flex flex-wrap items-start gap-2 rounded-[var(--radius-card)] border border-line bg-sunken px-4 py-3 text-sm text-muted">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span className="min-w-0 flex-1">
              {plural(period.missingOccupationCount, 'rad saknar', 'rader saknar')} yrkesroll.
              AF:s formulär vill ha en. Den följer med automatiskt för jobb du sparat från
              Platsbanken — för ansökningar du lagt in själv fyller du i den här.
            </span>
            {firstMissing ? (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                onClick={() => focusRow(firstMissing)}
              >
                Visa raden
              </Button>
            ) : null}
          </p>
        ) : null}

        {/*
          min-w-0: a flex item refuses to shrink below its own content by default,
          so the wide table would push the whole page sideways instead of
          scrolling inside its own container.
        */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              {plural(period.rows.length, 'rad', 'rader')} att rapportera för{' '}
              {period.label.toLowerCase()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {period.rows.length === 0 ? (
              <EmptyState
                title="Inget att rapportera den här månaden"
                description="Sökta jobb dyker upp här av sig själva. Kurser, mässor och spontanansökningar lägger du till som aktiviteter."
              />
            ) : (
              <div className="relative -mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[54rem] text-left text-sm [&_:where(td,th)]:pr-4 [&_:where(td,th):last-child]:pr-0">
                  <thead>
                    <tr className="border-b border-line text-[13px] text-subtle">
                      <th scope="col" className="pb-2 font-medium whitespace-nowrap">
                        Datum
                      </th>
                      <th scope="col" className="pb-2 font-medium whitespace-nowrap">
                        Typ
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Yrkesroll
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Arbetsgivare
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Ort
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Vad
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">
                              Annons
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Ja = du svarade på en platsannons. Nej = spontanansökan eller annat
                            utan annons.
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        <span className="sr-only">Åtgärd</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {period.rows.map((row) => {
                      const id = rowDomId(row);
                      const highlighted = highlightId === id;
                      return (
                        <tr
                          key={`${row.kind}-${row.id}`}
                          id={id}
                          className={
                            highlighted
                              ? 'bg-warning-soft/60 outline outline-2 outline-warning/40'
                              : undefined
                          }
                        >
                          <td className="py-2 whitespace-nowrap text-muted">
                            <div className="flex flex-col gap-1">
                              {editingDateId === row.id && row.kind === 'job' ? (
                                <Input
                                  type="date"
                                  defaultValue={row.datum || undefined}
                                  className="h-8 w-[10.5rem]"
                                  autoFocus
                                  onBlur={(event) => {
                                    if (event.target.value)
                                      saveAppliedAt(row, event.target.value);
                                    else setEditingDateId(null);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Escape') setEditingDateId(null);
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      const value = (event.target as HTMLInputElement).value;
                                      if (value) saveAppliedAt(row, value);
                                    }
                                  }}
                                />
                              ) : (
                                <span>{row.datum}</span>
                              )}
                              {row.dateWarning ? (
                                <span className="flex flex-wrap items-center gap-1 text-[12px] text-warning-text">
                                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                                  {row.dateWarning}{' '}
                                  {row.kind === 'job' ? (
                                    <button
                                      type="button"
                                      className="underline underline-offset-2"
                                      onClick={() => setEditingDateId(row.id)}
                                    >
                                      Redigera
                                    </button>
                                  ) : null}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 whitespace-nowrap text-muted">{row.typ}</td>
                          <td className="py-2">
                            {row.missingOccupation && row.kind === 'job' ? (
                              <span className="flex items-center gap-2">
                                <AlertTriangle
                                  className="size-4 shrink-0 text-warning"
                                  aria-hidden
                                />
                                <Input
                                  aria-label={`Yrkesroll för ${row.arbetsgivare}`}
                                  placeholder="Yrkesroll"
                                  defaultValue={row.yrke}
                                  className="h-8 max-w-[14rem]"
                                  onBlur={(event) => {
                                    const value = event.target.value.trim();
                                    if (value && value !== row.yrke) saveOccupation(row, value);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      const value = (
                                        event.target as HTMLInputElement
                                      ).value.trim();
                                      if (value) saveOccupation(row, value);
                                    }
                                  }}
                                />
                              </span>
                            ) : (
                              row.yrke || <span className="text-subtle">—</span>
                            )}
                          </td>
                          <td className="py-2">{row.arbetsgivare}</td>
                          <td className="py-2 text-muted">{row.ort}</td>
                          <td className="py-2">{row.anteckning}</td>
                          <td className="py-2 text-muted">{row.svarade}</td>
                          <td className="py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="no-print"
                              disabled={pending || submitted}
                              onClick={() => toggleExclusion(row, true)}
                            >
                              Uteslut
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {period.excludedRows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Uteslutna rader ({period.excludedRows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-line">
                {period.excludedRows.map((row) => (
                  <li key={`${row.kind}-${row.id}`} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">
                      {row.datum} · {row.arbetsgivare} — {row.anteckning}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="no-print"
                      disabled={pending}
                      onClick={() => toggleExclusion(row, false)}
                    >
                      Ta med igen
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <p className="text-[13px] text-subtle">
          Jobbdjungeln är ett personligt hjälpmedel och har ingen koppling till
          Arbetsförmedlingen. Du lämnar in din aktivitetsrapport hos dem som vanligt — det här
          är listan att utgå från.
        </p>

        <Dialog open={addingActivity} onOpenChange={setAddingActivity}>
          <DialogContent className="sm:w-[min(32rem,calc(100vw-2rem))]">
            <DialogHeader>
              <DialogTitle>Lägg till aktivitet</DialogTitle>
              <DialogDescription>
                Allt som inte är en jobbansökan: kurser, mässor, spontanansökningar, möten.
              </DialogDescription>
            </DialogHeader>
            <form action={addActivity}>
              <DialogBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Typ" required>
                  {(props) => (
                    <Select name="type" defaultValue="rekryteringstraff">
                      <SelectTrigger {...props}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ACTIVITY_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <Field label="Datum" required>
                  {(props) => (
                    <Input
                      {...props}
                      name="occurredOn"
                      type="date"
                      defaultValue={todayIso()}
                      required
                    />
                  )}
                </Field>
                <Field label="Vad gjorde du?" required className="sm:col-span-2">
                  {(props) => <Input {...props} name="title" required autoFocus />}
                </Field>
                <Field label="Arrangör eller organisation" className="sm:col-span-2">
                  {(props) => <Input {...props} name="organisation" />}
                </Field>
                <Field label="Anteckning" className="sm:col-span-2">
                  {(props) => <Textarea {...props} name="note" rows={3} />}
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setAddingActivity(false)}>
                  Avbryt
                </Button>
                <Button type="submit" variant="primary" loading={pending}>
                  Spara
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

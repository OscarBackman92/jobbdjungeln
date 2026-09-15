'use client';

import {
  formatDeadlineDisplay,
  formatPublishedDisplay,
  isSafeExternalUrl,
} from '@jobbdjungeln/core';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Building2,
  ExternalLink,
  MapPin,
  Send,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { JobHit } from '@/components/jobs/job-card';
import { MatchBadge } from '@/components/jobs/match-badge';
import { formatPlainAdText, sanitizeJobHtml } from '@/components/jobs/sanitize-ad-html';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  createApplicationAction,
  deleteApplicationAction,
  findSimilarAction,
} from '@/server/actions/applications';

function applyHref(job: JobHit): { href: string; viaPlatsbanken: boolean } {
  if (job.applicationUrl && isSafeExternalUrl(job.applicationUrl)) {
    return { href: job.applicationUrl, viaPlatsbanken: false };
  }
  return { href: job.webpageUrl, viaPlatsbanken: true };
}

const DEADLINE_CLASS: Record<string, string> = {
  danger: 'text-danger-text',
  warning: 'text-warning-text',
  'warning-soft': 'text-warning-text/80',
  muted: 'text-subtle',
  neutral: 'text-subtle',
};

function AdBody({
  html,
  text,
  highlight,
}: {
  html: string;
  text: string;
  highlight: string | null;
}) {
  const markRef = useRef<HTMLElement>(null);
  const safeHtml = useMemo(() => (html ? sanitizeJobHtml(html) : ''), [html]);
  const plain = useMemo(() => formatPlainAdText(text), [text]);

  useEffect(() => {
    if (!highlight) return;
    markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  if (safeHtml) {
    return (
      <div
        className="job-ad-html max-w-[70ch] text-sm leading-relaxed text-muted [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        // Sanitized allowlist only — see sanitizeJobHtml.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is allowlist-sanitized via sanitizeJobHtml
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  if (!plain) {
    return <p className="text-sm text-muted">Ingen annonstext tillgänglig här.</p>;
  }

  if (!highlight) {
    return (
      <div className="max-w-[70ch] text-sm leading-relaxed whitespace-pre-wrap text-muted">
        {plain}
      </div>
    );
  }

  const index = plain.toLowerCase().indexOf(highlight.toLowerCase());
  if (index < 0) {
    return (
      <div className="max-w-[70ch] text-sm leading-relaxed whitespace-pre-wrap text-muted">
        {plain}
      </div>
    );
  }

  const before = plain.slice(0, index);
  const match = plain.slice(index, index + highlight.length);
  const after = plain.slice(index + highlight.length);

  return (
    <div className="max-w-[70ch] text-sm leading-relaxed whitespace-pre-wrap text-muted">
      {before}
      <mark ref={markRef} className="rounded-sm bg-brand-soft px-0.5 text-brand-text">
        {match}
      </mark>
      {after}
    </div>
  );
}

/**
 * Read the ad in-app; leave the site only when the user chooses to apply.
 */
export function JobAdDialog({
  job,
  open,
  onOpenChange,
  savedId,
  onSavedIdChange,
}: {
  job: JobHit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedId: string | null;
  onSavedIdChange: (id: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeSnippet, setActiveSnippet] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const saved = savedId !== null;
  const apply = applyHref(job);
  const canApply = isSafeExternalUrl(apply.href);
  const canOpenAf = isSafeExternalUrl(job.webpageUrl);
  const match = job.match;
  const deadline = formatDeadlineDisplay(job.applicationDeadline);
  const published = formatPublishedDisplay(job.publishedAt);

  useEffect(() => {
    if (!open) setActiveSnippet(null);
  }, [open]);

  function savePayload() {
    return {
      company: job.companyName,
      title: job.title,
      location: job.location,
      status: 'wishlist' as const,
      source: 'platsbanken' as const,
      adUrl: job.webpageUrl,
      applyUrl: job.applicationUrl,
      adDescription: job.description,
      sourceJobId: job.id,
      deadline: job.applicationDeadline ?? '',
      occupationConceptId: job.occupationConceptId,
      occupationLabel: job.occupationLabel,
      occupationGroupLabel: job.occupationGroupLabel,
      workingHoursType: job.workingHoursType,
      scopeOfWorkMin: job.scopeOfWorkMin,
      scopeOfWorkMax: job.scopeOfWorkMax,
    };
  }

  function toggleSave() {
    if (savedId && savedId !== 'pending') {
      const previousId = savedId;
      const payload = savePayload();
      onSavedIdChange(null);
      startTransition(async () => {
        const result = await deleteApplicationAction(previousId);
        if (!result.ok) {
          onSavedIdChange(previousId);
          toast.error(result.error);
          return;
        }
        toast('Borttaget från Sparade', {
          duration: 8000,
          action: {
            label: 'Ångra',
            onClick: () => {
              startTransition(async () => {
                const restored = await createApplicationAction(payload);
                if (restored.ok) {
                  onSavedIdChange(restored.data.id);
                  router.refresh();
                } else {
                  toast.error(restored.error);
                }
              });
            },
          },
        });
        router.refresh();
      });
      return;
    }

    onSavedIdChange('pending');
    startTransition(async () => {
      const similar = await findSimilarAction({
        company: job.companyName,
        title: job.title,
        sourceJobId: job.id,
      });
      if (similar.ok && similar.data.length > 0) {
        toast.message(`Du har redan ${similar.data[0]?.company}: ${similar.data[0]?.title}.`);
      }
      const result = await createApplicationAction(savePayload());
      if (!result.ok) {
        onSavedIdChange(null);
        toast.error(result.error);
        return;
      }
      onSavedIdChange(result.data.id);
      toast('Sparat', {
        duration: 8000,
        action: {
          label: 'Öppna',
          onClick: () => router.push('/sparade'),
        },
        cancel: {
          label: 'Ångra',
          onClick: () => {
            startTransition(async () => {
              const undone = await deleteApplicationAction(result.data.id);
              if (undone.ok) {
                onSavedIdChange(null);
                router.refresh();
              } else {
                toast.error(undone.error);
              }
            });
          },
        },
      });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-modal="true"
        aria-labelledby={titleId}
        className="sm:w-[min(40rem,calc(100vw-2rem))]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle id={titleId} ref={titleRef} tabIndex={-1} className="outline-none">
            {job.title}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5 shrink-0" aria-hidden />
              {job.companyName || 'Okänd arbetsgivare'}
            </span>
            {job.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {job.location}
              </span>
            ) : null}
            {job.workingHoursType ? <Badge tone="neutral">{job.workingHoursType}</Badge> : null}
            {job.remote ? <Badge tone="info">Distans</Badge> : null}
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {published ? <span className="text-subtle">{published}</span> : null}
            {deadline ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  DEADLINE_CLASS[deadline.urgency],
                )}
                title={deadline.absolute}
              >
                {deadline.urgency === 'danger' ? (
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                ) : null}
                {deadline.label}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <DialogBody>
          {match ? (
            <section className="mb-4 rounded-[var(--radius-control)] border border-line bg-sunken/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-ink">Din matchning</h3>
                <MatchBadge jobId={job.id} match={match} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {match.covered.map((item) => (
                  <button
                    key={`covered:${item.term}:${item.snippet}`}
                    type="button"
                    className={cn(
                      'rounded-full bg-positive-soft px-2 py-0.5 text-xs font-medium text-positive-text',
                      'outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
                      activeSnippet === item.snippet && 'ring-2 ring-brand/40',
                    )}
                    onClick={() => setActiveSnippet(item.snippet || item.term)}
                  >
                    {item.term}
                  </button>
                ))}
                {match.gaps.map((item) => (
                  <button
                    key={`gap:${item.term}:${item.snippet}`}
                    type="button"
                    className={cn(
                      'rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-muted',
                      'outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
                      activeSnippet === item.snippet && 'ring-2 ring-brand/40',
                    )}
                    onClick={() => setActiveSnippet(item.snippet || item.term)}
                  >
                    {item.term}
                  </button>
                ))}
                {match.mustTotal === 0 &&
                match.covered.length === 0 &&
                match.gaps.length === 0 ? (
                  <span className="text-[13px] text-subtle">Inga krav listade i annonsen.</span>
                ) : null}
              </div>
            </section>
          ) : null}

          <AdBody html={job.descriptionHtml} text={job.description} highlight={activeSnippet} />
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={saved ? 'secondary' : 'ghost'}
              size="sm"
              onClick={toggleSave}
              loading={pending}
              aria-pressed={saved}
            >
              {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
              {saved ? 'Sparad' : 'Spara'}
            </Button>
            {canOpenAf ? (
              <Button variant="ghost" size="sm" asChild>
                <a href={job.webpageUrl} target="_blank" rel="noopener noreferrer">
                  Visa på Arbetsförmedlingen
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            ) : null}
          </div>
          {canApply ? (
            <Button variant="primary" size="sm" asChild>
              <a href={apply.href} target="_blank" rel="noopener noreferrer">
                <Send aria-hidden />
                {apply.viaPlatsbanken ? 'Ansök via Platsbanken' : 'Ansök'}
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { formatShortDate, isSafeExternalUrl } from '@jobbdjungeln/core';
import { Bookmark, BookmarkCheck, Building2, ExternalLink, MapPin, Send } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { JobHit } from '@/components/jobs/job-card';
import { MatchBadge } from '@/components/jobs/match-badge';
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

function applyHref(job: JobHit): string {
  return job.applicationUrl || job.webpageUrl;
}

function HighlightedDescription({
  text,
  highlight,
}: {
  text: string;
  highlight: string | null;
}) {
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!highlight) return;
    markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  if (!highlight) {
    return <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{text}</div>;
  }

  const index = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (index < 0) {
    return <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{text}</div>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + highlight.length);
  const after = text.slice(index + highlight.length);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
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
  const [pending, startTransition] = useTransition();
  const [activeSnippet, setActiveSnippet] = useState<string | null>(null);
  const saved = savedId !== null;
  const applyUrl = applyHref(job);
  const canApply = isSafeExternalUrl(applyUrl);
  const canOpenAf = isSafeExternalUrl(job.webpageUrl);
  const match = job.match;

  useEffect(() => {
    if (!open) setActiveSnippet(null);
  }, [open]);

  function toggleSave() {
    if (savedId) {
      if (!confirm('Ta bort sparningen? Jobbet försvinner från Sparade jobb.')) return;
      startTransition(async () => {
        const result = await deleteApplicationAction(savedId);
        if (result.ok) {
          onSavedIdChange(null);
          toast.success('Borttagen från Sparade jobb');
        } else {
          toast.error(result.error);
        }
      });
      return;
    }

    startTransition(async () => {
      const similar = await findSimilarAction({
        company: job.companyName,
        title: job.title,
        sourceJobId: job.id,
      });
      if (similar.ok && similar.data.length > 0) {
        toast.message(`Du har redan ${similar.data[0]?.company}: ${similar.data[0]?.title}.`);
      }
      const result = await createApplicationAction({
        company: job.companyName,
        title: job.title,
        location: job.location,
        status: 'wishlist',
        source: 'platsbanken',
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
      });

      if (result.ok) {
        onSavedIdChange(result.data.id);
        toast.success('Sparad under Sparade jobb');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[min(40rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{job.title}</DialogTitle>
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
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {job.remote ? <Badge tone="info">Distans</Badge> : null}
            {job.workingHoursType ? <Badge tone="neutral">{job.workingHoursType}</Badge> : null}
            {job.occupationLabel ? <Badge tone="outline">{job.occupationLabel}</Badge> : null}
            <MatchBadge jobId={job.id} match={match} />
          </div>
        </DialogHeader>

        <DialogBody>
          {match ? (
            <section className="mb-4 rounded-[var(--radius-control)] border border-line bg-sunken/50 p-3">
              <h3 className="text-[13px] font-semibold text-ink">Din matchning</h3>
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

          {job.description ? (
            <HighlightedDescription text={job.description} highlight={activeSnippet} />
          ) : (
            <p className="text-sm text-muted">Ingen annonstext tillgänglig här.</p>
          )}

          <dl className="mt-4 grid gap-2 border-t border-line pt-4 text-[13px] sm:grid-cols-2">
            {job.publishedAt ? (
              <div>
                <dt className="text-subtle">Publicerad</dt>
                <dd className="text-ink">{formatShortDate(job.publishedAt)}</dd>
              </div>
            ) : null}
            {job.applicationDeadline ? (
              <div>
                <dt className="text-subtle">Sista ansökningsdag</dt>
                <dd className="text-ink">{formatShortDate(job.applicationDeadline)}</dd>
              </div>
            ) : null}
          </dl>
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
              {saved ? 'Sparad' : 'Spara till senare'}
            </Button>
            {canOpenAf && job.webpageUrl !== applyUrl ? (
              <Button variant="ghost" size="sm" asChild>
                <a href={job.webpageUrl} target="_blank" rel="noopener noreferrer">
                  På Arbetsförmedlingen
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            ) : null}
          </div>
          {canApply ? (
            <Button variant="primary" size="sm" asChild>
              <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                <Send aria-hidden />
                Ansök hos arbetsgivaren
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

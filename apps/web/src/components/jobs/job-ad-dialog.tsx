'use client';

import { formatShortDate, isSafeExternalUrl } from '@jobbdjungeln/core';
import { Bookmark, BookmarkCheck, Building2, ExternalLink, MapPin, Send } from 'lucide-react';
import { useTransition } from 'react';
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
import {
  createApplicationAction,
  deleteApplicationAction,
} from '@/server/actions/applications';

function applyHref(job: JobHit): string {
  return job.applicationUrl || job.webpageUrl;
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
  const saved = savedId !== null;
  const applyUrl = applyHref(job);
  const canApply = isSafeExternalUrl(applyUrl);
  const canOpenAf = isSafeExternalUrl(job.webpageUrl);

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
            <MatchBadge jobId={job.id} match={job.match} />
          </div>
        </DialogHeader>

        <DialogBody>
          {job.description ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
              {job.description}
            </div>
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

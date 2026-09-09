'use client';

import type { MatchSnapshot } from '@jobbdjungeln/core';
import { formatShortDate, isSafeExternalUrl } from '@jobbdjungeln/core';
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  Check,
  ExternalLink,
  FileText,
  MapPin,
  Send,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { JobAdDialog } from '@/components/jobs/job-ad-dialog';
import { MatchBadge } from '@/components/jobs/match-badge';
import { Badge, Button, Card } from '@/components/ui';
import {
  createApplicationAction,
  deleteApplicationAction,
} from '@/server/actions/applications';

export interface JobHit {
  id: string;
  title: string;
  companyName: string;
  location: string;
  description: string;
  webpageUrl: string;
  applicationUrl: string;
  publishedAt: string | null;
  applicationDeadline: string | null;
  remote: boolean;
  occupationConceptId: string;
  occupationLabel: string;
  occupationGroupLabel: string;
  workingHoursType: string;
  scopeOfWorkMin: number | null;
  scopeOfWorkMax: number | null;
  alreadyTracked: boolean;
  trackedApplicationId: string | null;
  match: MatchSnapshot | null;
}

const EXCERPT_LENGTH = 220;

function applyHref(job: JobHit): string {
  return job.applicationUrl || job.webpageUrl;
}

export function JobCard({ job }: { job: JobHit }) {
  const [savedId, setSavedId] = useState<string | null>(job.trackedApplicationId);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();

  const saved = savedId !== null;
  const excerpt = job.description.slice(0, EXCERPT_LENGTH);
  const truncated = job.description.length > EXCERPT_LENGTH;
  const applyUrl = applyHref(job);
  const canApply = isSafeExternalUrl(applyUrl);

  function toggleSave() {
    if (savedId) {
      if (!confirm('Ta bort sparningen? Jobbet försvinner från Sparade jobb.')) return;
      startTransition(async () => {
        const result = await deleteApplicationAction(savedId);
        if (result.ok) {
          setSavedId(null);
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
        setSavedId(result.data.id);
        toast.success('Sparad under Sparade jobb');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Card as="article" className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">
              <button
                type="button"
                onClick={() => setReading(true)}
                className="text-left underline-offset-2 hover:underline"
              >
                {job.title}
              </button>
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5 text-subtle" aria-hidden />
                {job.companyName || 'Okänd arbetsgivare'}
              </span>
              {job.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 text-subtle" aria-hidden />
                  {job.location}
                </span>
              ) : null}
              {job.remote ? <Badge tone="info">Distans</Badge> : null}
              {job.workingHoursType ? (
                <Badge tone="neutral">{job.workingHoursType}</Badge>
              ) : null}
            </p>
          </div>
          <MatchBadge jobId={job.id} match={job.match} />
        </div>

        {job.description ? (
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted">
            {excerpt}
            {truncated ? '…' : null}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setReading(true)}>
            <FileText aria-hidden />
            Läs annonsen
          </Button>

          {canApply ? (
            <Button variant="secondary" size="sm" asChild>
              <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                <Send aria-hidden />
                Ansök
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSave}
            loading={pending}
            aria-pressed={saved}
          >
            {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
            {saved ? 'Sparad' : 'Spara'}
          </Button>

          <span className="ml-auto text-[13px] text-subtle">
            {job.applicationDeadline
              ? `Sista dag ${formatShortDate(job.applicationDeadline)}`
              : job.publishedAt
                ? `Publicerad ${formatShortDate(job.publishedAt)}`
                : null}
          </span>
        </div>

        {saved && !job.alreadyTracked ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[13px] text-positive-text">
            <Check className="size-3.5" aria-hidden />
            Ligger under Sparade jobb — öppna där om du vill fylla i detaljer.
          </p>
        ) : null}
      </Card>

      <JobAdDialog
        job={job}
        open={reading}
        onOpenChange={setReading}
        savedId={savedId}
        onSavedIdChange={setSavedId}
      />
    </>
  );
}

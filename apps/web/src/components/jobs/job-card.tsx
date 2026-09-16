'use client';

import type { MatchSnapshot } from '@jobbdjungeln/core';
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
  FileText,
  MapPin,
  Send,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { JobAdDialog } from '@/components/jobs/job-ad-dialog';
import { MatchBadge } from '@/components/jobs/match-badge';
import { formatMatchSummary } from '@/components/jobs/match-badge-logic';
import { Badge, Button, Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  createApplicationAction,
  deleteApplicationAction,
  findSimilarAction,
} from '@/server/actions/applications';

export interface JobHit {
  id: string;
  title: string;
  companyName: string;
  location: string;
  description: string;
  descriptionHtml: string;
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

function applyHref(job: JobHit): { href: string; viaPlatsbanken: boolean } {
  if (job.applicationUrl && isSafeExternalUrl(job.applicationUrl)) {
    return { href: job.applicationUrl, viaPlatsbanken: false };
  }
  return { href: job.webpageUrl, viaPlatsbanken: true };
}

function normalizeExcerpt(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const DEADLINE_CLASS: Record<string, string> = {
  danger: 'text-danger-text',
  warning: 'text-warning-text',
  'warning-soft': 'text-warning-text/80',
  muted: 'text-subtle',
  neutral: 'text-subtle',
};

export function JobCard({
  job,
  showMatch = true,
  headingRef,
}: {
  job: JobHit;
  /** When false, CV match badges stay hidden without refetching. */
  showMatch?: boolean;
  /** Optional ref target for focusing the first newly loaded card. */
  headingRef?: (node: HTMLButtonElement | null) => void;
}) {
  const router = useRouter();
  const [savedId, setSavedId] = useState<string | null>(job.trackedApplicationId);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();

  const saved = savedId !== null;
  const excerpt = normalizeExcerpt(job.description);
  const apply = applyHref(job);
  const canApply = isSafeExternalUrl(apply.href);
  const matchSummary = showMatch && job.match ? formatMatchSummary(job.match) : null;
  const deadline = formatDeadlineDisplay(job.applicationDeadline);
  const published = formatPublishedDisplay(job.publishedAt);

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
    if (savedId) {
      const previousId = savedId;
      const payload = savePayload();
      setSavedId(null);
      startTransition(async () => {
        const result = await deleteApplicationAction(previousId);
        if (!result.ok) {
          setSavedId(previousId);
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
                  setSavedId(restored.data.id);
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

    setSavedId('pending');
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
        setSavedId(null);
        toast.error(result.error);
        return;
      }
      setSavedId(result.data.id);
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
                setSavedId(null);
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
    <>
      <Card as="article" className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">
              <button
                type="button"
                ref={headingRef}
                onClick={() => setReading(true)}
                className="text-left underline-offset-2 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
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
            </p>
          </div>
          {showMatch ? <MatchBadge jobId={job.id} match={job.match} /> : null}
        </div>

        {matchSummary ? (
          <p className="mt-2 text-[12px] leading-snug text-muted sm:text-[13px]">
            {matchSummary}
          </p>
        ) : null}

        {excerpt ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{excerpt}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setReading(true)}>
            <FileText aria-hidden />
            Läs annonsen
          </Button>

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

          {canApply ? (
            <Button variant="secondary" size="sm" asChild>
              <a href={apply.href} target="_blank" rel="noopener noreferrer">
                <Send aria-hidden />
                {apply.viaPlatsbanken ? 'Ansök via Platsbanken' : 'Ansök'}
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
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

'use client';

import {
  displaySkillLabel,
  employerKey,
  looksLikeRoleSkill,
  normalizeSkillList,
  roleKey,
  suggestSkillsFromExperience,
  unifyResumeSkills,
} from '@jobbdjungeln/core';
import { FileUp, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
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
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { parseResumeAction, type ResumeDraft, saveResumeAction } from '@/server/actions/resume';

interface Experience {
  id: string;
  role: string;
  employer: string;
  start: string;
  end: string;
  description: string;
  skills: string[];
}

interface Education {
  id: string;
  program: string;
  school: string;
  start: string;
  end: string;
}

export interface ResumeState {
  headline: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  jobProfiles: JobProfile[];
}

interface JobProfile {
  id: string;
  label: string;
  skills: string[];
  confirmed: string[];
}

function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function experienceDupKey(employer: string, role: string): string {
  return `${employerKey(employer)}|${roleKey(role)}`;
}

function educationDupKey(school: string, program: string): string {
  return `${school.trim().toLowerCase()}|${program.trim().toLowerCase()}`;
}

interface SkillChoice {
  value: string;
  duplicate: boolean;
  checked: boolean;
}

interface ExperienceChoice {
  entry: ResumeDraft['experience'][number];
  duplicate: boolean;
  checked: boolean;
}

interface EducationChoice {
  entry: ResumeDraft['education'][number];
  duplicate: boolean;
  checked: boolean;
}

interface ImportReview {
  draft: ResumeDraft;
  skills: SkillChoice[];
  experience: ExperienceChoice[];
  education: EducationChoice[];
  overwriteHeadline: boolean;
  overwriteSummary: boolean;
}

function buildImportReview(current: ResumeState, draft: ResumeDraft): ImportReview {
  const existingSkills = new Set(current.skills.map((skill) => skill.toLowerCase()));
  const existingJobs = new Set(
    current.experience.map((entry) => experienceDupKey(entry.employer, entry.role)),
  );
  const existingEdu = new Set(
    current.education.map((entry) => educationDupKey(entry.school, entry.program)),
  );

  const skills = normalizeSkillList(draft.skills).map((value) => {
    const duplicate = existingSkills.has(value.toLowerCase());
    return { value, duplicate, checked: !duplicate };
  });

  const experience = draft.experience.map((entry) => {
    const duplicate = existingJobs.has(experienceDupKey(entry.employer, entry.role));
    return { entry, duplicate, checked: !duplicate };
  });

  const education = draft.education.map((entry) => {
    const duplicate = existingEdu.has(educationDupKey(entry.school, entry.program));
    return { entry, duplicate, checked: !duplicate };
  });

  return {
    draft,
    skills,
    experience,
    education,
    overwriteHeadline: false,
    overwriteSummary: false,
  };
}

/**
 * The CV.
 *
 * Its only job in this app is to drive matching, so skills are the part that
 * gets the real editing affordances. An uploaded file is parsed into a draft the
 * user corrects before anything is saved — the file itself is never stored, and
 * a parser guess is never treated as fact.
 */
export function ResumeEditor({
  initial,
  accountFirstName = '',
}: {
  initial: ResumeState;
  accountFirstName?: string;
}) {
  const unifiedInitial = (() => {
    const unified = unifyResumeSkills(initial);
    return { ...initial, skills: unified.skills, jobProfiles: unified.jobProfiles };
  })();
  const [resume, setResume] = useState<ResumeState>(unifiedInitial);
  const [saved, setSaved] = useState<ResumeState>(unifiedInitial);
  const [skillDraft, setSkillDraft] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [saving, startSaving] = useTransition();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingHref = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setParsing(true);
    setError(undefined);
    const formData = new FormData();
    formData.set('file', file);

    const result = await parseResumeAction(formData);
    setParsing(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setReview(buildImportReview(resume, result.data));
  }

  function applyImport() {
    if (!review) return;
    const { draft } = review;

    setResume((current) => {
      const selectedExperience = review.experience.filter((item) => item.checked);
      const overwriteKeys = new Set(
        selectedExperience
          .filter((item) => item.duplicate)
          .map((item) => experienceDupKey(item.entry.employer, item.entry.role)),
      );
      const selectedEducation = review.education.filter((item) => item.checked);
      const overwriteEduKeys = new Set(
        selectedEducation
          .filter((item) => item.duplicate)
          .map((item) => educationDupKey(item.entry.school, item.entry.program)),
      );

      return {
        headline:
          review.overwriteHeadline && draft.headline ? draft.headline : current.headline,
        summary: review.overwriteSummary && draft.summary ? draft.summary : current.summary,
        skills: normalizeSkillList([
          ...current.skills,
          ...review.skills.filter((item) => item.checked).map((item) => item.value),
        ]),
        experience: [
          ...current.experience.filter(
            (entry) => !overwriteKeys.has(experienceDupKey(entry.employer, entry.role)),
          ),
          ...selectedExperience.map((item) => ({
            ...item.entry,
            id: item.entry.id || newId(),
          })),
        ],
        education: [
          ...current.education.filter(
            (entry) => !overwriteEduKeys.has(educationDupKey(entry.school, entry.program)),
          ),
          ...selectedEducation.map((item) => ({ ...item.entry, id: item.entry.id || newId() })),
        ],
        jobProfiles: current.jobProfiles,
      };
    });
    setReview(null);
    toast.success('Valda delar är inlästa. Gå igenom och rätta innan du sparar.');
  }

  function save() {
    startSaving(async () => {
      const unified = unifyResumeSkills(resume);
      const next = { ...resume, skills: unified.skills, jobProfiles: unified.jobProfiles };
      const result = await saveResumeAction(next);
      if (result.ok) {
        setResume(next);
        setSaved(next);
        toast.success('CV sparat');
      } else {
        setError(result.error);
      }
    });
  }

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    setResume((current) => ({
      ...current,
      skills: normalizeSkillList([...current.skills, value]),
    }));
    setSkillDraft('');
  }

  /*
   * Whether anything is waiting to be saved. A cheap structural comparison is
   * enough here: the worst a false positive can do is float the save bar a
   * moment early, and the shape is small enough that the cost is invisible.
   */
  const dirty = JSON.stringify(resume) !== JSON.stringify(saved);
  const wouldOverwriteHeadline = Boolean(review?.draft.headline && resume.headline);
  const wouldOverwriteSummary = Boolean(review?.draft.summary && resume.summary);
  const firstName = accountFirstName.trim().split(/\s+/)[0] ?? '';
  const headlineLooksLikeName =
    Boolean(firstName) &&
    resume.headline.trim().toLowerCase() === firstName.toLowerCase() &&
    !/\s/.test(resume.headline.trim());

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }
      if (anchor.target === '_blank') return;
      event.preventDefault();
      event.stopPropagation();
      pendingHref.current = anchor.href;
      setLeaveOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  function discardChanges() {
    setResume(saved);
    setError(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote description={error} /> : null}

      <nav
        aria-label="Hoppa till avsnitt"
        className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted"
      >
        <a className="underline-offset-2 hover:text-ink hover:underline" href="#om-dig">
          Om dig
        </a>
        <span aria-hidden>·</span>
        <a className="underline-offset-2 hover:text-ink hover:underline" href="#kompetenser">
          Kompetenser
        </a>
        <span aria-hidden>·</span>
        <a className="underline-offset-2 hover:text-ink hover:underline" href="#erfarenhet">
          Erfarenhet
        </a>
        <span aria-hidden>·</span>
        <a className="underline-offset-2 hover:text-ink hover:underline" href="#utbildning">
          Utbildning
        </a>
        <span aria-hidden>·</span>
        <a className="underline-offset-2 hover:text-ink hover:underline" href="#jobbprofiler">
          Jobbprofiler
        </a>
      </nav>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Osparade ändringar"
        description="Du har ändringar som inte sparats. Vill du lämna sidan ändå?"
        confirmLabel="Lämna"
        cancelLabel="Stanna"
        onConfirm={() => {
          const href = pendingHref.current;
          pendingHref.current = null;
          setLeaveOpen(false);
          if (href) window.location.assign(href);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Läs in från fil</CardTitle>
          <CardDescription>
            PDF, DOCX eller TXT. Filen läses i minnet och sparas aldrig — bara det du godkänner
            här nedanför lagras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={parsing}>
            {parsing ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <FileUp aria-hidden />
            )}
            {parsing ? 'Läser…' : 'Välj fil'}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={review !== null} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent className="sm:w-[min(36rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Granska innan du lägger till</DialogTitle>
            <DialogDescription>
              Markera det som ska föras in. Dubbletter är avmarkerade; rubrik och sammanfattning
              skrivs bara över om du aktivt väljer det.
            </DialogDescription>
          </DialogHeader>
          {review ? (
            <>
              <DialogBody className="flex flex-col gap-5">
                {(review.draft.headline || review.draft.summary) && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-ink">Rubrik & sammanfattning</h3>
                    {review.draft.headline ? (
                      <div className="flex items-start gap-2 text-sm text-ink">
                        <Checkbox
                          checked={review.overwriteHeadline}
                          onCheckedChange={(value) =>
                            setReview({ ...review, overwriteHeadline: value === true })
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">Rubrik:</span> {review.draft.headline}
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {wouldOverwriteHeadline
                              ? `Skriver över nuvarande: „${resume.headline}”.`
                              : resume.headline
                                ? 'Oförändrad om du lämnar den avmarkerad.'
                                : 'Fyller i rubriken om du markerar.'}
                          </span>
                        </span>
                      </div>
                    ) : null}
                    {review.draft.summary ? (
                      <div className="flex items-start gap-2 text-sm text-ink">
                        <Checkbox
                          checked={review.overwriteSummary}
                          onCheckedChange={(value) =>
                            setReview({ ...review, overwriteSummary: value === true })
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">Sammanfattning</span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {wouldOverwriteSummary
                              ? 'Skriver över din nuvarande sammanfattning.'
                              : resume.summary
                                ? 'Oförändrad om du lämnar den avmarkerad.'
                                : 'Fyller i sammanfattningen om du markerar.'}
                          </span>
                          <span className="mt-1 line-clamp-3 block text-[13px] text-subtle">
                            {review.draft.summary}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </section>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    Kompetenser
                    <span className="ml-1 font-normal text-muted">
                      ({review.skills.filter((item) => !item.duplicate).length} nya
                      {review.skills.some((item) => item.duplicate)
                        ? `, ${review.skills.filter((item) => item.duplicate).length} dubbletter`
                        : ''}
                      )
                    </span>
                  </h3>
                  {review.skills.length === 0 ? (
                    <p className="text-sm text-muted">Inga kompetenser hittades.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {review.skills.map((item, index) => (
                        <li key={item.value}>
                          <div className="flex items-center gap-2 text-sm text-ink">
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={(value) =>
                                setReview({
                                  ...review,
                                  skills: review.skills.map((skill, i) =>
                                    i === index ? { ...skill, checked: value === true } : skill,
                                  ),
                                })
                              }
                            />
                            <span>
                              {item.value}
                              {item.duplicate ? (
                                <span className="ml-1.5 text-[12px] text-subtle">
                                  finns redan
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    Erfarenhet
                    <span className="ml-1 font-normal text-muted">
                      ({review.experience.filter((item) => !item.duplicate).length} nya
                      {review.experience.some((item) => item.duplicate)
                        ? `, ${review.experience.filter((item) => item.duplicate).length} dubbletter`
                        : ''}
                      )
                    </span>
                  </h3>
                  {review.experience.length === 0 ? (
                    <p className="text-sm text-muted">Ingen erfarenhet hittades.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {review.experience.map((item, index) => (
                        <li key={item.entry.id || index}>
                          <div className="flex items-start gap-2 text-sm text-ink">
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={(value) =>
                                setReview({
                                  ...review,
                                  experience: review.experience.map((row, i) =>
                                    i === index ? { ...row, checked: value === true } : row,
                                  ),
                                })
                              }
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-medium">
                                {item.entry.role || 'Roll saknas'}
                              </span>
                              {item.entry.employer ? ` · ${item.entry.employer}` : ''}
                              {item.entry.start ? (
                                <span className="text-muted">
                                  {' '}
                                  ({item.entry.start}
                                  {item.entry.end ? `–${item.entry.end}` : ''})
                                </span>
                              ) : null}
                              {item.duplicate ? (
                                <span className="mt-0.5 block text-[12px] text-subtle">
                                  Finns redan — markerad skriver över
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    Utbildning
                    <span className="ml-1 font-normal text-muted">
                      ({review.education.filter((item) => !item.duplicate).length} nya
                      {review.education.some((item) => item.duplicate)
                        ? `, ${review.education.filter((item) => item.duplicate).length} dubbletter`
                        : ''}
                      )
                    </span>
                  </h3>
                  {review.education.length === 0 ? (
                    <p className="text-sm text-muted">Ingen utbildning hittades.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {review.education.map((item, index) => (
                        <li key={item.entry.id || index}>
                          <div className="flex items-start gap-2 text-sm text-ink">
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={(value) =>
                                setReview({
                                  ...review,
                                  education: review.education.map((row, i) =>
                                    i === index ? { ...row, checked: value === true } : row,
                                  ),
                                })
                              }
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-medium">
                                {item.entry.program || 'Program saknas'}
                              </span>
                              {item.entry.school ? ` · ${item.entry.school}` : ''}
                              {item.duplicate ? (
                                <span className="mt-0.5 block text-[12px] text-subtle">
                                  Finns redan — markerad skriver över
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReview(null)}>
                  Avbryt
                </Button>
                <Button variant="primary" onClick={applyImport}>
                  Lägg till markerade
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card id="om-dig">
        <CardHeader>
          <CardTitle>Om dig</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Yrkesroll (rubrik)"
            hint={
              headlineLooksLikeName
                ? 'Det här ser ut som ditt namn – skriv din roll, t.ex. Ekonomiassistent.'
                : 'Din roll i en rad, t.ex. Ekonomiassistent.'
            }
          >
            {(props) => (
              <Input
                {...props}
                value={resume.headline}
                onChange={(event) => setResume({ ...resume, headline: event.target.value })}
              />
            )}
          </Field>
          <Field label="Sammanfattning">
            {(props) => (
              <Textarea
                {...props}
                rows={4}
                value={resume.summary}
                onChange={(event) => setResume({ ...resume, summary: event.target.value })}
              />
            )}
          </Field>
        </CardContent>
      </Card>

      <Card id="kompetenser">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" aria-hidden />
            Kompetenser
          </CardTitle>
          <CardDescription>
            Det här är vad annonserna matchas mot. Synonymer slås ihop automatiskt — skriv
            &ldquo;Microsoft Excel&rdquo; och det sparas som Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <li key={skill} className="flex max-w-full flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-2.5 text-[13px] text-brand-text">
                  {displaySkillLabel(skill)}
                  <button
                    type="button"
                    onClick={() =>
                      setResume({
                        ...resume,
                        skills: resume.skills.filter((value) => value !== skill),
                        jobProfiles: resume.jobProfiles.map((profile) => ({
                          ...profile,
                          skills: profile.skills.filter(
                            (value) => value.toLowerCase() !== skill.toLowerCase(),
                          ),
                          confirmed: profile.confirmed.filter(
                            (value) => value.toLowerCase() !== skill.toLowerCase(),
                          ),
                        })),
                      })
                    }
                    aria-label={`Ta bort ${displaySkillLabel(skill)}`}
                    className="rounded-full p-0.5 hover:bg-brand/20"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
                {looksLikeRoleSkill(skill) ? (
                  <button
                    type="button"
                    className="px-1 text-left text-[11px] text-warning-text underline-offset-2 hover:underline"
                    onClick={() =>
                      setResume({
                        ...resume,
                        headline: resume.headline.trim() ? resume.headline : skill,
                        skills: resume.skills.filter((value) => value !== skill),
                        jobProfiles: resume.jobProfiles.map((profile) => ({
                          ...profile,
                          skills: profile.skills.filter(
                            (value) => value.toLowerCase() !== skill.toLowerCase(),
                          ),
                          confirmed: profile.confirmed.filter(
                            (value) => value.toLowerCase() !== skill.toLowerCase(),
                          ),
                        })),
                      })
                    }
                  >
                    Det här är en roll – flytta till rubriken?
                  </button>
                ) : null}
              </li>
            ))}
            {resume.skills.length === 0 ? (
              <li className="text-sm text-muted">Inga kompetenser ännu.</li>
            ) : null}
          </ul>

          <div className="flex gap-2">
            <Input
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Lägg till en kompetens"
              aria-label="Lägg till en kompetens"
            />
            <Button onClick={addSkill}>
              <Plus aria-hidden />
              Lägg till
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="erfarenhet">
        <CardHeader>
          <CardTitle>Erfarenhet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {resume.experience.map((entry, index) => (
            <fieldset
              key={entry.id}
              className="grid gap-3 rounded-[var(--radius-card)] border border-line p-3 sm:grid-cols-2"
            >
              <legend className="sr-only">Anställning {index + 1}</legend>
              <Field label="Roll">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.role}
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        experience: resume.experience.map((item) =>
                          item.id === entry.id ? { ...item, role: event.target.value } : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Arbetsgivare">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.employer}
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        experience: resume.experience.map((item) =>
                          item.id === entry.id
                            ? { ...item, employer: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Från">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.start}
                    placeholder="2020"
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        experience: resume.experience.map((item) =>
                          item.id === entry.id ? { ...item, start: event.target.value } : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Till">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.end}
                    placeholder="Pågående"
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        experience: resume.experience.map((item) =>
                          item.id === entry.id ? { ...item, end: event.target.value } : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Beskrivning" className="sm:col-span-2">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={3}
                    value={entry.description}
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        experience: resume.experience.map((item) =>
                          item.id === entry.id
                            ? { ...item, description: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <div className="sm:col-span-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setResume({
                      ...resume,
                      experience: resume.experience.filter((item) => item.id !== entry.id),
                    })
                  }
                >
                  <Trash2 aria-hidden />
                  Ta bort
                </Button>
              </div>
            </fieldset>
          ))}

          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              setResume({
                ...resume,
                experience: [
                  ...resume.experience,
                  {
                    id: newId(),
                    role: '',
                    employer: '',
                    start: '',
                    end: '',
                    description: '',
                    skills: [],
                  },
                ],
              })
            }
          >
            <Plus aria-hidden />
            Lägg till anställning
          </Button>
        </CardContent>
      </Card>

      <Card id="utbildning">
        <CardHeader>
          <CardTitle>Utbildning</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {resume.education.map((entry, index) => (
            <fieldset
              key={entry.id}
              className="grid gap-3 rounded-[var(--radius-card)] border border-line p-3 sm:grid-cols-2"
            >
              <legend className="sr-only">Utbildning {index + 1}</legend>
              <Field label="Utbildning">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.program}
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        education: resume.education.map((item) =>
                          item.id === entry.id
                            ? { ...item, program: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Skola">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.school}
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        education: resume.education.map((item) =>
                          item.id === entry.id ? { ...item, school: event.target.value } : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Från">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.start}
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        education: resume.education.map((item) =>
                          item.id === entry.id ? { ...item, start: event.target.value } : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Till">
                {(props) => (
                  <Input
                    {...props}
                    value={entry.end}
                    onChange={(event) =>
                      setResume({
                        ...resume,
                        education: resume.education.map((item) =>
                          item.id === entry.id ? { ...item, end: event.target.value } : item,
                        ),
                      })
                    }
                  />
                )}
              </Field>
              <div className="sm:col-span-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setResume({
                      ...resume,
                      education: resume.education.filter((item) => item.id !== entry.id),
                    })
                  }
                >
                  <Trash2 aria-hidden />
                  Ta bort
                </Button>
              </div>
            </fieldset>
          ))}

          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              setResume({
                ...resume,
                education: [
                  ...resume.education,
                  { id: newId(), program: '', school: '', start: '', end: '' },
                ],
              })
            }
          >
            <Plus aria-hidden />
            Lägg till utbildning
          </Button>
        </CardContent>
      </Card>

      <JobProfilesCard resume={resume} setResume={setResume} />

      {/*
        The save bar only follows the scroll once there is something to save,
        and then as an opaque toolbar. A bar that floats from the moment the
        page loads lands on top of the controls it passes — the "Lägg till"
        button under Kompetenser sits exactly there — so it covered a button
        before the user had changed anything at all. Sitting in the flow until
        the form is dirty keeps every control reachable on arrival, and once
        the bar does appear its own surface makes it read as a bar rather than
        a button ghosting over another one.
      */}
      <div
        className={cn(
          'z-10 flex justify-end',
          dirty &&
            'sticky bottom-20 items-center gap-3 rounded-[var(--radius-card)] border border-line bg-raised/95 px-3 py-2 shadow-overlay backdrop-blur lg:bottom-4',
        )}
      >
        {dirty ? (
          <>
            <p className="mr-auto text-sm text-muted">Du har osparade ändringar</p>
            <Button variant="ghost" onClick={discardChanges} disabled={saving}>
              Ångra
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Spara
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" onClick={save} loading={saving}>
            Spara CV
          </Button>
        )}
      </div>
    </div>
  );
}

function JobProfilesCard({
  resume,
  setResume,
}: {
  resume: ResumeState;
  setResume: (value: ResumeState | ((current: ResumeState) => ResumeState)) => void;
}) {
  const suggestions = suggestSkillsFromExperience(resume.experience, resume.skills);

  function updateProfile(id: string, patch: Partial<JobProfile>) {
    setResume((current) => ({
      ...current,
      jobProfiles: current.jobProfiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile,
      ),
    }));
  }

  function toggleProfileSkill(profile: JobProfile, skill: string, selected: boolean) {
    if (selected) {
      updateProfile(profile.id, {
        skills: normalizeSkillList([...profile.skills, skill]),
        confirmed: normalizeSkillList([...profile.confirmed, skill]),
      });
      return;
    }
    updateProfile(profile.id, {
      skills: profile.skills.filter((item) => item.toLowerCase() !== skill.toLowerCase()),
      confirmed: profile.confirmed.filter((item) => item.toLowerCase() !== skill.toLowerCase()),
    });
  }

  function addSuggested(label: string) {
    setResume((current) => {
      const skills = normalizeSkillList([...current.skills, label]);
      const profiles =
        current.jobProfiles.length > 0
          ? current.jobProfiles
          : [
              {
                id: newId(),
                label: current.headline || 'Mitt jobbsök',
                skills: [],
                confirmed: [],
              },
            ];
      const [first, ...rest] = profiles;
      if (!first) return { ...current, skills };
      return {
        ...current,
        skills,
        jobProfiles: [
          {
            ...first,
            skills: normalizeSkillList([...first.skills, label]),
            confirmed: normalizeSkillList([...first.confirmed, label]),
          },
          ...rest,
        ],
      };
    });
  }

  return (
    <Card id="jobbprofiler">
      <CardHeader>
        <CardTitle>Jobbprofiler</CardTitle>
        <CardDescription>
          En namngiven lins över dina kompetenser. Välj vilka som ska räknas för just den här
          profilen — osäkra undantag listar du separat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {resume.jobProfiles.map((profile, index) => {
          const uncertain = profile.skills.filter(
            (skill) =>
              !profile.confirmed.some((item) => item.toLowerCase() === skill.toLowerCase()),
          );
          return (
            <fieldset
              key={profile.id}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line p-3"
            >
              <legend className="sr-only">Profil {index + 1}</legend>
              <Field label="Namn">
                {(props) => (
                  <Input
                    {...props}
                    value={profile.label}
                    onChange={(event) =>
                      updateProfile(profile.id, { label: event.target.value })
                    }
                  />
                )}
              </Field>
              {resume.skills.length === 0 ? (
                <p className="text-sm text-muted">
                  Lägg till kompetenser ovanför först — profilen väljer ur den listan.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {resume.skills.map((skill) => {
                    const selected = profile.skills.some(
                      (item) => item.toLowerCase() === skill.toLowerCase(),
                    );
                    return (
                      <li key={skill}>
                        <div className="flex items-center gap-2 text-sm text-ink">
                          <Checkbox
                            checked={selected}
                            aria-label={`Inkludera ${displaySkillLabel(skill)} i profilen`}
                            onCheckedChange={(value) =>
                              toggleProfileSkill(profile, skill, value === true)
                            }
                          />
                          <span>{displaySkillLabel(skill)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {uncertain.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-ink">Osäkra undantag</h3>
                  <p className="mt-1 text-[12px] text-subtle">
                    Allt i profilen räknas som „har det” tills du markerar något som osäkert.
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {uncertain.map((skill) => (
                      <li
                        key={skill}
                        className="flex items-center justify-between gap-2 text-sm text-ink"
                      >
                        <span>{displaySkillLabel(skill)} · osäker</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateProfile(profile.id, {
                              confirmed: normalizeSkillList([...profile.confirmed, skill]),
                            })
                          }
                        >
                          Jag kan detta
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : profile.skills.length > 0 ? (
                <p className="text-[13px] text-muted">
                  Alla valda kompetenser räknas som „har det”.
                  <button
                    type="button"
                    className="ml-1 underline underline-offset-2"
                    onClick={() => {
                      const first = profile.skills[0];
                      if (!first) return;
                      updateProfile(profile.id, {
                        confirmed: profile.confirmed.filter(
                          (item) => item.toLowerCase() !== first.toLowerCase(),
                        ),
                      });
                    }}
                  >
                    Markera en som osäker
                  </button>
                </p>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setResume({
                    ...resume,
                    jobProfiles: resume.jobProfiles.filter((item) => item.id !== profile.id),
                  })
                }
              >
                <Trash2 aria-hidden />
                Ta bort profilen
              </Button>
            </fieldset>
          );
        })}

        {resume.jobProfiles.length < 10 ? (
          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              setResume({
                ...resume,
                jobProfiles: [
                  ...resume.jobProfiles,
                  {
                    id: newId(),
                    label: resume.headline || `Profil ${resume.jobProfiles.length + 1}`,
                    skills: [...resume.skills],
                    confirmed: [...resume.skills],
                  },
                ],
              })
            }
          >
            <Plus aria-hidden />
            Lägg till profil
          </Button>
        ) : null}

        {suggestions.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-ink">Föreslagna från erfarenhet</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {suggestions.slice(0, 12).map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {displaySkillLabel(item.label)}
                    <span className="ml-2 text-[12px] text-subtle">{item.source}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => addSuggested(item.label)}>
                    Lägg till
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

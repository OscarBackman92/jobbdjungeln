'use client';

import { employerKey, normalizeSkillList, roleKey } from '@jobbdjungeln/core';
import { FileUp, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
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
import { type ResumeDraft, parseResumeAction, saveResumeAction } from '@/server/actions/resume';

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
export function ResumeEditor({ initial }: { initial: ResumeState }) {
  const [resume, setResume] = useState<ResumeState>(initial);
  const [saved, setSaved] = useState<ResumeState>(initial);
  const [skillDraft, setSkillDraft] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [saving, startSaving] = useTransition();
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
          ...selectedExperience.map((item) => ({ ...item.entry, id: item.entry.id || newId() })),
        ],
        education: [
          ...current.education.filter(
            (entry) => !overwriteEduKeys.has(educationDupKey(entry.school, entry.program)),
          ),
          ...selectedEducation.map((item) => ({ ...item.entry, id: item.entry.id || newId() })),
        ],
      };
    });
    setReview(null);
    toast.success('Valda delar är inlästa. Gå igenom och rätta innan du sparar.');
  }

  function save() {
    startSaving(async () => {
      const result = await saveResumeAction({ ...resume, jobProfiles: [] });
      if (result.ok) {
        setSaved(resume);
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

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote description={error} /> : null}

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
                      <label className="flex items-start gap-2 text-sm text-ink">
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
                      </label>
                    ) : null}
                    {review.draft.summary ? (
                      <label className="flex items-start gap-2 text-sm text-ink">
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
                      </label>
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
                          <label className="flex items-center gap-2 text-sm text-ink">
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
                                <span className="ml-1.5 text-[12px] text-subtle">finns redan</span>
                              ) : null}
                            </span>
                          </label>
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
                          <label className="flex items-start gap-2 text-sm text-ink">
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
                              <span className="font-medium">{item.entry.role || 'Roll saknas'}</span>
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
                          </label>
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
                          <label className="flex items-start gap-2 text-sm text-ink">
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
                          </label>
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

      <Card>
        <CardHeader>
          <CardTitle>Om dig</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Rubrik" hint="Din roll i en rad, t.ex. Ekonomiassistent.">
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

      <Card>
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
              <li key={skill}>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-2.5 text-[13px] text-brand-text">
                  {skill}
                  <button
                    type="button"
                    onClick={() =>
                      setResume({
                        ...resume,
                        skills: resume.skills.filter((value) => value !== skill),
                      })
                    }
                    aria-label={`Ta bort ${skill}`}
                    className="rounded-full p-0.5 hover:bg-brand/20"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
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

      <Card>
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

      <Card>
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
            'sticky bottom-20 rounded-[var(--radius-card)] border border-line bg-raised/95 px-3 py-2 shadow-overlay backdrop-blur lg:bottom-4',
        )}
      >
        <Button variant="primary" size="lg" onClick={save} loading={saving}>
          Spara CV
        </Button>
      </div>
    </div>
  );
}

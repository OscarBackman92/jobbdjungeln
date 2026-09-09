'use client';

import { normalizeSkillList } from '@jobbdjungeln/core';
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
  ErrorNote,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import { parseResumeAction, saveResumeAction } from '@/server/actions/resume';

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
  const [skillDraft, setSkillDraft] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [parsing, setParsing] = useState(false);
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

    const parsed = result.data;
    setResume((current) => ({
      headline: parsed.headline || current.headline,
      summary: parsed.summary || current.summary,
      skills: normalizeSkillList([...current.skills, ...parsed.skills]),
      experience: [
        ...current.experience,
        ...parsed.experience.map((entry) => ({ ...entry, id: entry.id || newId() })),
      ],
      education: [
        ...current.education,
        ...parsed.education.map((entry) => ({ ...entry, id: newId() })),
      ],
    }));
    toast.success('CV:t är inläst. Gå igenom och rätta innan du sparar.');
  }

  function save() {
    startSaving(async () => {
      const result = await saveResumeAction({ ...resume, jobProfiles: [] });
      if (result.ok) toast.success('CV sparat');
      else setError(result.error);
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

      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button
          variant="primary"
          size="lg"
          onClick={save}
          loading={saving}
          className="shadow-overlay"
        >
          Spara CV
        </Button>
      </div>
    </div>
  );
}

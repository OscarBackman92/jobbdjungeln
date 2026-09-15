'use server';

import { normalizeSkillList, unifyResumeSkills } from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import {
  extractText,
  MAX_UPLOAD_BYTES,
  parseResume,
  ResumeParseError,
} from '@jobbdjungeln/resume';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { type ActionResult, fail, fromZod, ok } from './result.ts';
import { resumeSchema } from './schemas.ts';

function entryId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** A parsed CV, with a stable id on each entry so the editor can key on it. */
export interface ResumeDraft {
  headline: string;
  summary: string;
  skills: string[];
  experience: Array<{
    id: string;
    role: string;
    employer: string;
    start: string;
    end: string;
    description: string;
    skills: string[];
  }>;
  education: Array<{ id: string; program: string; school: string; start: string; end: string }>;
  contact: { email: string; phone: string };
}

/**
 * Parse an uploaded CV into an editable draft.
 *
 * The file is read into memory and discarded here — nothing is written to disk
 * and nothing is stored until the user reviews the draft and saves it.
 */
export async function parseResumeAction(
  formData: FormData,
): Promise<ActionResult<ResumeDraft>> {
  await requireUser();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Välj en fil att läsa in.');
  if (file.size > MAX_UPLOAD_BYTES) return fail('Filen är större än 2 MB.');

  try {
    const text = await extractText(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    const parsed = parseResume(text);
    return ok({
      ...parsed,
      experience: parsed.experience.map((entry) => ({ ...entry, id: entryId() })),
      education: parsed.education.map((entry) => ({ ...entry, id: entryId() })),
    });
  } catch (error) {
    if (error instanceof ResumeParseError) return fail(error.message);
    console.error('[cv] tolkning misslyckades', error);
    return fail('Kunde inte läsa filen. Prova att spara om den som PDF.');
  }
}

export async function saveResumeAction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = resumeSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  const unified = unifyResumeSkills({
    skills: parsed.data.skills,
    jobProfiles: parsed.data.jobProfiles,
  });

  const values = {
    headline: parsed.data.headline,
    summary: parsed.data.summary,
    skills: unified.skills,
    experience: parsed.data.experience.map((entry) => ({
      ...entry,
      id: entry.id || entryId(),
      skills: normalizeSkillList(entry.skills),
    })),
    education: parsed.data.education.map((entry) => ({ ...entry, id: entry.id || entryId() })),
    jobProfiles: unified.jobProfiles.map((profile) => ({
      ...profile,
      id: profile.id || entryId(),
    })),
  };

  await db()
    .insert(schema.resumes)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: schema.resumes.userId, set: values });

  revalidatePath('/profil');
  revalidatePath('/annonser');
  revalidatePath('/oversikt');
  return ok();
}

/** Append a term to the flat skill list and the first profile's confirmed set. */
export async function addSkillToResumeAction(term: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const label = normalizeSkillList([term])[0];
  if (!label) return fail('Ange en kompetens.');

  const resume = await db().query.resumes.findFirst({
    where: eq(schema.resumes.userId, user.id),
  });
  const skills = normalizeSkillList([...(resume?.skills ?? []), label]);
  const existingProfiles = resume?.jobProfiles ?? [];
  const jobProfiles =
    existingProfiles.length > 0
      ? existingProfiles.map((profile, index) =>
          index === 0
            ? {
                ...profile,
                skills: normalizeSkillList([...profile.skills, label]),
                confirmed: normalizeSkillList([...profile.confirmed, label]),
              }
            : profile,
        )
      : [
          {
            id: entryId(),
            label: resume?.headline || 'Mitt jobbsök',
            skills: [label],
            confirmed: [label],
          },
        ];

  const values = {
    headline: resume?.headline ?? '',
    summary: resume?.summary ?? '',
    skills,
    experience: resume?.experience ?? [],
    education: resume?.education ?? [],
    jobProfiles,
  };

  await db()
    .insert(schema.resumes)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: schema.resumes.userId, set: values });

  revalidatePath('/profil');
  revalidatePath('/annonser');
  revalidatePath('/oversikt');
  return ok();
}

export async function deleteResumeAction(): Promise<ActionResult<void>> {
  const user = await requireUser();
  await db().delete(schema.resumes).where(eq(schema.resumes.userId, user.id));
  revalidatePath('/profil');
  return ok();
}

import { JobTechError, MAX_LIMIT } from '@jobbdjungeln/jobtech';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { searchJobs } from '@/server/queries/jobs';

/** Live Platsbanken search, with duplicate flags and CV match layered on. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 });

  const url = new URL(request.url);
  const number = (key: string, fallback: number) => {
    const value = Number(url.searchParams.get(key));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };

  try {
    const experienceParam = url.searchParams.get('erfarenhet');
    const result = await searchJobs(
      user.id,
      {
        q: url.searchParams.get('q') ?? '',
        regions: url.searchParams.getAll('region'),
        municipalities: url.searchParams.getAll('kommun'),
        fields: url.searchParams.getAll('omrade'),
        groups: url.searchParams.getAll('yrkesgrupp'),
        remote: url.searchParams.get('distans') === '1',
        sort:
          (url.searchParams.get('sort') as
            | 'pubdate-desc'
            | 'relevance'
            | 'applydate-asc'
            | 'applydate-desc'
            | null) ?? undefined,
        publishedAfter: url.searchParams.get('publicerad') ?? undefined,
        experience: experienceParam === '0' ? false : undefined,
        employmentType: url.searchParams.getAll('anstallningstyp'),
        offset: number('offset', 0),
        // JobTech allows 0–MAX_LIMIT; 0 is a count-only request.
        limit: Math.min(number('limit', 25), MAX_LIMIT),
      },
      {
        withMatch: number('limit', 25) !== 0 && url.searchParams.get('cv') !== '0',
      },
    );

    return NextResponse.json(result, {
      // The results are user-specific (tracked flags, CV match), so they are
      // never cached anywhere shared.
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof JobTechError) {
      return NextResponse.json(
        { error: 'Platsbanken svarar inte just nu. Försök igen om en stund.' },
        { status: 502 },
      );
    }
    console.error('[jobs] sökning misslyckades', error);
    return NextResponse.json({ error: 'Något gick fel.' }, { status: 500 });
  }
}

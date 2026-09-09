import { JobTechError, OCCUPATION_FIELDS, REGIONS } from '@jobbdjungeln/jobtech';
import { NextResponse } from 'next/server';
import { jobtech } from '@/lib/jobtech';
import { currentUser } from '@/lib/session';

/**
 * Filter options.
 *
 * Regions and occupation fields are built in, so the dropdowns render instantly
 * and keep working when the taxonomy API is down. Narrower lists are fetched
 * for every selected parent (several län → merged kommuner).
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 });

  const url = new URL(request.url);
  const regionIds = [...new Set(url.searchParams.getAll('region').filter(Boolean))];
  const fieldIds = [...new Set(url.searchParams.getAll('omrade').filter(Boolean))];

  try {
    const client = jobtech();
    const [municipalityLists, groupLists] = await Promise.all([
      Promise.all(regionIds.map((id) => client.municipalities(id))),
      Promise.all(fieldIds.map((id) => client.occupationGroups(id))),
    ]);

    const municipalities = mergeById(municipalityLists.flat());
    const groups = mergeById(groupLists.flat());

    return NextResponse.json(
      { regions: REGIONS, fields: OCCUPATION_FIELDS, municipalities, groups },
      { headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    if (error instanceof JobTechError) {
      return NextResponse.json(
        { regions: REGIONS, fields: OCCUPATION_FIELDS, municipalities: [], groups: [] },
        { status: 200 },
      );
    }
    throw error;
  }
}

function mergeById<T extends { id: string; label: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  out.sort((a, b) => a.label.localeCompare(b.label, 'sv'));
  return out;
}

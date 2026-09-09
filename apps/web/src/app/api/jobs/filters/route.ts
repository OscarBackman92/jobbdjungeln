import { JobTechError, OCCUPATION_FIELDS, REGIONS } from '@jobbdjungeln/jobtech';
import { NextResponse } from 'next/server';
import { jobtech } from '@/lib/jobtech';
import { currentUser } from '@/lib/session';

/**
 * Filter options.
 *
 * Regions and occupation fields are built in, so the dropdowns render instantly
 * and keep working when the taxonomy API is down. The narrower lists are fetched
 * only once a broader filter is picked.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 });

  const url = new URL(request.url);
  const regionId = url.searchParams.get('region');
  const fieldId = url.searchParams.get('omrade');

  try {
    const [municipalities, groups] = await Promise.all([
      regionId ? jobtech().municipalities(regionId) : Promise.resolve([]),
      fieldId ? jobtech().occupationGroups(fieldId) : Promise.resolve([]),
    ]);

    return NextResponse.json(
      { regions: REGIONS, fields: OCCUPATION_FIELDS, municipalities, groups },
      // The taxonomy is the same for everyone and changes about never.
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

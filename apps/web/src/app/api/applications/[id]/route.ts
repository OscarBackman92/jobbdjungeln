import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { getApplicationWithEvents } from '@/server/applications';

/**
 * One application with its timeline.
 *
 * A route handler rather than a server component because the detail sheet loads
 * on demand, from the client, after the board has already rendered.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 });

  const { id } = await context.params;
  const application = await getApplicationWithEvents(user.id, id);
  // 404 rather than 403 for someone else's row: the response must not confirm
  // that an id exists.
  if (!application) return NextResponse.json({ error: 'Finns inte.' }, { status: 404 });

  return NextResponse.json(application, {
    headers: { 'cache-control': 'private, no-store' },
  });
}

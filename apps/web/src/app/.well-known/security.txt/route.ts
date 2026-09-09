import { env } from '@/lib/env';

/**
 * RFC 9116 security.txt.
 *
 * Only served when a contact address is configured — a security.txt pointing
 * nowhere is worse than none at all.
 */
export async function GET(): Promise<Response> {
  const config = env();
  if (!config.CONTACT_EMAIL) return new Response('Not found', { status: 404 });

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const body = [
    `Contact: mailto:${config.CONTACT_EMAIL}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: sv, en',
    `Canonical: ${config.APP_URL}/.well-known/security.txt`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
}

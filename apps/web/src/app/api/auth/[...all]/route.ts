import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';

/**
 * Every auth endpoint — sign-in, sign-up, verification, OAuth callbacks.
 *
 * The handler is built on the first request rather than when the module loads,
 * so `next build` never needs the runtime secrets just to collect page data.
 */
export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}

import 'server-only';
import { env } from '../env.ts';

/**
 * Outbound e-mail.
 *
 * Brevo's HTTP API is preferred because SMTP ports are blocked on most hosting
 * platforms; plain SMTP is the fallback. With neither configured, mail is logged
 * to the server console — fine for local development. Production refuses to
 * start without a provider (see env.ts).
 */

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailResult = { delivered: boolean; via: 'brevo' | 'smtp' | 'console' };

function parseAddress(value: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);
  if (!match?.[2]) return { email: value.trim() };
  const name = match[1]?.trim();
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
}

async function sendViaBrevo(mail: Mail, apiKey: string): Promise<void> {
  const sender = parseAddress(env().EMAIL_FROM);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo svarade ${response.status}: ${body}`);
  }

  let messageId: string | undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'messageId' in parsed &&
      typeof parsed.messageId === 'string'
    ) {
      messageId = parsed.messageId;
    }
  } catch {
    // Brevo sometimes returns an empty body; delivery still succeeded.
  }

  console.info('[mail] skickat via Brevo', {
    to: mail.to,
    subject: mail.subject,
    from: sender.email,
    messageId,
  });
}

async function sendViaSmtp(mail: Mail, url: string): Promise<void> {
  // Imported lazily so the dependency is only needed by deployments using SMTP.
  const { createTransport } = await import('nodemailer');
  const transport = createTransport(url);
  await transport.sendMail({
    from: env().EMAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

/**
 * Send one message.
 *
 * A delivery failure never throws into the caller: an unsendable password-reset
 * mail must not turn into a 500 that tells an attacker the address exists.
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  const { BREVO_API_KEY, SMTP_URL } = env();

  try {
    if (BREVO_API_KEY) {
      await sendViaBrevo(mail, BREVO_API_KEY);
      return { delivered: true, via: 'brevo' };
    }
    if (SMTP_URL) {
      await sendViaSmtp(mail, SMTP_URL);
      return { delivered: true, via: 'smtp' };
    }
  } catch (error) {
    console.error('[mail] kunde inte skicka', { to: mail.to, subject: mail.subject, error });
    return { delivered: false, via: BREVO_API_KEY ? 'brevo' : 'smtp' };
  }

  console.info(
    `\n─── E-post (ingen leverantör konfigurerad) ───\nTill: ${mail.to}\nÄmne: ${mail.subject}\n\n${mail.text}\n─────────────────────────────────────────────\n`,
  );
  return { delivered: true, via: 'console' };
}

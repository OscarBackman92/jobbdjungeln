import 'server-only';
import type { Mail } from './send.ts';

/**
 * E-mail templates.
 *
 * Hand-written table-free HTML with an inline stylesheet: mail clients ignore
 * most CSS, so the layout is kept to a single centred column that degrades to
 * readable text when everything is stripped. Every message also carries a plain
 * text alternative, which is what most clients show in the preview line.
 */

const BRAND = '#1f6f52';

function layout(title: string, body: string, footer = ''): string {
  return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#26241f;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e7e5e0">
<p style="margin:0 0 24px;font-size:15px;font-weight:600;color:${BRAND};letter-spacing:-0.01em">Jobbdjungeln</p>
${body}
</div>
<p style="max-width:560px;margin:20px auto 0;font-size:12px;color:#7a766d">
${footer || 'Du får det här mejlet för att du har ett konto på Jobbdjungeln.'}
</p>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">${escapeHtml(label)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#7a766d">Fungerar inte knappen? Kopiera länken:</p>
<p style="margin:0;font-size:13px;word-break:break-all"><a href="${escapeHtml(href)}" style="color:${BRAND}">${escapeHtml(href)}</a></p>`;
}

export function verifyEmail(to: string, url: string): Mail {
  return {
    to,
    subject: 'Bekräfta din e-postadress',
    html: layout(
      'Bekräfta din e-postadress',
      `<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em">Bekräfta din e-postadress</h1>
<p style="margin:0;font-size:15px">Klicka på knappen så aktiveras ditt konto. Länken gäller i 24 timmar.</p>
${button(url, 'Bekräfta adressen')}`,
      'Har du inte skapat något konto? Då kan du strunta i det här mejlet.',
    ),
    text: `Bekräfta din e-postadress\n\nÖppna länken så aktiveras ditt konto. Den gäller i 24 timmar.\n\n${url}\n\nHar du inte skapat något konto kan du strunta i det här mejlet.`,
  };
}

export function resetPassword(to: string, url: string): Mail {
  return {
    to,
    subject: 'Återställ ditt lösenord',
    html: layout(
      'Återställ ditt lösenord',
      `<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em">Återställ ditt lösenord</h1>
<p style="margin:0;font-size:15px">Länken gäller i en timme. Alla inloggade enheter loggas ut när lösenordet byts.</p>
${button(url, 'Välj nytt lösenord')}`,
      'Har du inte bett om ett nytt lösenord? Då behöver du inte göra någonting — ditt nuvarande gäller fortfarande.',
    ),
    text: `Återställ ditt lösenord\n\nÖppna länken och välj ett nytt lösenord. Den gäller i en timme.\n\n${url}\n\nHar du inte bett om det här behöver du inte göra någonting.`,
  };
}

export interface ReminderItem {
  company: string;
  title: string;
  due: string;
  reason: string;
}

export function reminders(to: string, items: readonly ReminderItem[], appUrl: string): Mail {
  const rows = items
    .map(
      (item) =>
        `<li style="margin:0 0 10px"><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.company)}<br><span style="color:#7a766d;font-size:14px">${escapeHtml(item.reason)} ${escapeHtml(item.due)}</span></li>`,
    )
    .join('');

  return {
    to,
    subject:
      items.length === 1
        ? '1 sak att göra i jobbsöket'
        : `${items.length} saker att göra i jobbsöket`,
    html: layout(
      'Dagens påminnelser',
      `<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em">Dagens påminnelser</h1>
<ul style="margin:0;padding-left:20px;font-size:15px">${rows}</ul>
${button(`${appUrl}/oversikt`, 'Öppna Jobbdjungeln')}`,
      'Vill du inte ha påminnelser? Stäng av dem under Profil.',
    ),
    text: `Dagens påminnelser\n\n${items
      .map((item) => `- ${item.title} — ${item.company} (${item.reason} ${item.due})`)
      .join('\n')}\n\n${appUrl}/oversikt`,
  };
}

export interface WeeklySummaryData {
  applied: number;
  waiting: number;
  inDialog: number;
  savedDueSoon: number;
  newHits: Array<{ title: string; company: string; url: string }>;
}

export function weeklySummary(to: string, data: WeeklySummaryData, appUrl: string): Mail {
  const hits = data.newHits
    .map(
      (hit) =>
        `<li style="margin:0 0 8px"><a href="${escapeHtml(hit.url)}" style="color:${BRAND};font-weight:600">${escapeHtml(hit.title)}</a> — ${escapeHtml(hit.company)}</li>`,
    )
    .join('');

  return {
    to,
    subject: 'Veckan i jobbsöket',
    html: layout(
      'Veckan i jobbsöket',
      `<h1 style="margin:0 0 16px;font-size:22px;letter-spacing:-0.02em">Veckan i jobbsöket</h1>
<p style="margin:0 0 6px;font-size:15px">${data.applied} sökta jobb den senaste veckan.</p>
<p style="margin:0 0 6px;font-size:15px">${data.inDialog} pågående dialoger, ${data.waiting} väntar på svar.</p>
<p style="margin:0;font-size:15px">${data.savedDueSoon} sparade jobb behöver sökas snart.</p>
${data.newHits.length ? `<h2 style="margin:26px 0 10px;font-size:17px">Nytt från dina sparade sökningar</h2><ul style="margin:0;padding-left:20px;font-size:15px">${hits}</ul>` : ''}
${button(`${appUrl}/oversikt`, 'Öppna Jobbdjungeln')}`,
      'Vill du inte ha veckobrevet? Stäng av det under Profil.',
    ),
    text: `Veckan i jobbsöket\n\n${data.applied} sökta jobb senaste veckan.\n${data.inDialog} pågående dialoger, ${data.waiting} väntar på svar.\n${data.savedDueSoon} sparade jobb behöver sökas snart.\n\n${data.newHits
      .map((hit) => `- ${hit.title} — ${hit.company}: ${hit.url}`)
      .join('\n')}\n\n${appUrl}/oversikt`,
  };
}

export function inactivityWarning(to: string, days: number, appUrl: string): Mail {
  return {
    to,
    subject: 'Ditt konto raderas om 30 dagar',
    html: layout(
      'Ditt konto raderas om 30 dagar',
      `<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em">Ditt konto raderas om 30 dagar</h1>
<p style="margin:0;font-size:15px">Du har inte loggat in på ${days} dagar. Konton som varit vilande i två år raderas automatiskt, med allt de innehåller.</p>
<p style="margin:14px 0 0;font-size:15px">Vill du behålla ditt konto räcker det att logga in.</p>
${button(`${appUrl}/logga-in`, 'Logga in')}`,
      'Det här är ett automatiskt utskick som del av vår gallring av vilande konton.',
    ),
    text: `Ditt konto raderas om 30 dagar\n\nDu har inte loggat in på ${days} dagar. Konton som varit vilande i två år raderas automatiskt.\n\nLogga in för att behålla kontot: ${appUrl}/logga-in`,
  };
}

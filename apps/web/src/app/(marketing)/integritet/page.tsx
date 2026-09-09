import type { Metadata } from 'next';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Integritetspolicy',
  description: 'Vilka uppgifter Jobbdjungeln behandlar, varför, och hur länge.',
};

export default function PrivacyPage() {
  const contact = env().CONTACT_EMAIL;

  return (
    <article className="flex flex-col gap-6 text-[15px] leading-relaxed text-muted">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Integritetspolicy</h1>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Vad som lagras</h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        <li>Din e-postadress, för inloggning och de utskick du valt.</li>
        <li>De ansökningar och sparade jobb du lägger in, med dina anteckningar.</li>
        <li>
          Ditt CV — men bara de strukturerade fälten du sparat, aldrig filen du laddade upp.
        </li>
        <li>Dina sparade sökningar och dina månadsrapporter.</li>
      </ul>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Uppgifter om andra</h2>
      <p>
        Dina anteckningar kan innehålla namn och kontaktuppgifter till rekryterare. De behandlas
        som en del av din ansökan, är bara synliga för dig, och raderas tillsammans med kontot.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Uppladdade CV-filer</h2>
      <p>
        En uppladdad PDF eller DOCX tolkas i minnet och kastas i samma begäran. Filen skrivs
        aldrig till disk och lämnar aldrig servern. Det som sparas är utkastet du granskat och
        godkänt.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Cookies</h2>
      <p>
        En enda cookie används, för din inloggning. Den är <code>httpOnly</code> och{' '}
        <code>SameSite=Lax</code>, kan inte läsas av JavaScript, och sätts bara när du loggar
        in. Ingen analys, inga annonsnätverk, ingen spårning mellan sajter.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Hur länge</h2>
      <p>
        Så länge du har ett konto. Ett konto som varit oanvänt i 24 månader raderas automatiskt,
        efter ett varningsmejl 30 dagar i förväg. Att logga in nollställer klockan.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Dina rättigheter</h2>
      <p>
        Under Profil kan du när som helst exportera allt du lagt in som CSV, och radera kontot
        själv. Radering är omedelbar och tar med sig allt kontot äger — ansökningar, tidslinjer,
        CV, sparade sökningar och rapporter.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Tredje part</h2>
      <p>
        Annonssökningar går till Arbetsförmedlingens öppna JobTech-API. De skickas utan
        användaridentitet — bara sökorden och filtren. Utgående e-post skickas via en
        e-postleverantör som då behandlar din adress och meddelandets innehåll.
      </p>

      {contact ? (
        <>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Kontakt</h2>
          <p>
            Frågor om personuppgifter, eller en sårbarhet att rapportera:{' '}
            <a
              href={`mailto:${contact}`}
              className="text-brand-text underline underline-offset-2"
            >
              {contact}
            </a>
            .
          </p>
        </>
      ) : null}
    </article>
  );
}

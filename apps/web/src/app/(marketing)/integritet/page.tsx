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
      <p className="text-sm text-subtle">Version 2026-09-16</p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Personuppgiftsansvarig</h2>
      <p>
        Oscar Backman är personuppgiftsansvarig för behandlingen av dina uppgifter i tjänsten
        Jobbdjungeln.
        {contact ? (
          <>
            {' '}
            Kontakt:{' '}
            <a
              href={`mailto:${contact}`}
              className="text-brand-text underline underline-offset-2"
            >
              {contact}
            </a>
            .
          </>
        ) : (
          <> Kontakta oss via uppgifterna som anges på webbplatsen.</>
        )}
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Rättslig grund</h2>
      <p>
        Vi behandlar dina uppgifter för att kunna tillhandahålla kontot och de funktioner du
        använder (avtal / berättigat intresse för en personlig jobbsökartjänst), och för de
        utskick du uttryckligen valt (samtycke, som du kan dra tillbaka under Profil).
      </p>

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

      <h2 className="text-lg font-semibold tracking-tight text-ink">Underbiträden</h2>
      <p>
        För att driva tjänsten anlitar vi leverantörer som behandlar uppgifter på våra uppdrag:
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        <li>
          <span className="text-ink">Vercel</span> — hosting och körning av webbapplikationen.
        </li>
        <li>
          <span className="text-ink">Neon</span> (PostgreSQL i EU) — databas och lagring av
          kontouppgifter.
        </li>
        <li>
          <span className="text-ink">Brevo</span> (eller annan e-postleverantör) — utskick av
          verifiering, påminnelser och sammanfattningar du valt.
        </li>
      </ul>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Tredjelandsöverföring</h2>
      <p>
        Vi strävar efter att behandla data inom EU/EES när det är möjligt (bland annat genom att
        styra funktionsregion till Stockholm / <code>arn1</code> där plattformen tillåter det).
        Vissa underbiträden kan ändå köra delar av infrastrukturen utanför EU. När så sker sker
        överföringen enligt gällande skyddsmekanismer hos leverantören (t.ex. standardavtalsklausuler).
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Dina rättigheter</h2>
      <p>
        Under Profil kan du när som helst exportera allt du lagt in som CSV, och radera kontot
        själv. Radering är omedelbar och tar med sig allt kontot äger — ansökningar, tidslinjer,
        CV, sparade sökningar och rapporter. Du har också rätt att begära tillgång, rättelse och
        begränsning enligt GDPR, samt att lämna klagomål till{' '}
        <a
          href="https://www.imy.se"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-text underline underline-offset-2"
        >
          Integritetsskyddsmyndigheten (IMY)
        </a>
        .
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Tredje part</h2>
      <p>
        Annonssökningar går till Arbetsförmedlingens öppna JobTech-API. De skickas utan
        användaridentitet — bara sökorden och filtren. Utgående e-post skickas via
        e-postleverantören ovan, som då behandlar din adress och meddelandets innehåll.
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

      <p className="border-t border-line pt-4 text-sm text-subtle">
        Texten är en beskrivning av hur Jobbdjungeln hanterar personuppgifter, inte juridisk rådgivning.
      </p>
    </article>
  );
}

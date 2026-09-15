import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vanliga frågor',
  description: 'Frågor och svar om Jobbdjungeln.',
};

const QUESTIONS = [
  {
    q: 'Kostar det något?',
    a: 'Nej. Det finns ingen betalning, inga nivåer och ingen provperiod som tar slut.',
  },
  {
    q: 'Har appen någon koppling till Arbetsförmedlingen?',
    a: 'Nej. Annonserna hämtas från deras öppna JobTech-API, som vem som helst får använda, men tjänsten är inte deras och lämnar inte in någonting åt dig. Månadsrapporten är en lista att utgå från när du fyller i aktivitetsrapporten hos AF.',
  },
  {
    q: 'Sparas mitt CV?',
    a: 'Själva filen sparas aldrig. Den läses i minnet, tolkas till ett utkast du får rätta, och det du väljer att spara är de strukturerade fälten — rubrik, kompetenser, erfarenhet, utbildning.',
  },
  {
    q: 'Hur räknas matchningen ut?',
    a: 'Annonstexten delas upp i rader som klassas som krav eller meriterande utifrån hur de är formulerade. Dina kompetenser matchas mot dem, och poängen är hur stor andel av annonsens krav du täcker — aldrig hur stor andel av ditt CV som nämns. Ett längre CV kan alltså inte ge en högre siffra.',
  },
  {
    q: 'Varför ser matchningen osäker ut ibland?',
    a: 'När en annons listar bara ett fåtal tydliga krav markeras siffran som osäker (streckad kant) och förklaringen säger hur många krav som hittades. Finns inga krav alls visas "Inga krav listade".',
  },
  {
    q: 'Kan jag lägga in jobb jag hittat någon annanstans?',
    a: 'Ja. En rad behöver bara arbetsgivare och roll, så tips, LinkedIn-annonser och spontanansökningar får plats i samma lista.',
  },
  {
    q: 'Vad händer om jag slutar använda appen?',
    a: 'Efter 24 månaders inaktivitet raderas kontot automatiskt, med ett varningsmejl 30 dagar innan. Loggar du in nollställs klockan.',
  },
] as const;

export default function FaqPage() {
  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Vanliga frågor</h1>
      <dl className="flex flex-col gap-6">
        {QUESTIONS.map(({ q, a }) => (
          <div key={q}>
            <dt className="text-[15px] font-semibold text-ink">{q}</dt>
            <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{a}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

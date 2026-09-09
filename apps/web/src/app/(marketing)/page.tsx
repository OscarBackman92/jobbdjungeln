import {
  Bookmark,
  CalendarClock,
  ClipboardList,
  FileText,
  Search,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent } from '@/components/ui';
import { currentUser } from '@/lib/session';

const FEATURES = [
  {
    icon: Search,
    title: 'Hela Platsbanken',
    body: 'Sök alla annonser live via Arbetsförmedlingens öppna API, med filter för län, kommun, yrkesområde och distans. Spara en annons med ett klick.',
  },
  {
    icon: Bookmark,
    title: 'Sparade jobb, sorterade efter tid',
    body: 'Wishlistan grupperas efter hur bråttom det är: utgångna, bråttom, den här månaden, utan sista dag, lagda på is.',
  },
  {
    icon: CalendarClock,
    title: 'Ansökningar som inte glöms bort',
    body: 'De som varit tysta för länge hamnar överst. Statusbyten loggas automatiskt i en tidslinje per ansökan.',
  },
  {
    icon: FileText,
    title: 'CV-matchning som förklarar sig',
    body: 'Ladda upp ditt CV så matchas dina kompetenser mot annonsens krav. Du ser alltid vad som räknades som träff och vad som saknades.',
  },
  {
    icon: ClipboardList,
    title: 'Månadsrapporten färdig',
    body: 'Aktivitetsrapporten sammanställs av det du redan lagt in, i samma ordning som AF:s formulär frågar. Kopiera raderna eller ladda ner CSV.',
  },
  {
    icon: ShieldCheck,
    title: 'Din data, dina villkor',
    body: 'Inga tredjepartscookies, ingen analys, ingen försäljning. Exportera allt när du vill och radera kontot själv.',
  },
] as const;

export default async function LandingPage() {
  const user = await currentUser();

  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col items-start gap-5 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
          Koll på hela ditt jobbsök — utan Excel-arket
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted">
          Sparade annonser, skickade ansökningar, uppföljningar, intervjuer och månadsrapporten
          på ett ställe. Jobbdjungeln kommer ihåg vad du sökt, vem du pratat med och vad som
          väntar — så att du kan lägga energin på ansökningarna i stället för på bokföringen av
          dem.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" variant="primary" asChild>
            <Link href={user ? '/oversikt' : '/skapa-konto'}>
              {user ? 'Öppna appen' : 'Kom igång gratis'}
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/om">Hur funkar det?</Link>
          </Button>
        </div>
      </section>

      <section aria-label="Funktioner" className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="pt-5">
              <span className="flex size-9 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand-text">
                <Icon className="size-4" aria-hidden />
              </span>
              <h2 className="mt-3 text-[15px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-sunken px-6 py-8">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Så kommer du igång</h2>
        <ol className="mt-4 flex flex-col gap-3 text-sm text-muted">
          <li>
            <span className="font-medium text-ink">1. Skapa ett konto</span> med din
            e-postadress. Du bekräftar adressen och är igång.
          </li>
          <li>
            <span className="font-medium text-ink">2. Lägg in ditt CV</span> — ladda upp en PDF
            så läses kompetenserna ut åt dig. Filen sparas aldrig.
          </li>
          <li>
            <span className="font-medium text-ink">3. Sök och spara annonser.</span> När du sökt
            ett jobb markerar du det som sökt, och resten sköter sig.
          </li>
        </ol>
        <Button className="mt-6" variant="primary" asChild>
          <Link href={user ? '/oversikt' : '/skapa-konto'}>
            {user ? 'Öppna appen' : 'Skapa konto'}
          </Link>
        </Button>
      </section>

      <p className="text-[13px] text-subtle">
        Jobbdjungeln är ett personligt hjälpmedel och har ingen koppling till
        Arbetsförmedlingen. Annonsdata hämtas från deras öppna{' '}
        <a
          href="https://jobtechdev.se"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-muted"
        >
          JobTech-API
        </a>
        .
      </p>
    </div>
  );
}

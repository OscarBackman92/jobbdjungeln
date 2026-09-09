import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Om tjänsten',
  description: 'Vad Jobbdjungeln gör, vad den inte gör, och varför den finns.',
};

export default function AboutPage() {
  return (
    <article className="flex flex-col gap-6 text-[15px] leading-relaxed text-muted">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Om Jobbdjungeln</h1>

      <p>
        De flesta som söker jobb bygger förr eller senare ett eget kalkylark: en rad per
        ansökan, kolumner för status, datum och vem som ringde. Det fungerar tills det blir
        trettio rader, och sedan slutar det uppdateras. Jobbdjungeln är det arket, gjort
        ordentligt.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Vad appen gör</h2>
      <p>
        Den håller reda på två saker som är lätta att blanda ihop: annonser du <em>vill</em>{' '}
        söka, och jobb du <em>har</em> sökt. Det första är en lista sorterad efter hur bråttom
        det är. Det andra är en lista sorterad efter vad som behöver göras — och det som varit
        tyst för länge ligger överst, eftersom det är där de flesta möjligheter tappas.
      </p>
      <p>
        Annonssökningen går direkt mot Arbetsförmedlingens öppna JobTech-API och täcker hela
        Platsbanken. Det finns ingen lokal kopia av annonserna som kan bli inaktuell.
      </p>
      <p>
        CV:t har ett enda syfte här: att matcha mot annonstexter. Matchningen är regelbaserad
        och förklarar sig alltid — du ser vilka krav som hittades i annonsen, vilka du täcker
        och vilka du saknar. När en annons är för tunn för att bedömas rättvist visas ingen
        siffra alls, eftersom en påhittad procentsats är sämre än ingen.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Vad appen inte gör</h2>
      <p>
        Den skickar inga ansökningar åt dig, skriver inga personliga brev och har ingen koppling
        till Arbetsförmedlingen. Månadsrapporten är ett personligt hjälpmedel: den sammanställer
        listan, du lämnar in den hos AF som vanligt.
      </p>

      <h2 className="text-lg font-semibold tracking-tight text-ink">Öppen data</h2>
      <p>
        Annonser och yrkestaxonomi kommer från{' '}
        <a
          href="https://jobtechdev.se"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-text underline underline-offset-2"
        >
          JobTech Development
        </a>
        , Arbetsförmedlingens öppna plattform. Ingen API-nyckel, ingen inloggning, inga cookies
        mot dem.
      </p>
    </article>
  );
}

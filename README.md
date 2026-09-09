# Jobbdjungeln

**Koll på hela ditt jobbsök.** Sparade annonser, skickade ansökningar,
uppföljningar och månadsrapporten på ett ställe — med sökning över hela
Platsbanken och CV-matchning som förklarar sig själv.

> Det här är en omskrivning av [af-jobbansokan-api][gammal] i en modern
> TypeScript-stack. Domänlogiken är portad och skärpt; se
> [Vad som ändrats](#vad-som-ändrats-mot-den-gamla-versionen).

[gammal]: https://github.com/OscarBackman92/af-jobbansokan-api

## Vad appen gör

| Vy | Vad den är till för |
| --- | --- |
| **Översikt** | Nyckeltal, nästa steg, tratten från sökt till erbjudande, takt och utfall |
| **Sparade jobb** | Annonser du vill söka, grupperade efter hur bråttom det är |
| **Ansökningar** | Allt du sökt, grupperat efter vad som behöver göras — tyst för länge hamnar överst |
| **Annonser** | Live-sökning i hela Platsbanken med CV-matchning per träff |
| **Rapport** | Månadens aktiviteter i den ordning AF:s formulär frågar efter dem |
| **Profil** | CV, e-postinställningar, export och radering av kontot |

## Teknik

| Lager | Val |
| --- | --- |
| Ramverk | Next.js 16 (App Router, Turbopack) + React 19 |
| Språk | TypeScript 7, `strict` med `noUncheckedIndexedAccess` |
| Databas | PostgreSQL + Drizzle ORM, migrationer i SQL |
| Auth | better-auth — sessionscookie, e-postverifiering, valfri Google-inloggning |
| UI | Tailwind CSS v4 (CSS-first) + Radix Primitives |
| Data i klienten | TanStack Query, mutationer via Server Actions |
| Validering | Zod v4 på varje ingång |
| Kvalitet | Biome, Vitest, Playwright, PGlite för databastester |
| Bygge | pnpm workspaces + Turborepo |

## Struktur

```text
apps/web/            Next.js-appen: sidor, server actions, API-rutter, UI
packages/core/       Domänlogik som rena funktioner — ingen databas, inga ramverk
packages/db/         Drizzle-schema, migrationer, klient
packages/jobtech/    Klient mot Arbetsförmedlingens öppna JobTech-API
packages/resume/     CV-tolkning: textutvinning ur PDF/DOCX + heuristisk parsning
```

Domänlogiken ligger avsiktligt utanför appen. Statusövergångar, väntetider,
matchningspoäng och rapportperioder är rena funktioner som går att testa utan
att starta vare sig databas eller webbserver — och det är också där de flesta
testerna finns.

## Kom igång

Krav: Node 22+, pnpm 10, Docker (eller en PostgreSQL du redan har).

```bash
pnpm install
cp .env.example .env

docker compose up -d          # PostgreSQL på 5432
pnpm db:migrate               # skapar tabellerna

pnpm dev                      # http://localhost:3000
```

Utan e-postleverantör skrivs utgående mejl till serverloggen — verifieringslänken
går att klicka direkt därifrån. Det är hela den lokala uppsättningen.

### Kommandon

```bash
pnpm dev            # utvecklingsserver
pnpm build          # produktionsbygge
pnpm check          # lint + typer + enhetstester
pnpm test           # enhetstester (Vitest)
pnpm test:e2e       # end-to-end (Playwright) — startar sin egen stack
pnpm db:generate    # ny migration från schemaändringar
pnpm db:studio      # bläddra i databasen
```

## Så fungerar de delar som är värda att förstå

### Statusar

Det finns **en** statusaxel. Den projiceras på två härledda: `stage` (var raden
är) och `outcome` (hur det gick). Sparade jobb och riktiga ansökningar ligger i
samma tabell och skiljs bara av sitt stage, vilket är varför en annons kan bli en
ansökan utan att flytta någonstans.

Tillåtna övergångar är en del av domänen, inte av gränssnittet: menyn kan bara
erbjuda det servern skulle acceptera. En avslutad ansökan får öppnas igen — folk
blir uppringda — men en rad kan aldrig gå tillbaka till att vara bara bevakad.

### Matchningen

Poängen är **hur stor andel av annonsens krav du täcker**, aldrig hur stor andel
av ditt CV som nämns. Ett längre CV kan därför inte ge en högre siffra.

Annonstexten delas i rader som klassas som krav eller meriterande utifrån svenska
ledord ("du har", "meriterande", "gärna"). Avsnitt som beskriver arbetsgivaren
hoppas över. Poängen jämnas ut så att en annons med två krav aldrig kan ge 100 %,
och när annonsen är för tunn för att bedömas rättvist visas **ingen** siffra —
en påhittad procentsats är sämre än ingen, eftersom folk faktiskt agerar på dem.

Matchningen är gränsmedveten över en Unicode-ordklass i stället för
JavaScripts ASCII-`\w`: "Go" träffar inte "Django", och svenska bokstäver räknas
som ordtecken.

### CV-tolkning

En PDF innehåller bara tecken med koordinater. I ett CV med sidokolumn varvar
strömmen sidofältet med huvudspalten, så kontaktuppgifter hamnar mitt i
arbetslivserfarenheten. Därför hittas spalterna först — via den lodräta ränna
ingen text korsar — och varje spalt läses uppifrån och ner för sig.

Utöver det hanteras bokstavsspärrade rubriker (`A R B E T S L I V S...`), datum
som står ovanför, bredvid eller under sin post, och utbildningsrader som slutar
med ett årtal. En radbrytning mitt i en mening kan se ut precis som en rubrik, så
en ny post får bara börja intill ett datum.

Filen sparas aldrig. Den läses i minnet och kastas; det som lagras är det utkast
användaren granskat.

### Datum

Allt användarsynligt är ett kalenderdatum i Europe/Stockholm och färdas som
`YYYY-MM-DD`, aldrig som `Date`. Sommartid kan alltså inte flytta en deadline
över midnatt.

## Säkerhet och integritet

- **Sessionscookie**, inte token i localStorage: en `httpOnly`-cookie kan inte
  läsas av skript.
- **E-postverifiering krävs** innan en session utfärdas. Lösenordsbyte dödar alla
  utestående sessioner.
- **Hårdare rate limit** på inloggning, registrering och lösenordsåterställning
  än på resten.
- **Ägarskap kontrolleras vid varje läsning och skrivning**, i frågan mot
  databasen — inte genom att anroparen kommer ihåg det.
- **Allt valideras med Zod.** Det som går att nå från webbläsaren går att nå med
  curl.
- **CSV-export desarmeras** mot formelinjektion: en cell som börjar med `=`, `+`,
  `-` eller `@` körs annars som formel i Excel.
- **GDPR:** export som CSV, radering som kaskaderar till allt kontot äger, och
  automatisk gallring av konton som varit vilande i två år — efter ett
  varningsmejl 30 dagar i förväg.
- **Miljön valideras vid start** och vägrar starta produktion utan https, utan
  hemlighet för de schemalagda jobben, eller med e-postverifiering avstängd.

## Schemalagda jobb

Tre endpoints, skyddade av `CRON_SECRET` i `Authorization: Bearer …`:

| Sökväg | Vad den gör | Föreslagen tid |
| --- | --- | --- |
| `/api/cron/paminnelser` | Mejlar det som behöver följas upp eller sökas | dagligen 07:00 |
| `/api/cron/veckobrev` | Veckoöversikt plus nya träffar på sparade sökningar | måndagar 08:00 |
| `/api/cron/gallring` | Varnar och raderar vilande konton, rensar cachar | dagligen 03:00 |

Påminnelser skickas bara när det finns något att säga: ett tomt utskick lär folk
att ignorera avsändaren, och nästa som betyder något blir oläst.

## Drift

`Dockerfile` bygger en fristående image (Next standalone, icke-root, med
healthcheck). Den fungerar hos vilken container-host som helst — Render, Fly,
Railway, egen server. Sätt miljövariablerna från `.env.example`, kör
`pnpm db:migrate` vid deploy och peka en scheduler på de tre cron-sökvägarna.

## Testning

- **Enhetstester** över domänlogiken — statusar, datum, matchning, kravutvinning,
  perioder, export.
- **Databastester** mot riktig PostgreSQL via PGlite, så enums, kaskader och
  partiella unika index körs på samma motor som i drift, utan att någon behöver
  en databasserver.
- **End-to-end** med Playwright, i både desktop- och mobilupplösning. Sviten
  startar sin egen stack inklusive en mockad JobTech-server, så testerna aldrig
  beror på att ett tredjeparts-API är uppe eller svarar likadant två gånger.

## Vad som ändrats mot den gamla versionen

Utöver stacken:

- **Ortstavning i sökningen** bygger på en lista över Sveriges 290 kommuner i
  stället för en heuristik. Att maximera antalet diakriter gör "norrkoping" till
  "nörrköping"; ord som inte är riktiga ortnamn lämnas nu helt orörda.
- **CV-tolkningen är kolumnmedveten** och klarar designade tvåspaltiga CV:n.
- **Tratten tappar inte historik.** Att avsluta en ansökan säger hur det gick,
  inte hur långt den kom — ett avslag suddar inte längre ut att man varit på
  intervju.
- **Ansökningsdatum, deadlines och rapportmånader** är kalenderdatum hela vägen.
- **Tillgänglighet:** riktiga radioknappar och etiketter kopplade till sina
  kontroller, synlig fokusmarkering, respekt för `prefers-reduced-motion`, och
  en tabellvy under varje diagram.

## Öppen data

Annonser och yrkestaxonomi hämtas från [JobTech Development][jobtech],
Arbetsförmedlingens öppna plattform. Ingen API-nyckel, ingen inloggning.

Jobbdjungeln är ett personligt hjälpmedel och har **ingen koppling till
Arbetsförmedlingen**. Aktivitetsrapporten lämnas in hos dem som vanligt.

[jobtech]: https://jobtechdev.se

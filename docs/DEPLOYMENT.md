# Cloud deployment & configuratie

Configuratie voor het hosten van de AI Coach in de cloud (Vercel, Render, Fly, VPS).

## Vereiste omgevingsvariabelen

| Variabele | Verplicht | Beschrijving |
|-----------|-----------|--------------|
| `DATABASE_URL` | Ja | SQLite: `file:./prisma/dev.db` of PostgreSQL URL voor productie |
| `OPENAI_API_KEY` | Ja | API key van OpenAI |
| `OPENAI_CHAT_MODEL` | Nee | Standaard `gpt-5` of `gpt-4.1` |
| `OPENAI_CHAT_FALLBACK_MODEL` | Nee | Fallback model bij primair model fout |
| `OPENAI_TRANSCRIBE_MODEL` | Nee | Standaard `gpt-4o-transcribe` |
| `OPENAI_TTS_MODEL` | Nee | Standaard `gpt-4o-mini-tts` |
| `OPENAI_TTS_VOICE` | Nee | Voice voor TTS |
| `OPENAI_TTS_SPEED` | Nee | Spreeksnelheid (0.25–4.0) |
| `TTS_PROVIDER` | Nee | `openai` of `elevenlabs` |
| `ELEVENLABS_API_KEY` | Ja* | *Alleen als TTS_PROVIDER=elevenlabs |
| `ELEVENLABS_VOICE_ID` | Ja* | *Alleen als TTS_PROVIDER=elevenlabs |
| `PUSHOVER_TOKEN` | Nee | Voor herinneringen-notificaties |
| `PUSHOVER_USER` | Nee | Pushover user key |
| `CRON_SECRET` | Ja | Voor cron endpoint (herinneringen). Verplicht in productie. |

## Database

- **Lokaal/development**: SQLite via `file:./prisma/dev.db`. Op Windows gebruikt de app automatisch `%LOCALAPPDATA%\ai-coach\dev.db` (zie `lib/db.ts`).
- **Cloud**: Gebruik PostgreSQL of Turso. Pas `prisma/schema.prisma` aan (`provider = "postgresql"` of `"postgresql"`) en `DATABASE_URL` dienovereenkomstig. Voer `prisma migrate deploy` uit na deploy.

## Beveiliging

- **Rate limiting**: 60 requests per IP per minuut op kritieke routes (chat, transcribe, speech, files, health).
- **Body limits**: Chat 2MB, transcribe 25MB, files 10MB, health entry 4KB.
- **Security headers**: Referrer-Policy, X-Content-Type-Options, X-Frame-Options (via `next.config.js`).
- **Cron endpoint**: Alleen `Authorization: Bearer <CRON_SECRET>`. Zet `CRON_SECRET` in productie en stuur deze header mee bij cron-triggers.

## Auth (toekomst)

De app heeft nu geen gebruikerslogin. Voor cloud-hosting is auth noodzakelijk. Aanbevolen modellen:

1. **E-mail + magic link** (bijv. Resend + custom token)
2. **OAuth** (Google, GitHub) via NextAuth of Auth.js

Documenteer in dit bestand welke aanpak gekozen wordt en waar de auth-logica staat.

## Data-bronnen

- **Health**: Handmatige invoer via `/api/health/entry`. Later uitbreidbaar met Apple Health / Google Fit via `lib/health` (HealthSource-interface).
- **Finance**: Mock provider nu. Voor echte bankkoppeling: PSD2 via Enable Banking, Nordigen of Tink. Keys en consent-flow via env en externe provider.

## Build & start (lokaal)

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # of db push voor SQLite
npm run build
npm run start
```

## Eenmalige autorisatie (GitHub, Vercel, Neon)

Voor echte \"one‑click\" deploys moet je één keer de volgende koppelingen doen:

1. **GitHub**: repo `edvanwal/ai-coach` bestaat al. Toegang voor scripts gaat via een fine‑grained personal access token (alleen repo `ai-coach`, permissie `Contents: Read & write`).
2. **Vercel**: GitHub‑app koppelen aan je account en repo `ai-coach` selecteren. Daarna triggert elke push naar `main` automatisch een nieuwe build.
3. **Neon**: PostgreSQL‑database met `DATABASE_URL` (zoals nu al ingericht). Prisma‑migraties gebruiken dezelfde URL zowel lokaal als in Vercel.

Deze stappen zijn **eenmalig**; daarna kan de agent via git/Vercel/Neon vrijwel alles zelf doen.

## Deploy naar Vercel (Hobby)

1. **Project koppelen**
   - Push de repo naar GitHub.
   - Ga naar [vercel.com](https://vercel.com) → New Project → Import Git repo.

2. **Database**
   - Vercel heeft geen schijf; SQLite werkt niet in productie.
   - Gebruik **Turso** (gratis tier) of **Neon/PlanetScale** (PostgreSQL).
   - Bij Turso: maak een database, kopieer de `DATABASE_URL` (libsql://...).
   - Pas in `prisma/schema.prisma` de provider aan:
     - Turso: `provider = "sqlite"` met `url = "file:..."` vervangen door Turso’s libSQL URL.
     - PostgreSQL: `provider = "postgresql"` en `url = env("DATABASE_URL")`.

3. **Env-variabelen**
   - In Vercel: Project → Settings → Environment Variables.
   - Voeg toe: `DATABASE_URL`, `OPENAI_API_KEY`, `CRON_SECRET`, en overige keys uit de tabel hierboven.
   - `CRON_SECRET`: genereer met `openssl rand -hex 24` (of een willekeurige string).

4. **Build**
   - Framework: Next.js (automatisch herkend).
   - Build command: `npx prisma generate && npm run build`.
   - Output directory: `.next` (default).

5. **Deploy**
   - Klik Deploy. Bij een PostgreSQL/Turso database: draai lokaal `npx prisma migrate deploy` met `DATABASE_URL` van productie, of gebruik een post-deploy script.

## Herinneringen (cron)

Omdat Vercel Hobby maar **één dagelijkse cron** toestaat, draaien herinneringen **niet** via Vercel Cron maar via een externe dienst.

- **Lokaal / Windows**: `scripts/check-reminders.ps1` is al gekoppeld aan de Windows Taakplanner en roept elke minuut `/api/cron/check-reminders` aan op `http://localhost:3001`.
- **Productie**: gebruik een externe dienst (bijv. cron-job.org) die elke minuut een GET doet naar jouw publieke URL.

De externe cron-job roept elke minuut:

```
GET/POST https://jouw-domein.nl/api/cron/check-reminders
Header: Authorization: Bearer <CRON_SECRET>
```

aan. Zonder `CRON_SECRET` retourneert het endpoint 401.

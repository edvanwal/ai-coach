# Mobile Agent Control

Deze module maakt het mogelijk om **Cursor-opdrachten mobiel aan te sturen** (start/status/stop) via:

- Cloud Agents baseline (template + statusmodel)
- API-commando's
- WhatsApp webhook (optioneel)
- Telegram webhook

## Ondersteunde commando's

- `new <opdracht>`
- `status <run-id>`
- `stop <run-id>`
- `confirm <code>`
- `help`

Optioneel met projectroutering:

- `project ai-coach: new ...`
- `project template: new ...`

## Snelle workflow (remote bouwen)

Gebruik WhatsApp/Telegram/API als **commandokanaal** (niet als coach-chat).

- **Start**: `new <opdracht>`
- **Volg**: `status <run-id>`
- **Stop**: `stop <run-id>`

## PWA cockpit (Control panel)

Naast WhatsApp kun je een **niet-technisch dashboard** gebruiken als cockpit:

- **URL**: `/control-panel` (lokaal: `http://localhost:3001/control-panel`)
- **Doel**: status + veilige knoppen (geen code/commando’s nodig)

Wat je daar kunt:

- **Status**: “Rustig / Bezig / Vast”, en of er “Wacht op jou” is.
- **Acties**:
  - **Maak overdracht**: genereert een compacte overdrachttekst (zonder knippen/plakken) die je in een nieuwe sessie kunt gebruiken.
  - **Run checks** / **Deploy staging** / **Deploy productie**: MVP-knoppen die acties loggen en als workflow-anker dienen.
- **Logboek (mensentaal)**: tijdlijn met korte entries (oorzaak → actie → resultaat).

Let op: WhatsApp blijft het primaire **commandokanaal**; de PWA is het **overzicht + knoppen** kanaal.

Voorbeeld:

- `new Refactor de login flow; voeg tests toe; maak PR`
- `status RUN-20260317-001`
- `stop RUN-20260317-001`

## API endpoints

- `GET /api/mobile/control`
  - Geeft template, adapters en recente runs terug.
- `POST /api/mobile/control`
  - Verwerkt commando's via JSON body:
    - `text` (verplicht)
    - `channel` (`api|whatsapp|telegram|slack`)
    - `sender` (optioneel; gebruikt voor allowlist)
- `GET /api/mobile/runs/:id`
  - Haalt de status + eventlog op van een run.
- `POST /api/mobile/control/self-check`
  - Voert acceptatiecheck uit voor multi-project routing.
- `GET /api/mobile/whatsapp/webhook`
  - Meta webhook verify endpoint.
- `POST /api/mobile/whatsapp/webhook`
  - Ontvangt WhatsApp berichten, parse't commando en antwoordt terug.
- `GET /api/mobile/whatsapp/status`
  - Laat zien of alle WhatsApp env-variabelen gezet zijn (zonder secrets te tonen).
- `GET /api/mobile/telegram/webhook`
  - Telegram webhook health endpoint.
- `POST /api/mobile/telegram/webhook`
  - Ontvangt Telegram updates, parse't commando en antwoordt terug.
- `GET /api/mobile/telegram/status`
  - Laat zien of Telegram-config actief is (zonder secrets te tonen).

## Hoe werkt de WhatsApp-koppeling?

1. **Meta (Facebook) stuurt berichten naar jouw app**  
   Je registreert bij Meta een webhook-URL die naar jouw Vercel-app wijst (zie hieronder).  
   Meta doet een **GET** met `hub.mode=subscribe`, `hub.verify_token` en `hub.challenge`. De app vergelijkt `hub.verify_token` met `WHATSAPP_VERIFY_TOKEN`; klopt die, dan antwoordt ze met de `hub.challenge` (verificatie geslaagd).

2. **Berichten binnenkomen via POST**  
   Elk WhatsApp-bericht dat naar dat nummer wordt gestuurd, gaat als **POST** naar dezelfde URL. De app controleert de signature, haalt afzender en tekst eruit, checkt de allowlist, geeft de tekst aan `handleCommand` (zelfde als Telegram/API) en stuurt het antwoord terug via de WhatsApp Cloud API.

3. **Wat je nodig hebt**  
   Meta-app met WhatsApp Business API, nummer gekoppeld, webhook-URL ingesteld. Env: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`; optioneel `MOBILE_CONTROL_ALLOWLIST`. Controle: [GET /api/mobile/whatsapp/status](http://localhost:3001/api/mobile/whatsapp/status).

### Webhook-URL (productie)

Gebruik je **stabiele Vercel-URL** + het pad. Voorbeelden:

- Algemene vorm: `https://<jouw-domein>/api/mobile/whatsapp/webhook`
- Huidige productie-URL (zie `docs/DEPLOYMENT.md` voor actuele waarde):  
  `https://ai-coach-cnsshx5jp-edwins-projects-e31e97b7.vercel.app/api/mobile/whatsapp/webhook`  
  Als je een vaste alias of custom domain hebt (bijv. `ai-coach-rho.vercel.app`), gebruik die voor een stabiele webhook.

### WhatsApp in 5 stappen

1. **Meta Developer-account** – [developers.facebook.com](https://developers.facebook.com) → App aanmaken, product “WhatsApp” toevoegen.
2. **Telefoonnummer** – In de app: WhatsApp → API setup; (test)nummer of goedgekeurd Business-nummer koppelen; noteer **Phone number ID**.
3. **Tokens** – In de app: WhatsApp → API; **Access token** (tijdelijk of systeemuser) en **App secret** (Settings → Basic). Verzin een **Verify token** (willekeurige string) en zet die ook in `.env.local`.
4. **Env in project** – In `.env.local` (en in Vercel: Project → Settings → Environment Variables):  
   `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`. Optioneel: `MOBILE_CONTROL_ALLOWLIST` (comma-gescheiden WhatsApp user-id’s).
5. **Webhook bij Meta** – WhatsApp → Configuration → Webhook: “Edit” → Callback URL = jouw productie-URL (zie hierboven), Verify token = dezelfde waarde als `WHATSAPP_VERIFY_TOKEN`. Opslaan; daarna “Subscribe” op het webhook-veld (bijv. `messages`). Klaar: berichten naar dat nummer gaan naar je app.

## Environment variabelen

- `MOBILE_CONTROL_ALLOWLIST` (optioneel)
  - Comma-gescheiden lijst met afzenders die opdrachten mogen geven.
- `WHATSAPP_VERIFY_TOKEN` (voor webhook verify)
- `WHATSAPP_APP_SECRET` (voor signature check)
- `WHATSAPP_ACCESS_TOKEN` (voor terugsturen van WhatsApp-berichten)
- `WHATSAPP_PHONE_NUMBER_ID` (Meta phone number id)
- `TELEGRAM_BOT_TOKEN` (voor Telegram sendMessage API)
- `TELEGRAM_WEBHOOK_SECRET` (optioneel maar aanbevolen voor webhook-auth)

## Security baseline

- Allowlist op afzenderniveau.
- Webhook signature-validatie voor WhatsApp.
- Webhook secret-validatie voor Telegram (indien ingesteld).
- Confirmatiestap voor gevoelige opdrachten op high-sensitivity projecten.
- API-responses met `Cache-Control: no-store, no-cache, must-revalidate`.

## Milestone mapping

- Milestone 1: template + statusmodel + mobiele command baseline.
- Milestone 2: webhook intake + parser/queue + security guardrails.
- Milestone 3: project-adapters + routing + self-check voor multi-project.

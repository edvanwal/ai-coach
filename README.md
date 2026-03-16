# AI Persoonlijke Coach

Een webapp die als persoonlijke AI-coach fungeert. Helpt met ADHD-beheer, taken, doelen en structuur.

## Wat doet de app?

- **Chat** met een empathische AI-coach (Nederlands)
- **Profiel** met ADHD-context, levenssituatie en doelen
- **Takenlijst** met prioriteiten en "vervelende taak van de dag"
- Advies volledig afgestemd op jouw situatie

## Starten

1. Installeer dependencies: `npm install`
2. Maak `.env.local` aan (kopieer van `.env.local.example`) en vul je OpenAI key + model-instellingen in
3. Start de app: `npm run dev`
4. Open http://localhost:3000

## Cloud-deployment

Zie [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) voor env-variabelen, database, security en auth.

## OpenAI API key

De app gebruikt OpenAI voor:
- Chat (`OPENAI_CHAT_MODEL`, standaard `gpt-4.1`)
- Speech-to-text (`OPENAI_TRANSCRIBE_MODEL`, standaard `gpt-4o-transcribe`)
- Text-to-speech (`OPENAI_TTS_MODEL`, standaard `gpt-4o-mini-tts`)

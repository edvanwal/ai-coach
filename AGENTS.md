# AI Coach – instructies voor de agent

## Geen technische stappen naar gebruiker (top-prioriteit)

De agent doet **al het technische werk zelf**. Nooit genummerde stappen of commando’s aan de gebruiker geven ("Stop de server", "Run prisma generate", "Refresh de pagina"). Bij problemen: zelf oplossen of uitvoeren; anders maximaal één korte ja/nee-vraag. Deze regel gaat boven standaard troubleshooting-tekst.

## Geen caching
De gebruiker wil **nooit** met cachingproblemen te maken krijgen. Gebruik overal `cache: "no-store"` bij fetch, zet stevige `Cache-Control: no-store, no-cache, must-revalidate` op API-responses, en voorkom dat oude data (stem, config) blijft hangen. Na configwijzigingen (zoals nieuwe Voice ID) de server herstarten zodat env opnieuw geladen wordt.

## Technisch werk
De agent doet **al het technische werk**. De gebruiker start geen servers, draait geen builds en voert geen commando’s uit. Als een dev-server nodig is, start de agent die. Als iets technisch moet gebeuren, doet de agent het.

## .env.local beheer
De agent beheert `.env.local`. Als nieuwe configuratie nodig is (API-keys, TTS-provider, etc.), voegt de agent deze toe. De gebruiker hoeft zelf niets in .env.local te zetten.

## Pushover-melding (verplicht)

Na **elke afgeronde actie** – antwoord, plan, debug, vraag – in **alle modi** moet je een Pushover-melding sturen als **laatste stap**.

**Commando (in projectroot):**
```powershell
scripts\notify-done.ps1 "AI coach: klaar"
```

De gebruiker kijkt niet continu naar het scherm. De push zorgt dat hij weet wanneer hij terug moet komen. Vergeet dit niet.

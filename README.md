Jag har en webbaserad lönekalkylator för IKEM:s lokala avtal – specifikt Recipharm Uppsala AB.
Kalkylatorn är uppdelad i filer:
- index.html (gränssnitt, Chart.js CDN, laddar js-filer)
- css/style.css (mörkt/ljust tema, färger för dag/natt/frånvaro/veckomarkering)
- js/scheman.js (skiftcykler A–E, OB1–3, permission, stationer lag E)
- js/skattetabell.js (tabell 33, kolumn 1 för 2024–2026)
- js/storage.js (profiler, autosave, getCurrentState, applyState)
- js/script.js (beräkningar, UI, 5‑dagarsregel FL, autosave-uppstart)

Viktiga konstanter och variabler:
DRIFT=4.0, VAB_HPD=12.25, O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94, SY=2024, EY=2036
PBB=59200, SGI_TAK_PARENTAL=10*PBB, SGI_TAK_VAB=7.5*PBB, FK_SKATT=0.30
UPCT=0.0165 (fackavgift), UMAX=701, UMIN=255
Månadslön / 141,6667 = sjuklön 100%, / 177,0833 = sjuklön 80%
Semestertillägg: (månadslön + drift) / 125 per dag
OB-grundande lön = månadslön + drift (4%, avrundas till hel krona enligt arbetsgivaren, men finns som f2 i koden)

Lokala avtalet (Recipharm, IKEM) – det som är relevant för kalkylatorn:

1. Driftformstillägg: 4 % av fasta månadslönen (kontinuerligt 3-skift).

2. OB-ersättning (punkt 9 i avtalet):
   - OB1 (månadslön/460): måndag-fredag kl. 18.00-24.00
   - OB2 (månadslön/260): måndag-fredag kl. 00.00-07.00 samt lördag 00.00 – söndag 24.00
   - OB3 (månadslön/150): storhelger enligt specifika perioder:
     * Påsk: från skärtorsdag kl. 18.00 till tisdag efter påsk kl. 00.00
     * Första maj: från kl. 07.00 till första vardag efter helgen kl. 00.00
     * Nationaldag: från kl. 07.00 till första vardag efter helgen kl. 00.00
     * Midsommar: från midsommarafton kl. 07.00 till första vardag efter midsommarhelgen kl. 00.00
     * Jul: från julafton kl. 07.00 till första vardag efter julhelgen kl. 00.00
     * Nyår: från nyårsafton kl. 07.00 till första vardag efter nyårshelgen kl. 00.00
   - OB3 beräknas exakt per pass (dag 05:45-18:00, natt 17:45-06:00) – överlappande timmar räknas, max 12,25h.
   - OB1/OB2 på vanliga dagar: dagpass vardag → OB2 1,25h, dagpass helg → OB2 12,25h; nattpass vardag → OB1 6h + OB2 6h, nattpass helg → OB2 12,25h.
   - Sommartidsjustering: +1h eller -1h OB vid övergång (hanteras i getDSTAdjustment).

3. Permission (punkt 2):
   - Permission (ingen OB alls) för: midsommarafton, midsommardagen, julafton (hela dygnet), juldagen dag, nyårsafton natt, nyårsdagen dag.

4. Övertid (punkt 5):
   - Övertid helgfri måndag-fredag 06-20: månadslön/94
   - Övertid på annan tid (och vid direkt anslutning till fullgjort nattskift): månadslön/72
   - Övertidsersättning inkluderar OB.

5. Sjukavdrag och karens (punkt 12?):
   - Karensavdrag: 6,8h × månadslön/141,6667 per karensdag.
   - Sjukavdrag 100%: frånvarotimmar × månadslön/141,6667
   - Sjukersättning 80%: frånvarotimmar × månadslön/177,0833
   - Sjuk-OB: 80% av OB-ersättning för de OB-timmar som skulle ha tjänats in under sjukfrånvaron.

6. Föräldraledighet (punkt 8) – 5‑dagarsregel enligt lokal tillämpning:
   - Vid sammanhängande föräldraledighet med fler än 5 arbetsdagar (måndag-fredag) i följd görs kalenderdagsavdrag: månadslön / 30 per dag (hela frånvaroperioden inkl. lediga dagar).
   - Vid 5 eller färre arbetsdagar: timavdrag 12,25h × månadslön/141,6667 per dag.
   - Perioder binds ihop över lediga dagar (helger) – se calcParentalDeduction i script.js.

7. VAB (punkt 3.1?):
   - Avdrag: 12,25h per dag × månadslön/141,6667.
   - Ersättning från FK: 80% av SGI/365 per dag, max 7,5 PBB.

8. Semestertillägg: 1/125 av (månadslön + drift) per semesterdag, utbetalas månaden efter intjänandemånaden.

9. Fackavgift: 1,65% av bruttolönen, max 701 kr, min 255 kr (IF Metall).

FK-ersättningar (ej avtal, men tillämpas):
- FL: 77,6% av SGI/365, max 1259 kr/dag, upp till 10 PBB.
- VAB: 80% av SGI/365, upp till 7,5 PBB.
- FTP (AFA): 10% av månadslön per dag, max 5 dagar (via dropdown).
- Skatt på FK-ersättning: 30% preliminärskatt (dras av i kalkylatorn).

Implementationsdetaljer:
- Skiftcykler för lag A–E genereras från startdatum via modulo (fungerar bakåt till 2024).
- fromvaroMap, shiftOverrideMap, vacationOverrideMap är globala kartor (i scheman.js).
- Autosave: sparas under 'loneprognos_autosave_v1' via autoSaveState() i script.js, laddas vid start via applyState().
- Profiler: sparas under 'loneprognos_profiler_v3', hanteras i storage.js.
- Färger i schemat: dag=grön (1a3a1a), natt=röd (3a1a1a), semester=gul (3a3a1a), VAB=rosa (4a1a3a), föräldraledig=baby blue (1a2a4a) i mörkt tema; i ljust tema används rgba med opacitet.
- Veckonummer visas på första dagen i månaden samt varje måndag; blåmarkering växlar med veckan.
- Kalkylatorn fungerar fullt ut med alla dessa regler. Hjälp mig vidareutveckla eller felsöka utifrån detta.

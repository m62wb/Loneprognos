Jag har en webbaserad lönekalkylator för IKEM:s lokala avtal.
Den är uppdelad i filer:
- index.html (gränssnitt, Chart.js CDN, laddar js-filer)
- css/style.css (mörkt/ljust tema, dag/natt/frånvaro-färger)
- js/scheman.js (skiftcykler A–E, OB1–3, permission, stationer lag E)
- js/skattetabell.js (tabell 33, kolumn 1 för 2024–2026)
- js/storage.js (profiler, autosave, getCurrentState, applyState)
- js/script.js (beräkningar, UI, 5‑dagarsregel FL, autosave-uppstart)

Viktiga konstanter:
DRIFT=4.0, VAB_HPD=12.25, O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94, SY=2024, EY=2036
PBB=59200, SGI_TAK_PARENTAL=10*PBB, SGI_TAK_VAB=7.5*PBB, FK_SKATT=0.30

Specifika regler som är inbyggda:
- OB3 beräknas exakt per pass (dag 05:45-18:00, natt 17:45-06:00) enligt IKEM-avtal.
- 5‑dagarsregeln för föräldraledighet: vid >5 sammanhängande arbetsdagar → kalenderdagsavdrag (månadslön/30), annars timavdrag (12,25h/dag). Perioder binds ihop över lediga dagar.
- Industrisemester v28–31 appliceras automatiskt (går att ändra manuellt via vacationOverrideMap).
- Semestertillägg och OB hämtas från föregående månad (förskjuten utbetalning).
- Autosave sparar alla tillstånd (inkl. fromvaroMap) under nyckel 'loneprognos_autosave_v1'.
- Profiler sparas separat under 'loneprognos_profiler_v3'.
- Färger: dag=grön, natt=röd, semester=gul, VAB=rosa, föräldraledig=babyblå, veckomarkering=blå (alla teman).

Kalkylatorn fungerar fullt ut. Hjälp mig vidareutveckla eller felsöka utifrån detta.

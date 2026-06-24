# Löneprognos 2024-2036 – IKEM Lokalt Avtal

Webbaserad lönekalkylator för skiftarbetare med IKEM:s lokala avtal.
Beräknar bruttolön, OB, övertid, sjukavdrag, föräldraledighet, VAB,
semestertillägg, fackavgift och preliminärskatt enligt tabell 33 (kolumn 1).

## Filstruktur

- `index.html` – gränssnitt, Chart.js CDN, laddar JS-filer
- `css/style.css` – mörkt/ljust tema, färger för dag/natt/frånvaro
- `js/scheman.js` – skiftcykler A–E, OB1–3, permission, stationer lag E
- `js/skattetabell.js` – skattetabell 33, kolumn 1 för 2024–2026 (upp till 120kkr)
- `js/storage.js` – profiler, autosave, getCurrentState, applyState
- `js/script.js` – huvudlogik: beräkningar, UI, frånvaro, sjukregler, FL 5-dagarsregel

## Viktiga konstanter (`script.js`)

- `DRIFT = 4.0` (%)
- `VAB_HPD = 12.25` (timmar per dag)
- `O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94`
- `PBB = 59200`
- `SGI_TAK_PARENTAL = 10*PBB`, `SGI_TAK_VAB = 7.5*PBB`
- `FK_SKATT = 0.30`
- `UPCT=0.0165, UMAX=701, UMIN=255` (fackavgift IF Metall)
- Semestertillägg: `(månadslön + drift) / 125` per dag
- Sjukavdrag 100%: `månadslön / (141 + 2/3)`
- Sjuklön 80%: `månadslön / (177 + 1/12)`

## Avtalets OB och tillägg

### Driftformstillägg
4 % av fasta månadslönen (kontinuerligt 3-skift).

### OB (punkt 9)
- **OB1** (`månadslön/460`): mån–fre 18.00–24.00
- **OB2** (`månadslön/260`): mån–fre 00.00–07.00, samt lör 00.00 – sön 24.00
- **OB3** (`månadslön/150`): storhelger – se nedan

### OB3‑perioder (exakt per pass, max 12,25 h)
- **Påsk**: skärtorsdag 18.00 → tisdag efter påsk 00.00
- **Första maj**: 1 maj 07.00 → första vardag efter 1 maj 00.00
- **Nationaldag**: 6 juni 07.00 → första vardag efter 00.00  
  *FlexHRM-justering*: om 6/6 är lördag → start fredag 07.00; om söndag → start lördag 07.00
- **Midsommar**: midsommarafton 07.00 → söndag efter midsommardagen 00.00
- **Jul**: julafton 07.00 → första vardag efter julhelgen 00.00
- **Nyår**: nyårsafton 07.00 → första vardag efter nyår 00.00

### Permission (punkt 2)
- Julafton (24/12) – hela dygnet
- Juldagen (25/12) – endast dagpass
- Nyårsafton (31/12) – **hela dygnet** (ändrat 2025)
- Nyårsdagen (1/1) – endast dagpass
- Midsommarafton – hela dygnet
- Midsommardagen – endast dagpass

### Röda dagar (ej permissionsdagar)
Alla svenska helgdagar (inkl. Kristi himmelsfärd) ger **OB2 för hela passet** (12,25 h), oavsett veckodag.

### Blandning OB1/OB2/OB3
Om ett pass har OB3 beräknas först normal OB1/OB2, sedan **subtraheras** OB3‑timmarna från OB1 (i första hand) och därefter från OB2. Total OB-tid överstiger aldrig 12,25 h.

### Övertid (punkt 5)
- Övertid vardag 06–20: `månadslön/94`
- Övertid övrig tid: `månadslön/72`
- Övertidsersättning inkluderar OB.

### Sjukavdrag och karens (punkt 12)
- Karensavdrag: 6,8 h × `månadslön/(141+2/3)`
- Sjukavdrag 100%: frånvarotimmar × samma timlön
- Sjukersättning 80%: frånvarotimmar × `månadslön/(177+1/12)`
- **Sjuk‑OB**: 80 % av OB för de timmar som skulle ha tjänats in, **minus karens**.
  - *Arbetsgivarens bugg*: vid heldagssjukdom dras endast **6 timmar** från den första OB‑typ som passet har (OB1, annars OB2, annars OB3). Övriga OB‑timmar lämnas orörda.
  - Vid del‑av‑dag används hela karensen (6,8 h) och dras i ordning OB1 → OB2 → OB3.

### Föräldraledighet (punkt 8) – lokal 5‑dagarsregel
- Alla schemalagda pass (inkl. helger) räknas som arbetsdagar.
- Perioder med >5 arbetsdagar → **kalenderdagsavdrag** (`månadslön / 30` per dag, inkl. lediga dagar).
- ≤5 arbetsdagar → **timavdrag** 12,25 h × sjuklön100 per arbetsdag.
- Perioder binds ihop över lediga dagar och helger (expanderas i båda riktningar).

### Semestertillägg
1/125 av (månadslön + drift) per semesterdag, utbetalas månaden efter (visas i kalkylatorn för intjänandemånaden).

### Fackavgift
1,65 % av bruttolönen, max 701 kr, min 255 kr.

### Skatt
Tabell 33 (kolumn 1), platt upp till 120 000 kr, därefter 52 % marginalskatt. År 2024, 2025 och 2026 har egna tabeller.

## Nyligen genomförda ändringar / buggfixar

1. **Midsommarpermission** – endast midsommarafton + midsommardagen dagpass (bort med söndagens permission).
2. **D‑lagets startdatum** – flyttat från 29 dec till 30 dec 2025 för att hamna i fas.
3. **OB‑fält låstes bort** – låsknapp och `manualOBOverride` helt rensade ur både `script.js` och `storage.js`. Fälten fylls nu alltid i automatiskt med `getOBForMonth`.
4. **OB3‑blandning förenklad** – enkel subtraktion OB1→OB2 istället för komplex intervall‑matchning (fixade buggen med 1 maj som gav för mycket OB).
5. **Nationaldags‑OB3** – anpassad efter FlexHRM: om nationaldagen är lör/sön startar OB3 dagen före kl. 07.00.
6. **Nyårsaftonspermission** – gäller nu alla pass (ej bara natt).
7. **Årsöversikt** – fungerar igen efter OB‑fixarna.

## Kvar att följa upp / möjliga framtida kontroller

- **Föräldraledighet över månadsgränser** – `calcParentalDeduction` expanderar perioder korrekt via `fromvaroMap`, men verifiera mot spec om du har längre sammanhängande ledigheter.
- **FlexHRM‑avvikelser** – t.ex. nationaldag 2026: D‑lagets natt fick OB3 redan fredag 18:00. Din kalkylator följer nu den tolkningen, men andra storhelger kan behöva kontrolleras mot lönespec.
- **Sjuk‑OB vid del‑av‑dag** – logiken du gav (fredag natt 21:15, OB1/OB2‑uppdelning) är implementerad och ska stämma. Kontrollera gärna mot lönespec.
- **Skattetabellernas korrekthet** – tabellerna är rekonstruerade från Skatteverkets tabell 33 (kolumn 1). Om du ser avvikelser på öresnivå, hör av dig.

## Hur du testar efter ändringar

1. Hårdladda sidan (Ctrl+Shift+R / Cmd+Shift+R) för att rensa cache.
2. Välj lag (t.ex. E), sätt månadslön och kontrollera OB‑timmar för en känd månad (juni 2026 är bra).
3. Testa storhelg: 1 maj, nationaldag, midsommar.
4. Markera semester, VAB, FL, sjuk – kontrollera att OB‑fälten och översikten uppdateras direkt.
5. Årsöversikten ska visa summerad bruttolön, nettolön, skatt, fackavgift, total OB och semestertillägg.

6. Hämta skattetabell för 2027 när den finns tillgänglig

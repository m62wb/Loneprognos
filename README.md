# Löneprognos 2024-2036 – IKEM Lokalt Avtal

Webbaserad lönekalkylator för skiftarbetare med IKEM:s lokala avtal.
Beräknar bruttolön, OB, övertid, sjukavdrag, föräldraledighet, VAB,
semestertillägg, fackavgift och preliminärskatt enligt tabell 33 (kolumn 1).

## Filstruktur

- `index.html` – gränssnitt, Chart.js CDN, laddar JS-filer
- `css/style.css` – mörkt/ljust tema, färger för dag/natt/frånvaro
- `js/scheman.js` – skiftcykler A–E, OB1–3, permission, stationer lag E, R3 (GUCH/BEAB)
- `js/skattetabell.js` – skattetabell 33, kolumn 1 för 2024–2026 (upp till 120 kkr, 2026 exakt + procentsatser)
- `js/storage.js` – profiler, autosave, getCurrentState, applyState, autoSelectFirstProfile
- `js/script.js` – huvudlogik: beräkningar, UI, frånvaro, sjukregler, FL 5-dagarsregel

## Viktiga konstanter (`script.js`)

- `DRIFT = 4.0` (%)
- `VAB_HPD = 12.25` (timmar per dag)
- `O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94`
- `PBB = 59200`
- `SGI_TAK_PARENTAL = 10*PBB`, `SGI_TAK_VAB = 7.5*PBB`
- `FK_SKATT = 0.30`
- `UPCT=0.0165, UMAX=701, UMIN=255` (fackavgift IF Metall)
- `SEMESTER_KVOT = 1.78` (endast för skiftlag A–E)
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
- **Perioddefinition**: startar på första markerade FL‑dagen och slutar på sista markerade FL‑dagen. Lediga dagar däremellan räknas in, men arbetsdagar utan FL **bryter perioden**.
- Perioder med >5 arbetsdagar → **kalenderdagsavdrag** (`månadslön / 30` per dag, inkl. lediga dagar i perioden).
- ≤5 arbetsdagar → **timavdrag** 12,25 h × sjuklön100 per arbetsdag.
- Perioder kan gå över månadsgränser; avdraget fördelas per månad baserat på överlappande dagar.

### Semestertillägg
1/125 av (månadslön + drift) per semesterdag, utbetalas månaden efter (visas i kalkylatorn för intjänandemånaden).  
**OBS!** För skiftlag A–E multipliceras antalet uttagna semesterdagar med `SEMESTER_KVOT = 1.78` innan tillägget beräknas. R3 (GUCH/BEAB) och Manuell använder ingen kvot.

### Fackavgift
1,65 % av bruttolönen, max 701 kr, min 255 kr.

### Skatt
Tabell 33 (kolumn 1), platt upp till 120 000 kr, därefter 52 % marginalskatt.  
- 2026: exakt enligt SKVFS 2025:20 (platt upp till 80 000 kr, därefter procentsatser)  
- 2024/2025: rekonstruerade (approximativa)

## Nya funktioner och beteenden

### Lokala datumnycklar (`localDateKey`)
All frånvaro och OB-beräkning använder nu lokala datum (inte UTC) för att undvika tidzonsfel. Detta löste problemet med att vissa dagar hamnade fel en dag.

### Profilmedveten fromvaro
Frånvaro (semester, VAB, FL, sjuk, Komp/Flex) sparas **separat per profil** i localStorage. När du byter profil laddas rätt profils frånvaro.

### Månadsvisa manuella fält
Övertid, öt enkel, övrigt och engångsskatt sparas **per månad och lag** i localStorage. De försvinner inte när du byter månad, men följer rätt månad.

### Resetknappar
- **↺ Schema** rensar endast frånvaro för den **visade arbetsmånaden**.
- **↺ Pass** rensar endast manuella passöverstyrningar för den **visade arbetsmånaden**.

### Komp/Flex-ledighet
Ny frånvarotyp som tar bort all OB för den markerade dagen.

### R3‑personal (GUCH och BEAB)
Två nya lag i rullgardinen:
- **GUCH**: roterande 5/4‑dagarsvecka, startar med 5 dagar 1 jan. Arbetstid 06:00–15:00, ej röda dagar.
- **BEAB**: roterande 4/5‑dagarsvecka, startar med 4 dagar 1 jan. Arbetstid 06:00–15:00, ej röda dagar.
- Båda har ett fast OB‑grundande tillägg på **4000 kr**.
- Semesterkvot tillämpas ej.

### Autosave och profiler
Autosave sparar grundinställningar, men inte frånvaro. Frånvaro sparas separat per profil. Profiler innehåller ej frånvaro.

### Årsöversikt
Uppdateras automatiskt när du byter period eller lag om panelen är öppen.

## Nyligen genomförda ändringar / buggfixar

1. **Midsommarpermission** – endast midsommarafton + midsommardagen dagpass (bort med söndagens permission).
2. **D‑lagets startdatum** – flyttat från 29 dec till 30 dec 2025 för att hamna i fas.
3. **OB‑fält låstes bort** – låsknapp och `manualOBOverride` helt rensade. Fälten fylls automatiskt men kan redigeras manuellt; ändringarna behålls tills nästa periodbyte.
4. **OB3‑blandning förenklad** – enkel subtraktion OB1→OB2 istället för komplex intervall‑matchning.
5. **Nationaldags‑OB3** – anpassad efter FlexHRM: om nationaldagen är lör/sön startar OB3 dagen före kl. 07.00.
6. **Nyårsaftonspermission** – gäller nu alla pass (ej bara natt).
7. **Årsöversikt** – fungerar igen efter OB‑fixarna.
8. **Lokala datumnycklar** – åtgärdade tidzonsproblemet som gjorde att semesterdagar kunde förskjutas en dag.
9. **R3‑personal** – lade till GUCH och BEAB med rotation, arbetstider och OB‑grundande tillägg.
10. **Komp/Flex‑ledighet** – ny frånvarotyp som tar bort OB.
11. **Semesterkvot 1,78** – aktiverad för skiftlag A–E, men inte för R3/manuell.
12. **Resetknappar** – rensar nu bara den visade arbetsmånaden.
13. **Föräldraledighet** – periodlogiken uppdaterad: startar på första FL‑dagen, slutar på sista FL‑dagen, arbetsdagar utan FL bryter perioden. Hanterar månadsgränser.
14. **Profilmedveten fromvaro** – varje profil har sin egen sparade frånvaro.

## Kvar att följa upp / möjliga framtida kontroller

- **Skattetabell 2027** – hämta när den finns tillgänglig.
- **FlexHRM‑avvikelser** – kontrollera andra storhelger mot lönespecen om de följer samma mönster som nationaldagen.
- **Sjuk‑OB vid del‑av‑dag** – verifiera mot lönespec för olika scenarier.
- **R3‑rotation** – kontrollera att startdatum och rotation stämmer med verkligheten.

## Hur du testar efter ändringar

1. Hårdladda sidan (Ctrl+Shift+R / Cmd+Shift+R) för att rensa cache.
2. Välj lag (t.ex. E), sätt månadslön och kontrollera OB‑timmar för en känd månad (juni 2026 är bra).
3. Testa storhelg: 1 maj, nationaldag, midsommar.
4. Markera semester, VAB, FL, sjuk, Komp/Flex – kontrollera att OB‑fälten och översikten uppdateras direkt.
5. Årsöversikten ska visa summerad bruttolön, nettolön, skatt, fackavgift, total OB och semestertillägg.
6. Testa att byta profil och se att frånvaron följer rätt profil.
7. Testa resetknapparna och bekräfta att de bara rensar aktuell månad.

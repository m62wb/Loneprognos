# Löneprognos 2024–2036 – IKEM Lokalt Avtal (Recipharm, Uppsala)

Webbaserad lönekalkylator för skiftarbetare med IKEM:s lokala avtal.
Beräknar bruttolön, OB, övertid, sjukavdrag, föräldraledighet, VAB,
semestertillägg, fackavgift, preliminärskatt (tabell 33) samt
FK-ersättning (VAB, FP, FTP).

## Filstruktur

- index.html – gränssnitt, Chart.js CDN, laddar JS-filer
- css/style.css – mörkt/ljust tema, färger för dag/natt/frånvaro
- js/scheman.js – skiftcykler A–E, R3 (GUCH/BEAB), OB1–3, helgdagar, permission
- js/skattetabell.js – skattetabell 33 kolumn 1 för 2024, 2025, 2026
- js/storage.js – profiler, autosave, applyState, import/export, loadScenario
- js/script.js – huvudberäkning, UI, frånvaro, sjukregler, FL 5-dagarsregel, auto-SGI

## Viktiga konstanter (script.js)

- DRIFT = 4.0 (%)
- VAB_HPD = 12.25 (timmar per dag)
- O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94
- PBB = 59200 (2026), SGI_TAK_PARENTAL = 10*PBB, SGI_TAK_VAB = 7.5*PBB
- FK_SKATT = 0.30
- UPCT=0.0165, UMAX=701, UMIN=255 (fackavgift IF Metall)
- SEMESTER_KVOT = 1.78 (endast för skiftarbetare A–E)
- FTP_INKOMSTTAK_MANAD = 49300 (10 PBB / 12, enligt AFA)
- STATLIG_SKATT_GRANS_MANAD = 53600 (2026, uppdateras årligen)
- Semestertillägg: (månadslön + drift) / 125 per dag
- Sjukavdrag 100%: månadslön / (141 + 2/3)
- Sjuklön 80%: månadslön / (177 + 1/12)

## Avtalets OB och tillägg

### Driftformstillägg
4 % av fasta månadslönen.

### OB (punkt 9)
- OB1 (/460): mån–fre 18.00–24.00
- OB2 (/260): mån–fre 00.00–07.00, samt lör 00.00 – sön 24.00
- OB3 (/150): storhelger

### OB3-perioder
- Påsk: skärtorsdag 18.00 → tisdag efter påsk 00.00
- Första maj: 1 maj 07.00 → första vardag efter 00.00
- Nationaldag: 6 juni 07.00 → första vardag efter 00.00. FlexHRM-justering: om 6/6 är lördag → start fredag 07.00; om söndag → start lördag 07.00
- Midsommar: midsommarafton 07.00 → söndag efter midsommardagen 00.00
- Jul: julafton 07.00 → första vardag efter julhelgen 00.00
- Nyår: nyårsafton 07.00 → första vardag efter nyår 00.00

### Permission
- Julafton (24/12) – hela dygnet
- Juldagen (25/12) – endast dagpass
- Nyårsafton (31/12) – hela dygnet
- Nyårsdagen (1/1) – endast dagpass
- Midsommarafton – hela dygnet
- Midsommardagen – endast dagpass

### Röda dagar (ej permissionsdagar)
Alla svenska helgdagar ger OB2 för hela passet (12,25 h).

### OB-blandning
calcOB använder intervallbaserad blandning: OB3 subtraheras bara från den del av OB1/OB2 som faktiskt överlappar OB3-perioden.
Exempel: 5 juni 2026 (nationaldag) dagpass → 1,25 h OB2 + 11 h OB3.
Nattpass med 17:45–06:00 under OB3 → hela passet OB3 (max 12,25).

### Övertid
- Vardag 06–20: månadslön/94
- Övrig tid: månadslön/72
- Övertidsersättning inkluderar OB.

### Sjukavdrag och karens
- Karensavdrag: 6,8 h × månadslön/(141+2/3)
- Sjukavdrag 100 % / sjuklön 80 % per frånvarotimme
- Sjuk-OB (80 % av OB för de timmar som skulle tjänats in)

### Företagets "bugg" – VIKTIGT
Vid heldagssjukdom gör arbetsgivaren så här enligt lönespecifikationen:

1. Du får vanlig OB för hela passet, precis som om du jobbat ("kaka på kaka").
2. Du får dessutom sjuk-OB (80 %) för de timmar som inte karensen äter upp.
3. Karensen (6 h i praktiken, inte 6,8 h) dras bara en gång – från första OB-typen som finns i passet (OB1 → annars OB2 → annars OB3).

Detta är implementerat i calcSickDeduction med:
  let rem = 6.0;
  if (o1>0) {...} else if (o2>0) {...} else if (o3>0) {...}

Vid del av dag används hela karensen (6,8 h) med prioriteringsordning OB1 → OB2 → OB3.

AutoOB för sjukdagar läggs tillbaka i calculateEverything:
  if (autoOB && lag !== 'manual') {
    for (let d = 1; d <= daysInMonth; d++) {
      ...
      if (fromvaroMap.get(key) === 4) {
        const ob = calcOB(date, shift, lag);
        autoOB.ob1 += ob.ob1;
        autoOB.ob2 += ob.ob2;
        autoOB.ob3 += ob.ob3;
      }
    }
  }
Detta block får ALDRIG tas bort – det är helt nödvändigt för att matcha lönespecen.

### Föräldraledighet (lokal 5-dagarsregel)
- Alla schemalagda pass (inkl. helger) räknas som arbetsdagar.
- > 5 arbetsdagar i sammanhängande period → kalenderdagsavdrag (månadslön / 30 per dag, inkl. lediga dagar).
- ≤ 5 arbetsdagar → timavdrag 12,25 h × sjuklön100 per arbetsdag.
- Perioden expanderar INTE bakåt/framåt – den börjar på första FL-dagen och slutar på sista. Lediga dagar mellan dessa ingår.
- Stödjer perioder som sträcker sig över månadsgränser: calcParentalDeduction samlar alla FL-datum globalt och beräknar avdrag per månad baserat på hela periodens arbetsdagar.

### Semestertillägg
1/125 av (månadslön + drift) per förbrukad dag, där förbrukad = uttagen × 1,78 för skiftarbetare.

### VAB
- Avdrag: 12,25 h × (månadslön/141,6667) per arbetsdag
- FK: 80 % av SGI/365 (tak 7,5 PBB)

### FTP (AFA)
- Endast vid FL (parentalD > 0)
- 10 % av månadslönen per dag, tak 49 300 kr/mån

### Fackavgift
1,65 % av bruttolönen, max 701 kr, min 255 kr.

### Skatt
Tabell 33 (kolumn 1), platt upp till 80 000 kr, därefter procentsatser. År 2024, 2025 och 2026 har egna tabeller.

## Färger i schemat
- Dag: grön rgba(63,185,80,0.15)
- Natt: röd rgba(255,87,34,0.20)
- Semester: gul rgba(255,193,7,0.20)
- VAB: rosa rgba(255,20,147,0.25)
- F-ledig: baby blue rgba(137,207,240,0.35)
- Sjuk: transparent (polkagrisrand via tbody-gradient)
- Komp/Flex: grå rgba(128,128,128,0.25)

## Skiftcykler

- A–E: 35-dagarscykler med startdatum enligt scheman.js. D flyttad till 30 dec 2025 för att hamna i fas.
- GUCH/BEAB (R3, dagtid 06:00–15:00, ej röda dagar):
  - GUCH: 5-dagarsvecka (mån–fre) i jämna veckor, 4-dagarsvecka (mån–tors) i udda
  - BEAB: omvänt
  - Fast tillägg: 4 000 kr/mån, OB-grundande
  - startR3 = new Date(2025, 11, 29)
- Manuell: användaren styr pass själv

## Funktioner

- Autosave i localStorage (loneprognos_autosave_v1)
- Profiler i localStorage (loneprognos_profiler_v3) – stödjer export/import som JSON
- Fromvaro per profil i localStorage (loneprognos_fromvaro_<profilnamn>)
- Manuella fält per månad+lag i localStorage (loneprognos_monthly_manual_v1)
- Månadslön per månad i localStorage (loneprognos_monthly_salary_v1)
- Bruttolönshistorik per månad i localStorage (loneprognos_monthly_gross_v1) för auto-SGI
- Auto-SGI: beräknar SGI från föregående års bruttolöner inklusive OB, övertid, övrigt och semestertillägg
- Import/export av profiler som JSON (accept="*/*" för Android-kompatibilitet)
- Komp/Flex som frånvarotyp (ingen OB, ingen FK)
- Årsöversikt som uppdateras när panelen är öppen
- OB-diagram med Chart.js
- Mörkt/ljust tema med localStorage
- Månadsval – visar arbetsmånaden (löneperiod minus 1 månad)

## Kritiska implementation-detaljer

### Autosave
updateUI anropar autoSaveState() som skriver getCurrentState() till loneprognos_autosave_v1. Vid start läses autosave och applyState körs.

### loadFromvaroMap (global)
Tömmer fromvaroMap när ingen profil är vald. Sparar/laddar per profil.
  function loadFromvaroMap() {
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect && profileSelect.value === '') {
      fromvaroMap.clear();
      return;
    }
    const saved = localStorage.getItem(getFromvaroKey());
    fromvaroMap.clear();
    if (saved) {
      try {
        for (const [k, v] of JSON.parse(saved)) fromvaroMap.set(k, v);
      } catch(e) { fromvaroMap.clear(); }
    }
  }

### loadScenario (storage.js)
Måste anropa loadFromvaroMap(), loadSalaryForCurrentPeriod(), loadManualInputsFromCurrentPeriod() och sedan updateUI() så att allt uppdateras direkt vid profilbyte:
  window.loadScenario = function() {
    const select = document.getElementById('profileSelect');
    const name = select.value;
    if (!name) return;
    const profiles = getAllProfiles();
    const state = profiles[name];
    if (!state) { alert('Profilen kunde inte hittas.'); return; }
    applyState(state);

    if (typeof loadFromvaroMap === 'function') loadFromvaroMap();
    if (typeof loadSalaryForCurrentPeriod === 'function') loadSalaryForCurrentPeriod();
    if (typeof loadManualInputsFromCurrentPeriod === 'function') loadManualInputsFromCurrentPeriod();
    if (typeof updateUI === 'function') updateUI();
  };

### localDateKey
Används för att undvika tidszonsproblem. Format YYYY-MM-DD utan UTC.

### Startbeteende
- Inget lag förvalt vid start (lagSelect.value = ''; i slutet av DOMContentLoaded)
- Aktuell månad visas alltid vid start (styrs i applyState i storage.js)

### Resultatkort i index.html
Tre rader:
1. #jobNetRow – visas endast när totalErsattningNetto > 0
2. #fkNetRow – visas endast när totalErsattningNetto > 0
3. #finalNetSalary + #totalNetLabel – "Totalt netto" eller "Totalt netto (jobb + FK)" dynamiskt

Använd flex (inte grid) för jobNetRow/fkNetRow – Android har problem med grid.

### renderUI – viktig ordning
Alla const-referenser till DOM-element måste deklareras före de används (TDZ-fel annars).

## Nyligen genomförda ändringar / buggfixar

1. AutoOB för sjukdagar läggs tillbaka – "kaka på kaka" enligt lönespec. Får ALDRIG tas bort.
2. Sjuk-OB heldag: endast 6 h dras från första OB-typen.
3. Föräldraledighet över månadsgränser – fungerar nu.
4. Period-expansion borttagen – FL-perioden börjar på första FL-dagen och slutar på sista.
5. Semesterkvot 1,78 för A–E.
6. R3-tillägg 4 000 kr OB-grundande för GUCH/BEAB.
7. Komp/Flex tillagd som frånvarotyp.
8. Nationaldagens OB3 startar dagen före om 6/6 är helg.
9. Månadslön per månad sparas i localStorage.
10. Manuella fält per månad (övertid, övrigt, engångsskatt) sparas.
11. Auto-SGI från föregående års inkomster.
12. FTP-tak 49 300 kr/mån.
13. FTP endast vid FL.
14. Profilimport/export med accept="*/*" för Android.
15. Årsöversikt uppdateras live när panelen är öppen.
16. Datumhantering via localDateKey (inga UTC-problem).
17. Start utan förvalt lag – användaren väljer aktivt.

## Kända egenheter (INTE buggar)

- Sjuk "kaka på kaka" – enligt lönespec, får inte "fixas bort".
- Karens 6 h (inte 6,8 h) vid heldag – enligt lönespec.
- Endast 6 h dras från första OB-typen vid heldag – oavsett passets sammansättning.
- AutoOB för sjukdagar läggs tillbaka separat – utan detta stämmer inte totalsumman.

## Vad som behöver följas upp

- Skattetabeller: 2024 och 2025 är rekonstruerade approximationer; 2026 är exakt enligt SKVFS 2025:20. Uppdatera 2024/2025 om exakta tabeller blir tillgängliga.
- PBB: Fast konstant 59 200 (2026). Höjs det behöver PBB, SGI_TAK_PARENTAL, SGI_TAK_VAB och FTP_INKOMSTTAK_MANAD uppdateras.
- Brytpunkt statlig skatt (53 600 kr/mån 2026): uppdateras årligen i STATLIG_SKATT_GRANS_MANAD.
- Framtida ändringar i avtalet – OB-tider, permission, sjukregler.
- Auto-SGI använder monthlyGross – om användaren glömmer fylla i en månad blir SGI lägre. Skulle kunna lägga in en varning.

## Testdata (för regression)

- Lag E, maj 2026 (utbetalas i juni): OB1 = 24 h, OB2 = 90,25 h, OB3 = 11 h
- Lag E, april 2026 (utbetalas i maj): OB1 = 30 h, OB2 = 73 h, ÖT = 6 h. Med månadslön 36 713 kr och 2 sjukdagar (30+31/3): Bruttolön = 53 701,96 kr, netto ≈ 40 045 kr
- Lag E, v.39–40: FL 21/9–1/10 → period med 6 pass → kalenderdagsavdrag 13 802,80 kr + OB-förlust 9 345,77 kr – FP netto 5 286,16 → total förlust ~17 862 kr
- OB3-dagar: 1 maj 2026 (dag 1,25 h OB2 + 11 h OB3), 5 juni 2026 (samma), 6 juni 2026 lördag hela passet OB3

## Teknisk stack
- Ren HTML/CSS/JavaScript (ingen build-process)
- Chart.js 4.4.0 via CDN
- localStorage för all persistens
- Ingen server, inget backend, inget konto

## Användning
1. Öppna index.html i valfri modern webbläsare
2. Välj lag (och profil om tillämpligt)
3. Ange månadslön
4. Markera frånvaro/OB/övertid i schemat
5. Se prognos i resultatkortet och översikten

All data sparas lokalt i webbläsaren och delas inte mellan användare eller enheter (såvida inte profil exporteras/importeras via JSON).

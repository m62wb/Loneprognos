// ---- Globala kartor för frånvaro och skiftöverstyrning ----
const fromvaroMap = new Map();
const shiftOverrideMap = new Map();

// ---- Datumhjälpfunktioner ----
function daysBetween(d1, d2) {
  return Math.floor((Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) -
                     Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())) / 86400000);
}

function getDSTAdjustment(date) {
  let y = date.getFullYear(),
      se = new Date(y, 2, 31);
  while (se.getDay() !== 0) se.setDate(se.getDate() - 1);
  let we = new Date(y, 9, 31);
  while (we.getDay() !== 0) we.setDate(we.getDate() - 1);
  if (date.getDate() === se.getDate() && date.getMonth() === se.getMonth()) return -1;
  if (date.getDate() === we.getDate() && date.getMonth() === we.getMonth()) return 1;
  return 0;
}

// ---- Schema för Lag A ----
const startA = new Date(2025, 11, 29);
const cycleA = [0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0];
let scheduleA = {};
for (let i = 0; i < 365 * 15; i++) scheduleA[i] = cycleA[i % cycleA.length];
function getShiftA(date) { let d = daysBetween(startA, date); return d < 0 ? 0 : scheduleA[d] || 0; }

// ---- Schema för Lag B ----
const startB = new Date(2025, 11, 29);
const cycleB = [0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,0,2,2,2];
let scheduleB = {};
for (let i = 0; i < 365 * 15; i++) scheduleB[i] = cycleB[i % cycleB.length];
function getShiftB(date) { let d = daysBetween(startB, date); return d < 0 ? 0 : scheduleB[d] || 0; }

// ---- Schema för Lag C ----
const startC = new Date(2025, 11, 29);
const cycleC = [2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0];
let scheduleC = {};
for (let i = 0; i < 365 * 15; i++) scheduleC[i] = cycleC[i % cycleC.length];
function getShiftC(date) { let d = daysBetween(startC, date); return d < 0 ? 0 : scheduleC[d] || 0; }

// ---- Schema för Lag D ----
const startD = new Date(2025, 11, 29);
const cycleD = [0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0];
let scheduleD = {};
for (let i = 0; i < 365 * 15; i++) scheduleD[i] = cycleD[i % cycleD.length];
function getShiftD(date) { let d = daysBetween(startD, date); return d < 0 ? 0 : scheduleD[d] || 0; }

// ---- Schema för Lag E ----
const startE = new Date(2026, 0, 1);
const cycleE = [0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1];
let scheduleE = {};
for (let i = 0; i < 365 * 15; i++) scheduleE[i] = cycleE[i % cycleE.length];
function getShiftE(date) { let d = daysBetween(startE, date); return d < 0 ? 0 : scheduleE[d] || 0; }

// ---- Huvudfunktion för att hämta skift ----
function getOrdinaryShift(date, lag) {
  if (lag === 'A') return getShiftA(date);
  if (lag === 'B') return getShiftB(date);
  if (lag === 'C') return getShiftC(date);
  if (lag === 'D') return getShiftD(date);
  if (lag === 'E') return getShiftE(date);
  return 0;
}

function getShift(date, lag) {
  let key = date.toISOString().split('T')[0];
  if (shiftOverrideMap.has(key)) return shiftOverrideMap.get(key);
  return getOrdinaryShift(date, lag);
}

// ---- Påskberäkning ----
function getEaster(year) {
  let a = year % 19,
      b = Math.floor(year / 100),
      c = year % 100,
      d = Math.floor(b / 4),
      e = b % 4,
      f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4),
      k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31),
      day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getMidsummer(year) {
  let d = new Date(year, 5, 20);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return d;
}

function getAllHelgons(year) {
  let d = new Date(year, 9, 31);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return d;
}

// ---- Permissiondagar ----
function isPermissionDay(date, lag) {
  let m = date.getMonth(), d = date.getDate(), shift = getShift(date, lag);
  if (m === 11 && d === 24) return true;                     // julafton
  if (m === 11 && d === 25 && shift === 1) return true;      // juldagen dag
  if (m === 11 && d === 31 && shift === 2) return true;      // nyårsafton natt
  if (m === 0 && d === 1 && shift === 1) return true;        // nyårsdagen dag
  let mid = getMidsummer(date.getFullYear()), eve = new Date(mid);
  eve.setDate(mid.getDate() - 1);                           // midsommarafton
  if (date.toDateString() === eve.toDateString()) return true;
  if (date.toDateString() === mid.toDateString()) return true;
  let mids = new Date(mid); mids.setDate(mid.getDate() + 1); // midsommardagen dag
  if (date.toDateString() === mids.toDateString() && shift === 1) return true;
  return false;
}

// ---- OB3-perioder (anpassade till verkliga passtider) ----
function isOB3Period(date, shift) {
  const y = date.getFullYear();

  // Påsk
  let easter = getEaster(y);
  let skartorsdag = new Date(easter); skartorsdag.setDate(easter.getDate() - 3);
  let tisdagEfterPask = new Date(easter); tisdagEfterPask.setDate(easter.getDate() + 2);

  // Midsommar
  let midsommarAfton = new Date(getMidsummer(y)); midsommarAfton.setDate(midsommarAfton.getDate() - 1);
  let sondagEfterMidsommar = new Date(getMidsummer(y)); sondagEfterMidsommar.setDate(sondagEfterMidsommar.getDate() + 1);

  // Jul
  let julafton = new Date(y, 11, 24);
  let forstaVardagEfterJul = new Date(y, 11, 27);
  while (forstaVardagEfterJul.getDay() === 0 || forstaVardagEfterJul.getDay() === 6) {
    forstaVardagEfterJul.setDate(forstaVardagEfterJul.getDate() + 1);
  }

  // Nyår
  let nyarsafton = new Date(y, 11, 31);
  let forstaVardagEfterNy = new Date(y + 1, 0, 2);
  while (forstaVardagEfterNy.getDay() === 0 || forstaVardagEfterNy.getDay() === 6) {
    forstaVardagEfterNy.setDate(forstaVardagEfterNy.getDate() + 1);
  }

  // Första maj och nationaldag
  let forstaMaj = new Date(y, 4, 1);
  let nationaldag = new Date(y, 5, 6);

  // Hjälpfunktion för att kontrollera överlapp med OB3-period
  function inPeriod(periodStart, periodEnd, date, shift) {
    // Passets start- och sluttid
    let passStart, passEnd;
    if (shift === 1) { // dagpass 05:45-18:00
      passStart = new Date(date); passStart.setHours(5, 45, 0, 0);
      passEnd = new Date(date); passEnd.setHours(18, 0, 0, 0);
    } else if (shift === 2) { // nattpass 17:45-06:00 (över midnatt)
      passStart = new Date(date); passStart.setHours(17, 45, 0, 0);
      passEnd = new Date(date); passEnd.setDate(passEnd.getDate() + 1); passEnd.setHours(6, 0, 0, 0);
    } else {
      return false;
    }
    // Överlapp mellan passet och OB3-perioden
    let overStart = passStart > periodStart ? passStart : periodStart;
    let overEnd = passEnd < periodEnd ? passEnd : periodEnd;
    let overMs = overEnd - overStart;
    // Kräv minst 6 timmars överlapp för att ge OB3 (samma princip som tidigare)
    return overMs > 6 * 60 * 60 * 1000;
  }

  // Påskperiod: skärtorsdag 18:00 → tisdag efter påsk 00:00
  let paskStart = new Date(skartorsdag); paskStart.setHours(18, 0, 0, 0);
  let paskEnd = new Date(tisdagEfterPask); paskEnd.setHours(0, 0, 0, 0);
  if (inPeriod(paskStart, paskEnd, date, shift)) return true;

  // Första maj: 07:00 → nästa dag 00:00
  let majStart = new Date(forstaMaj); majStart.setHours(7, 0, 0, 0);
  let majEnd = new Date(forstaMaj); majEnd.setDate(majEnd.getDate() + 1); majEnd.setHours(0, 0, 0, 0);
  if (inPeriod(majStart, majEnd, date, shift)) return true;

  // Nationaldag: 07:00 → nästa dag 00:00
  let natStart = new Date(nationaldag); natStart.setHours(7, 0, 0, 0);
  let natEnd = new Date(nationaldag); natEnd.setDate(natEnd.getDate() + 1); natEnd.setHours(0, 0, 0, 0);
  if (inPeriod(natStart, natEnd, date, shift)) return true;

  // Midsommar: midsommarafton 07:00 → måndag 00:00
  let midsStart = new Date(midsommarAfton); midsStart.setHours(7, 0, 0, 0);
  let midsEnd = new Date(sondagEfterMidsommar); midsEnd.setDate(midsEnd.getDate() + 1); midsEnd.setHours(0, 0, 0, 0);
  if (inPeriod(midsStart, midsEnd, date, shift)) return true;

  // Jul: julafton 07:00 → första vardag efter julhelgen 00:00
  let julStart = new Date(julafton); julStart.setHours(7, 0, 0, 0);
  let julEnd = new Date(forstaVardagEfterJul); julEnd.setHours(0, 0, 0, 0);
  if (inPeriod(julStart, julEnd, date, shift)) return true;

  // Nyår: nyårsafton 07:00 → första vardag efter nyår 00:00
  let nyStart = new Date(nyarsafton); nyStart.setHours(7, 0, 0, 0);
  let nyEnd = new Date(forstaVardagEfterNy); nyEnd.setHours(0, 0, 0, 0);
  if (inPeriod(nyStart, nyEnd, date, shift)) return true;

  return false;
}

// ---- OB‑beräkning (oförändrad OB1/OB2, ny OB3) ----
function calcOB(date, shift, lag) {
  if (isPermissionDay(date, lag) || shift === 0) return {ob1:0, ob2:0, ob3:0};

  // OB3 enligt avtalets storhelgsperioder
  if (isOB3Period(date, shift)) {
    return {ob1:0, ob2:0, ob3:12.25};
  }

  // OB1/OB2 enligt tidigare beprövad modell (stämmer med din lönespec)
  let w = date.getDay(), isWeekend = (w === 0 || w === 6), ob1 = 0, ob2 = 0;
  if (shift === 1) {
    if (isWeekend) ob2 = 12.25; else ob2 = 1.25;
  } else if (shift === 2) {
    if (isWeekend) ob2 = 12.25; else { ob1 = 6; ob2 = 6; }
  }
  let dst = getDSTAdjustment(date);
  if (dst !== 0 && shift === 2) {
    if (ob2 >= 6) ob2 += dst; else if (ob1 >= 6) ob1 += dst;
  }
  return {ob1, ob2, ob3:0};
}

// ---- Månadssummering av OB (oförändrad) ----
function getOBForMonth(year, month, lag) {
  let to1 = 0, to2 = 0, to3 = 0;
  let dim = new Date(year, month, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    let date = new Date(year, month - 1, d);
    let dateStr = date.toISOString().split('T')[0];
    let shift = getShift(date, lag);
    if (fromvaroMap.has(dateStr)) continue;
    let ob = calcOB(date, shift, lag);
    to1 += ob.ob1; to2 += ob.ob2; to3 += ob.ob3;
  }
  return {ob1:to1, ob2:to2, ob3:to3};
}

// ---- Stationer för lag E (oförändrad) ----
const stationsE = ['Reaktorn', 'Dian', 'Spray'];
const initials = ['B', 'Y', 'M'];
const refStation = new Date(2026, 5, 9);

function countWorkShiftsUntil(date, lag) {
  let cnt = 0, d = new Date(refStation);
  while (daysBetween(d, date) > 0) {
    let sh = getShift(d, lag);
    if (sh > 0 && !isPermissionDay(d, lag)) cnt++;
    d.setDate(d.getDate() + 1);
  }
  return cnt;
}

function getStationE(date, shift, lag) {
  if (shift === 0 || isPermissionDay(date, lag)) return '-';
  let ws = countWorkShiftsUntil(date, lag),
      idx = ws % 3,
      yidx = (idx + 1) % 3,
      midx = (idx + 2) % 3;
  let bp = stationsE[idx] + '(' + initials[0] + ')',
      yp = stationsE[yidx] + '(' + initials[1] + ')',
      mp = stationsE[midx] + '(' + initials[2] + ')';
  let day = date.getDay();
  if ((day === 6 && shift === 1 && idx === 2) || (day === 0 && shift === 1 && idx === 1)) bp += '🧹';
  return bp + ' ' + yp + ' ' + mp;
}

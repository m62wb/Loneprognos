// ---- Globala kartor för frånvaro och skiftöverstyrning ----
const fromvaroMap = new Map();       // används av schemafunktioner + script.js
const shiftOverrideMap = new Map();  // används av getShift + script.js

// ---- Grundläggande datumhjälpfunktioner ----
function daysBetween(d1, d2) {
  return Math.floor((Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) -
                     Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())) / 86400000);
}

function getDSTAdjustment(date) {
  let y = date.getFullYear(),
      se = new Date(y, 2, 31);        // sista mars
  while (se.getDay() !== 0) se.setDate(se.getDate() - 1);
  let we = new Date(y, 9, 31);        // sista oktober
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

// ---- Storhelger & påsk ----
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

function isStorhelg(date) {
  let m = date.getMonth(), d = date.getDate();
  if (m === 0 && d === 1) return true;                 // nyårsdagen
  if (m === 0 && d === 6) return true;                 // trettondedag jul
  let e = getEaster(date.getFullYear());
  let lf = new Date(e); lf.setDate(e.getDate() - 2);   // långfredag
  let pd = new Date(e); pd.setDate(e.getDate() + 1);   // påskdagen
  if (date.toDateString() === lf.toDateString() ||
      date.toDateString() === e.toDateString() ||
      date.toDateString() === pd.toDateString()) return true;
  if (m === 4 && d === 1) return true;                 // första maj
  let kh = new Date(e); kh.setDate(e.getDate() + 39);  // kristi himmelsfärd
  if (date.toDateString() === kh.toDateString()) return true;
  if (m === 5 && d === 6) return true;                 // nationaldag (sällan storhelg, men du hade med den)
  let mid = getMidsummer(date.getFullYear());
  if (date.toDateString() === mid.toDateString()) return true; // midsommardagen
  let mids = new Date(mid); mids.setDate(mid.getDate() + 1);
  if (date.toDateString() === mids.toDateString()) return true; // midsommardagens dag efter?
  let ah = getAllHelgons(date.getFullYear());
  if (date.toDateString() === ah.toDateString()) return true;   // alla helgons dag
  if (m === 11 && (d === 24 || d === 25 || d === 26)) return true; // julafton, juldagen, annandag jul
  if (m === 11 && d === 31) return true;                         // nyårsafton
  return false;
}

function isPermissionDay(date, lag) {
  let m = date.getMonth(), d = date.getDate(), shift = getShift(date, lag);
  if (m === 11 && d === 24) return true;
  if (m === 11 && d === 25 && shift === 1) return true;
  if (m === 11 && d === 31 && shift === 2) return true;
  if (m === 0 && d === 1 && shift === 1) return true;
  let mid = getMidsummer(date.getFullYear()), eve = new Date(mid);
  eve.setDate(mid.getDate() - 1);
  if (date.toDateString() === eve.toDateString()) return true;
  if (date.toDateString() === mid.toDateString()) return true;
  let mids = new Date(mid); mids.setDate(mid.getDate() + 1);
  if (date.toDateString() === mids.toDateString() && shift === 1) return true;
  return false;
}

// ---- OB‑beräkning ----
function calcOB(date, shift, lag) {
  if (isPermissionDay(date, lag) || shift === 0) return {ob1:0, ob2:0, ob3:0};
  let w = date.getDay(), isWeekend = (w === 0 || w === 6), ob1 = 0, ob2 = 0, ob3 = 0;
  if (isStorhelg(date)) ob3 = 12.25;
  else if (shift === 1) {
    if (isWeekend) ob2 = 12.25; else ob2 = 1.25;
  } else if (shift === 2) {
    if (isWeekend) ob2 = 12.25; else { ob1 = 6; ob2 = 6; }
  }
  let dst = getDSTAdjustment(date);
  if (dst !== 0 && shift === 2) {
    if (ob2 >= 6) ob2 += dst; else if (ob1 >= 6) ob1 += dst;
  }
  return {ob1, ob2, ob3};
}

function getOBForMonth(year, month, lag) {
  let to1 = 0, to2 = 0, to3 = 0;
  let dim = new Date(year, month, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    let date = new Date(year, month - 1, d);
    let dateStr = date.toISOString().split('T')[0];
    let shift = getShift(date, lag);
    if (fromvaroMap.has(dateStr)) continue;     // frånvaro → ingen OB
    let ob = calcOB(date, shift, lag);
    to1 += ob.ob1; to2 += ob.ob2; to3 += ob.ob3;
  }
  return {ob1:to1, ob2:to2, ob3:to3};
}

// ---- Stationer för lag E (valfritt, men flyttas med) ----
const stationsE = ['Reaktorn', 'Dian', 'Spray'];
const initials = ['B', 'Y', 'M'];
const refStation = new Date(2026, 5, 9);  // referensdatum för rotation

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

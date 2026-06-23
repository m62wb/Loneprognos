// ---- Kartor & globala variabler ----
const fromvaroMap = new Map();
const shiftOverrideMap = new Map();
let vacationOverrideMap = new Map();
let manualOBOverride = false;

// ---- Datumhjälp ----
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

// ---- Skiftscheman ----
const startA = new Date(2025, 11, 29);
const cycleA = [0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0];
function getShiftA(date) { let d = daysBetween(startA, date); return cycleA[((d % 35) + 35) % 35]; }
const startB = new Date(2025, 11, 29);
const cycleB = [0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,0,2,2,2];
function getShiftB(date) { let d = daysBetween(startB, date); return cycleB[((d % 35) + 35) % 35]; }
const startC = new Date(2025, 11, 29);
const cycleC = [2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0];
function getShiftC(date) { let d = daysBetween(startC, date); return cycleC[((d % 35) + 35) % 35]; }
const startD = new Date(2025, 11, 30);
const cycleD = [0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0];
function getShiftD(date) { let d = daysBetween(startD, date); return cycleD[((d % 35) + 35) % 35]; }
const startE = new Date(2026, 0, 1);
const cycleE = [0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1];
function getShiftE(date) { let d = daysBetween(startE, date); return cycleE[((d % 35) + 35) % 35]; }

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

// ---- Helgdagar ----
function getEaster(year) {
  let a = year % 19, b = Math.floor(year / 100), c = year % 100,
      d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31),
      day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getMidsummer(year) { let d = new Date(year, 5, 20); while (d.getDay() !== 6) d.setDate(d.getDate() + 1); return d; }
function getAllHelgons(year) { let d = new Date(year, 9, 31); while (d.getDay() !== 6) d.setDate(d.getDate() + 1); return d; }

// Alla svenska röda dagar
function isHoliday(date) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  if (m === 0 && d === 1)  return true;
  if (m === 0 && d === 6)  return true;
  if (m === 4 && d === 1)  return true;
  if (m === 5 && d === 6)  return true;
  if (m === 11 && d === 24) return true;
  if (m === 11 && d === 25) return true;
  if (m === 11 && d === 26) return true;
  if (m === 11 && d === 31) return true;

  const easter = getEaster(y);
  const et = easter.getTime();
  const dates = [
    new Date(et - 2*86400000), // långfredag
    new Date(et - 1*86400000), // påskafton
    easter,
    new Date(et + 1*86400000), // annandag påsk
    new Date(et + 39*86400000), // Kristi himmelsfärd
  ];
  const mid = getMidsummer(y);
  dates.push(new Date(mid.getTime() - 1*86400000)); // midsommarafton
  dates.push(mid);
  dates.push(getAllHelgons(y));

  const ds = date.toDateString();
  for (const hd of dates) if (hd.toDateString() === ds) return true;
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
  if (date.toDateString() === mid.toDateString() && shift === 1) return true;
  return false;
}

// ---- OB3‑överlapp ----
function getOB3Hours(date, shift) {
  if (shift === 0) return 0;
  const y = date.getFullYear();
  function overlapHours(ps, pe, s, e) {
    const oS = ps > s ? ps : s, oE = pe < e ? pe : e;
    return Math.max(0, (oE - oS) / (1000 * 60 * 60));
  }
  let passStart, passEnd;
  if (shift === 1) { passStart = new Date(date); passStart.setHours(5,45,0,0); passEnd = new Date(date); passEnd.setHours(18,0,0,0); }
  else { passStart = new Date(date); passStart.setHours(17,45,0,0); passEnd = new Date(date); passEnd.setDate(passEnd.getDate()+1); passEnd.setHours(6,0,0,0); }

  const easter = getEaster(y);
  const skartorsdag = new Date(easter); skartorsdag.setDate(easter.getDate()-3);
  const tisdagEfter = new Date(easter); tisdagEfter.setDate(easter.getDate()+2);
  let h = overlapHours(passStart, passEnd, new Date(skartorsdag.setHours(18,0,0,0)), new Date(tisdagEfter.setHours(0,0,0,0)));
  if (h > 0) return Math.min(h, 12.25);

  let maj = new Date(y,4,1), vmaj = new Date(maj); vmaj.setDate(vmaj.getDate()+1); while (vmaj.getDay()===0||vmaj.getDay()===6) vmaj.setDate(vmaj.getDate()+1);
  h = overlapHours(passStart, passEnd, new Date(maj.setHours(7,0,0,0)), new Date(vmaj.setHours(0,0,0,0)));
  if (h > 0) return Math.min(h, 12.25);

  let nat = new Date(y,5,6), vnat = new Date(nat); vnat.setDate(vnat.getDate()+1); while (vnat.getDay()===0||vnat.getDay()===6) vnat.setDate(vnat.getDate()+1);
  h = overlapHours(passStart, passEnd, new Date(nat.setHours(7,0,0,0)), new Date(vnat.setHours(0,0,0,0)));
  if (h > 0) return Math.min(h, 12.25);

  let mid = getMidsummer(y), ma = new Date(mid); ma.setDate(ma.getDate()-1);
  let sd = new Date(mid); sd.setDate(sd.getDate()+2); sd.setHours(0,0,0,0);
  h = overlapHours(passStart, passEnd, new Date(ma.setHours(7,0,0,0)), sd);
  if (h > 0) return Math.min(h, 12.25);

  let jul = new Date(y,11,24), vjul = new Date(y,11,27); while (vjul.getDay()===0||vjul.getDay()===6) vjul.setDate(vjul.getDate()+1);
  h = overlapHours(passStart, passEnd, new Date(jul.setHours(7,0,0,0)), new Date(vjul.setHours(0,0,0,0)));
  if (h > 0) return Math.min(h, 12.25);

  let ny = new Date(y,11,31), vny = new Date(y+1,0,2); while (vny.getDay()===0||vny.getDay()===6) vny.setDate(vny.getDate()+1);
  h = overlapHours(passStart, passEnd, new Date(ny.setHours(7,0,0,0)), new Date(vny.setHours(0,0,0,0)));
  if (h > 0) return Math.min(h, 12.25);

  return 0;
}

// ---- Huvudfunktion för OB ----
function calcOB(date, shift, lag) {
  if (isPermissionDay(date, lag) || shift === 0) return {ob1:0, ob2:0, ob3:0};

  const w = date.getDay(), isWeekend = (w === 0 || w === 6);
  let ob1 = 0, ob2 = 0;

  // Normal OB
  if (shift === 1) { if (isWeekend) ob2 = 12.25; else ob2 = 1.25; }
  else if (shift === 2) { if (isWeekend) ob2 = 12.25; else { ob1 = 6; ob2 = 6; } }
  let dst = getDSTAdjustment(date);
  if (dst !== 0 && shift === 2) { if (ob2 >= 6) ob2 += dst; else if (ob1 >= 6) ob1 += dst; }

  // OB3
  const ob3 = Math.round(getOB3Hours(date, shift) * 100) / 100;
  if (ob3 > 0) {
    // Beräkna exakt hur många OB3-timmar som faller inom OB1-resp. OB2-tidsfönster
    let ob3Remaining = ob3;
    if (shift === 2 && !isWeekend) {
      // OB1: 18:00-24:00
      const ob1Start = new Date(date); ob1Start.setHours(18,0,0,0);
      const ob1End = new Date(date); ob1End.setHours(24,0,0,0);
      const ob1Overlap = Math.max(0, Math.min(ob3Remaining, (ob1End - ob1Start)/3600000));
      const fromOB1 = Math.min(ob1, ob1Overlap);
      ob1 -= fromOB1;
      ob3Remaining -= fromOB1;
    }
    // OB2: 00:00-07:00 (nästa dag) för natt, eller 05:45-07:00 för dag
    // Vi subtraherar resterande OB3 från ob2
    const fromOB2 = Math.min(ob2, ob3Remaining);
    ob2 -= fromOB2;
    // ob3 blir kvar som angivet
    return {ob1, ob2, ob3};
  }

  // Ingen OB3 – helgdagar ger OB2 för hela passet
  if (isHoliday(date)) {
    ob2 = 12.25;
    ob1 = 0;
  }

  return {ob1, ob2, ob3:0};
}

function getOBForMonth(year, month, lag) {
  let to1 = 0, to2 = 0, to3 = 0, dim = new Date(year, month, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    let date = new Date(year, month - 1, d), key = date.toISOString().split('T')[0];
    if (fromvaroMap.has(key)) continue;
    let ob = calcOB(date, getShift(date, lag), lag);
    to1 += ob.ob1; to2 += ob.ob2; to3 += ob.ob3;
  }
  return {ob1:to1, ob2:to2, ob3:to3};
}

// ---- Stationer Lag E ----
const stationsE = ['Reaktorn', 'Dian', 'Spray'], initials = ['B', 'Y', 'M'], refStation = new Date(2026, 5, 9);
function countWorkShiftsUntil(date, lag) {
  let cnt = 0;
  if (date >= refStation) {
    let d = new Date(refStation);
    while (daysBetween(d, date) > 0) { let sh = getShift(d, lag); if (sh > 0 && !isPermissionDay(d, lag)) cnt++; d.setDate(d.getDate()+1); }
  } else {
    let d = new Date(refStation); d.setDate(d.getDate()-1);
    while (daysBetween(date, d) > 0) { let sh = getShift(d, lag); if (sh > 0 && !isPermissionDay(d, lag)) cnt++; d.setDate(d.getDate()-1); }
    cnt = -cnt;
  }
  return cnt;
}
function getStationE(date, shift, lag) {
  if (shift === 0 || isPermissionDay(date, lag)) return '-';
  let ws = countWorkShiftsUntil(date, lag), idx = ((ws % 3) + 3) % 3, yidx = (idx + 1) % 3, midx = (idx + 2) % 3;
  let bp = stationsE[idx] + '(' + initials[0] + ')', yp = stationsE[yidx] + '(' + initials[1] + ')', mp = stationsE[midx] + '(' + initials[2] + ')';
  let day = date.getDay();
  if ((day === 6 && shift === 1 && idx === 2) || (day === 0 && shift === 1 && idx === 1)) bp += '🧹';
  return bp + ' ' + yp + ' ' + mp;
}

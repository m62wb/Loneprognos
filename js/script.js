// Hjälpfunktioner & konstanter
function p(v){ if(!v) return 0; let n=String(v).replace(',','.'); let x=parseFloat(n); return isNaN(x)?0:x; }
function fc(v){ return new Intl.NumberFormat('sv-SE').format(Math.round(v)); }
function fd(v,d){ return v.toFixed(d).replace('.',','); }
function f2(n){ return Math.round((n+Number.EPSILON)*100)/100; }

const DRIFT=4.0, VAB_HPD=12.25, UPCT=0.0165, UMAX=701, UMIN=255;
const O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94, SY=2024, EY=2036;
const PBB=59200, SGI_TAK_PARENTAL=10*PBB, SGI_TAK_VAB=7.5*PBB, FK_SKATT=0.30;
const MONTHS = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];

function calcUnion(s){ let f=Math.round(s*UPCT); if(f<UMIN) return UMIN; if(f>UMAX) return UMAX; return f; }
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function getMondayOfISOWeek(w, year) {
  const jan1 = new Date(year, 0, 1); const dayOfWeek = jan1.getDay();
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek));
  const monday = new Date(firstMonday); monday.setDate(monday.getDate() + (w - 1) * 7); return monday;
}

const sickDetailMap = new Map();
window.isLoadingProfile = false;
let obManuallyEdited = false;

document.addEventListener('DOMContentLoaded', function() {

function toggleSettings() {
  const c = document.getElementById('settingsContent');
  const a = document.getElementById('settingsArrow');
  if (c) { c.classList.toggle('open'); if (a) a.textContent = c.classList.contains('open') ? '▲' : '▼'; }
}
function toggleVAB(){ let c=document.getElementById('vabContent'), a=document.getElementById('vabArrow'); c.classList.toggle('open'); a.innerText=c.classList.contains('open')?'▲':'▼'; }
function toggleOB(){ let c=document.getElementById('obContent'), a=document.getElementById('obArrow'); c.classList.toggle('open'); a.innerText=c.classList.contains('open')?'▲':'▼'; }
function toggleOverview(){ let c=document.getElementById('overviewContent'); c.style.display = c.style.display==='none'?'block':'none'; }
function toggleYearSummary(){ let d=document.getElementById('yearDetails'), a=document.getElementById('yearArrow'); if(d.style.display==='none'){ d.style.display='block'; a.innerText='▲'; updateYearSummary(); } else { d.style.display='none'; a.innerText='▼'; } }
function toggleTheme() {
  const checkbox = document.getElementById('themeToggleCheckbox');
  const isDark = checkbox.checked;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function applyIndustrialVacation(year, lag) {
  if (!['A','B','C','D','E'].includes(lag)) return;
  for (let w = 28; w <= 31; w++) {
    const monday = getMondayOfISOWeek(w, year);
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday); date.setDate(monday.getDate() + d);
      const key = date.toISOString().split('T')[0];
      if (vacationOverrideMap.has(key)) continue;
      if (!fromvaroMap.has(key)) {
        const shift = getOrdinaryShift(date, lag);
        if (shift > 0) fromvaroMap.set(key, 1);
      }
    }
  }
}

function countVacationDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate(); let cnt = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (fromvaroMap.get(date.toISOString().split('T')[0]) === 1) cnt++;
  }
  return cnt;
}
function countVABDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate(); let cnt = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (fromvaroMap.get(date.toISOString().split('T')[0]) === 2) cnt++;
  }
  return cnt;
}
function countParentalDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate(); let cnt = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (fromvaroMap.get(date.toISOString().split('T')[0]) === 3) cnt++;
  }
  return cnt;
}

// ---- FÖRÄLDRALEDIGHET (5-dagarsregel) ----
function calcParentalDeduction(year, month, lag, baseSalary, sickRate100) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const flDatesInMonth = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const key = date.toISOString().split('T')[0];
    if (fromvaroMap.get(key) === 3) {
      flDatesInMonth.push(date);
    }
  }
  if (flDatesInMonth.length === 0) return 0;

  flDatesInMonth.sort((a, b) => a - b);

  function isWorkDay(d) {
    const shift = getOrdinaryShift(d, lag);
    return shift > 0 && !isPermissionDay(d, lag);
  }

  const processed = new Set();
  let totalDeduction = 0;

  for (const startDate of flDatesInMonth) {
    const startKey = startDate.toISOString().split('T')[0];
    if (processed.has(startKey)) continue;

    // Expandera bakåt
    let periodStart = new Date(startDate);
    while (true) {
      const prev = new Date(periodStart);
      prev.setDate(prev.getDate() - 1);
      const prevKey = prev.toISOString().split('T')[0];
      if (fromvaroMap.get(prevKey) === 3) {
        periodStart = prev;
        continue;
      }
      if (isWorkDay(prev)) break;   // arbetsdag utan FL → stopp
      periodStart = prev;           // ledig dag eller permission → utöka
    }

    // Expandera framåt
    let periodEnd = new Date(startDate);
    while (true) {
      const next = new Date(periodEnd);
      next.setDate(next.getDate() + 1);
      const nextKey = next.toISOString().split('T')[0];
      if (fromvaroMap.get(nextKey) === 3) {
        periodEnd = next;
        continue;
      }
      if (isWorkDay(next)) break;
      periodEnd = next;
    }

    // Räkna arbetsdagar i HELA perioden (alla schemalagda pass räknas)
    let workDays = 0;
    const d = new Date(periodStart);
    while (d <= periodEnd) {
      if (isWorkDay(d)) workDays++;
      d.setDate(d.getDate() + 1);
    }

    // Överlapp med aktuell månad
    const monthFirst = new Date(year, month - 1, 1);
    const monthLast = new Date(year, month, 0);
    const overlapStart = new Date(Math.max(periodStart.getTime(), monthFirst.getTime()));
    const overlapEnd   = new Date(Math.min(periodEnd.getTime(), monthLast.getTime()));

    if (workDays > 5) {
      const daysInOverlap = Math.round((overlapEnd - overlapStart) / 86400000) + 1;
      totalDeduction += (baseSalary / 30) * daysInOverlap;
    } else {
      const d2 = new Date(overlapStart);
      while (d2 <= overlapEnd) {
        if (isWorkDay(d2)) {
          totalDeduction += sickRate100 * VAB_HPD;
        }
        d2.setDate(d2.getDate() + 1);
      }
    }

    const mark = new Date(periodStart);
    while (mark <= periodEnd) {
      processed.add(mark.toISOString().split('T')[0]);
      mark.setDate(mark.getDate() + 1);
    }
  }

  return f2(totalDeduction);
}

// ----- SJUKAVDRAG OCH SJUK-OB -----
function calcSickDeduction(year, month, lag, baseSalary, sickRate100, sickRate80, ob1r, ob2r, ob3r) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const sickDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const key = date.toISOString().split('T')[0];
    if (fromvaroMap.get(key) === 4) {
      const shift = getShift(date, lag);
      if (shift === 0 || isPermissionDay(date, lag)) continue;
      const detail = sickDetailMap.get(key) || {type:'full'};
      const hoursMissed = detail.type === 'partial' ? (detail.hoursMissed || 0) : 12.25;
      sickDays.push({date, shift, hoursMissed, isFull: detail.type !== 'partial'});
    }
  }

  if (sickDays.length === 0) {
    localStorage.removeItem('sickPrevEnd');
    localStorage.removeItem('sickPrevYear');
    localStorage.removeItem('sickPrevMonth');
    return { deduction:0, compensation:0, sickOBGain:0, karensDeduction:0, sickDeduct100:0, sickPay80:0,
             sickOB1Hours:0, sickOB2Hours:0, sickOB3Hours:0, sickOB1Amount:0, sickOB2Amount:0, sickOB3Amount:0 };
  }

  sickDays.sort((a,b) => a.date - b.date);
  const periods = []; let start = sickDays[0].date, end = sickDays[0].date;
  for (let i = 1; i < sickDays.length; i++) {
    const prev = new Date(end); prev.setDate(prev.getDate() + 1);
    if (sickDays[i].date.getTime() === prev.getTime()) end = sickDays[i].date;
    else { periods.push({start: new Date(start), end: new Date(end)}); start = sickDays[i].date; end = sickDays[i].date; }
  }
  periods.push({start: new Date(start), end: new Date(end)});

  let prevEnd = null;
  const prevYear = parseInt(localStorage.getItem('sickPrevYear'));
  const prevMonth = parseInt(localStorage.getItem('sickPrevMonth'));
  if (prevYear && prevMonth) {
    let expectedPrevYear = year, expectedPrevMonth = month - 1;
    if (expectedPrevMonth === 0) { expectedPrevMonth = 12; expectedPrevYear--; }
    if (prevYear === expectedPrevYear && prevMonth === expectedPrevMonth) {
      const prevEndStr = localStorage.getItem('sickPrevEnd');
      if (prevEndStr) prevEnd = new Date(prevEndStr);
    }
  }

  let totalKarensHours = 0, totalSickHours = 0;
  let finalOB1 = 0, finalOB2 = 0, finalOB3 = 0;

  for (const period of periods) {
    const periodSickDays = sickDays.filter(d => d.date >= period.start && d.date <= period.end);
    const periodHours = periodSickDays.reduce((sum, d) => sum + d.hoursMissed, 0);

    let aterinsjuknande = false;
    if (prevEnd) {
      const daysSince = daysBetween(prevEnd, period.start);
      aterinsjuknande = (daysSince <= 5);
    }

    let karensHours = 0;
    if (!aterinsjuknande) {
      karensHours = Math.min(6.8, periodHours);
      totalKarensHours += karensHours;
      totalSickHours += (periodHours - karensHours);
    } else {
      totalSickHours += periodHours;
    }

    let rawOB1 = 0, rawOB2 = 0, rawOB3 = 0;
    for (const day of periodSickDays) {
      const ob = calcOB(day.date, day.shift, lag);
      rawOB1 += ob.ob1;
      rawOB2 += ob.ob2;
      rawOB3 += ob.ob3;
    }

    const firstDay = periodSickDays[0];

    if (firstDay && firstDay.isFull && karensHours > 0) {
      let deductionRemaining = 6.0;
      let ob1 = rawOB1, ob2 = rawOB2, ob3 = rawOB3;
      if (ob1 > 0) { let d = Math.min(deductionRemaining, ob1); ob1 -= d; deductionRemaining -= d; }
      else if (ob2 > 0) { let d = Math.min(deductionRemaining, ob2); ob2 -= d; deductionRemaining -= d; }
      else if (ob3 > 0) { let d = Math.min(deductionRemaining, ob3); ob3 -= d; deductionRemaining -= d; }
      finalOB1 += ob1; finalOB2 += ob2; finalOB3 += ob3;
    } else {
      let rem = karensHours;
      let ob1 = rawOB1, ob2 = rawOB2, ob3 = rawOB3;
      if (rem > 0) { let d = Math.min(rem, ob1); ob1 -= d; rem -= d; }
      if (rem > 0) { let d = Math.min(rem, ob2); ob2 -= d; rem -= d; }
      if (rem > 0) { let d = Math.min(rem, ob3); ob3 -= d; rem -= d; }
      finalOB1 += ob1; finalOB2 += ob2; finalOB3 += ob3;
    }

    prevEnd = new Date(period.end);
  }

  if (periods.length > 0) {
    localStorage.setItem('sickPrevEnd', periods[periods.length-1].end.toISOString().split('T')[0]);
    localStorage.setItem('sickPrevYear', year);
    localStorage.setItem('sickPrevMonth', month);
  } else {
    localStorage.removeItem('sickPrevEnd');
    localStorage.removeItem('sickPrevYear');
    localStorage.removeItem('sickPrevMonth');
  }

  const sickOB1Amount = f2(finalOB1 * f2(ob1r) * 0.8);
  const sickOB2Amount = f2(finalOB2 * f2(ob2r) * 0.8);
  const sickOB3Amount = f2(finalOB3 * f2(ob3r) * 0.8);
  const totalSickOBGain = f2(sickOB1Amount + sickOB2Amount + sickOB3Amount);

  const karensDeduction = f2(totalKarensHours * sickRate100);
  const sickDeduct100 = f2(totalSickHours * sickRate100);
  const sickPay80 = f2(totalSickHours * sickRate80);
  const sickNetLoss = f2(sickDeduct100 - sickPay80);
  const totalSickLoss = f2(karensDeduction + sickNetLoss);
  return {
    deduction: totalSickLoss, compensation: sickPay80, sickOBGain: totalSickOBGain,
    karensDeduction, sickDeduct100, sickPay80,
    sickOB1Hours: finalOB1, sickOB2Hours: finalOB2, sickOB3Hours: finalOB3,
    sickOB1Amount, sickOB2Amount, sickOB3Amount
  };
}
// ---------------------------------------------------------

function setFromvaro(dateStr, value){
  if (value === "Sjuk") { openSickPopup(dateStr); return; }
  const date = new Date(dateStr); const week = getWeekNumber(date);
  if (week >= 28 && week <= 31) vacationOverrideMap.set(dateStr, true);
  if(value==="") fromvaroMap.delete(dateStr);
  else if(value==="Semester") fromvaroMap.set(dateStr,1);
  else if(value==="VAB") fromvaroMap.set(dateStr,2);
  else if(value==="F-ledig") fromvaroMap.set(dateStr,3);
  updateUI();
}
function resetSchema(){ fromvaroMap.clear(); vacationOverrideMap.clear(); sickDetailMap.clear(); updateUI(); }
function resetAllShifts(){ shiftOverrideMap.clear(); updateUI(); }
function changeShift(dateStr,val,lag){
  let nv = parseInt(val, 10); shiftOverrideMap.set(dateStr, nv);
  if(nv === 0) fromvaroMap.delete(dateStr); updateUI();
}

function openSickPopup(dateStr) {
  const overlay = document.getElementById('sickPopupOverlay');
  document.getElementById('sickPopupDate').textContent = 'Datum: ' + dateStr;
  overlay.style.display = 'flex';
  document.getElementById('sickPartialInput').style.display = 'none';
  document.getElementById('sickTimeInput').value = '';
  document.getElementById('sickFullDayBtn').onclick = function() {
    fromvaroMap.set(dateStr, 4); sickDetailMap.set(dateStr, {type:'full'});
    overlay.style.display = 'none'; updateUI();
  };
  document.getElementById('sickPartialBtn').onclick = function() {
    document.getElementById('sickPartialInput').style.display = 'block';
  };
  document.getElementById('sickPartialConfirm').onclick = function() {
    const time = document.getElementById('sickTimeInput').value;
    if (!time) return;
    const [h,m] = time.split(':').map(Number);
    const shift = getShift(new Date(dateStr), lagSelect.value);
    let hoursMissed = 0;
    if (shift === 1) { hoursMissed = 18 - h - m/60; }
    else if (shift === 2) { hoursMissed = h >= 18 ? 24 - h - m/60 + 6 : 6 - h - m/60; }
    hoursMissed = Math.min(Math.max(hoursMissed, 0), 12.25);
    fromvaroMap.set(dateStr, 4);
    sickDetailMap.set(dateStr, {type:'partial', hoursMissed: f2(hoursMissed)});
    overlay.style.display = 'none'; updateUI();
  };
  document.getElementById('sickCancelBtn').onclick = function() {
    fromvaroMap.delete(dateStr); sickDetailMap.delete(dateStr);
    overlay.style.display = 'none'; updateUI();
  };
}

// ---------- HUVUDBERÄKNING ----------
function calculateEverything() {
  const baseSalary = p(salaryInput.value) || 0;
  const selectedYear = parseInt(yearSelect.value);
  const selectedMonth = parseInt(monthSelect.value);
  const lag = lagSelect.value;
  const isAuto = (lag !== 'manual' && lag !== '');
  const ftpD = parseInt(ftpDays.value);
  const sgiVal = Math.min(p(sgiInput.value) || 0, SGI_TAK_PARENTAL);

  let obYear = selectedYear, obMonth = selectedMonth - 1;
  if (obMonth === 0) { obMonth = 12; obYear--; }
  const vabD = countVABDaysInMonth(obYear, obMonth);
  const parentalD = countParentalDaysInMonth(obYear, obMonth);
  const vacationCount = countVacationDaysInMonth(obYear, obMonth);

  const driftAddition = f2(baseSalary * DRIFT / 100);
  const obGroundingBase = f2(baseSalary + driftAddition);

  const ob1r = f2(obGroundingBase / O1D);
  const ob2r = f2(obGroundingBase / O2D);
  const ob3r = f2(obGroundingBase / O3D);
  const otRate = f2(obGroundingBase / OTD);
  const otEnkelRate = f2(obGroundingBase / OTENKELD);

  const sickRate100 = f2(baseSalary / (141 + 2/3));
  const sickRate80  = f2(baseSalary / (177 + 1/12));

  const semesterSupplementPerDay = f2(obGroundingBase / 125);
  const semesterTillagg = f2(vacationCount * semesterSupplementPerDay);

  const vabDeduction = f2(vabD * VAB_HPD * sickRate100);
  const parentalDeduction = calcParentalDeduction(obYear, obMonth, lag, baseSalary, sickRate100);
  const vabParentalDeduction = f2(vabDeduction + parentalDeduction);

  const sickResult = calcSickDeduction(obYear, obMonth, lag, baseSalary, sickRate100, sickRate80, ob1r, ob2r, ob3r);
  const totalSickLoss = sickResult.deduction;
  const sickOBGain = sickResult.sickOBGain;

  const sgiVab = Math.min(sgiVal, SGI_TAK_VAB);
  const sgiVabDay = f2(sgiVab / 365 * 0.8);
  const fkVabTotal = f2(vabD * sgiVabDay);
  const sgiPar = Math.min(sgiVal, SGI_TAK_PARENTAL);
  const fpDayAmt = f2(Math.min(1259, sgiPar / 365 * 0.776));
  const fkFpTotal = f2(parentalD * fpDayAmt);
  const fptDayAmt = f2(baseSalary / 30 * 0.10);
  const fkFptTotal = f2(ftpD * fptDayAmt);
  const fkVabTax = f2(fkVabTotal * FK_SKATT), fkFpTax = f2(fkFpTotal * FK_SKATT), fkFptTax = f2(fkFptTotal * FK_SKATT);
  const fkVabNet = f2(fkVabTotal - fkVabTax), fkFpNet = f2(fkFpTotal - fkFpTax), fkFptNet = f2(fkFptTotal - fkFptTax);
  const totalErsattningNetto = f2(fkVabNet + fkFpNet + fkFptNet);

  let autoOB = null;
  if (isAuto) { autoOB = getOBForMonth(obYear, obMonth, lag); }

  if (autoOB && lag !== 'manual') {
    const daysInMonth = new Date(obYear, obMonth, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(obYear, obMonth - 1, d);
      const key = date.toISOString().split('T')[0];
      if (fromvaroMap.get(key) === 4) {
        const shift = getShift(date, lag);
        if (shift > 0 && !isPermissionDay(date, lag)) {
          const ob = calcOB(date, shift, lag);
          autoOB.ob1 += ob.ob1;
          autoOB.ob2 += ob.ob2;
          autoOB.ob3 += ob.ob3;
        }
      }
    }
  }

  if (autoOB && !obManuallyEdited) {
    ob1Hours.value = fd(autoOB.ob1, 2);
    ob2Hours.value = fd(autoOB.ob2, 2);
    ob3Hours.value = fd(autoOB.ob3, 2);
  }

  let obData;
  if (autoOB && !obManuallyEdited) {
    obData = { ob1: autoOB.ob1, ob2: autoOB.ob2, ob3: autoOB.ob3 };
  } else {
    obData = { ob1: p(ob1Hours.value), ob2: p(ob2Hours.value), ob3: p(ob3Hours.value) };
  }

  const otH = p(otHours.value), otEnkelH = p(otEnkelHours.value);
  const extra = p(document.getElementById('extraInput')?.value || 0);
  const extraTax = p(document.getElementById('extraTaxInput')?.value || 0);
  const ob1Amt = f2(obData.ob1 * ob1r);
  const ob2Amt = f2(obData.ob2 * ob2r);
  const ob3Amt = f2(obData.ob3 * ob3r);
  const otAmt = f2(otH * otRate);
  const otEnkelAmt = f2(otEnkelH * otEnkelRate);
  const totalOBOnly = f2(ob1Amt + ob2Amt + ob3Amt);
  const totalOB = f2(totalOBOnly + otAmt + otEnkelAmt);

  const totalBeforeDeductions = f2(obGroundingBase + totalOB + semesterTillagg + extra);
  const jobbBruttoExact = f2(totalBeforeDeductions - totalSickLoss + sickOBGain - vabParentalDeduction);
  const jobbBrutto = Math.round(jobbBruttoExact);
  const taxExact = taxFromTable33Col1(jobbBruttoExact, selectedYear);
  const tax = f2(taxExact);
  const netSalaryExact = f2(jobbBruttoExact - taxExact - calcUnion(jobbBrutto) + totalErsattningNetto - extraTax);
  const netSalary = Math.round(netSalaryExact);
  return {
    baseSalary, selectedYear, selectedMonth, lag, isAuto,
    sickVisible: (totalSickLoss > 0 || sickOBGain > 0), extraSick: 0, totalVABParental: vabD + parentalD, vacationCount,
    driftAddition, obGroundingBase,
    ob1RatePerHour: ob1r, ob2RatePerHour: ob2r, ob3RatePerHour: ob3r,
    otRatePerHour: otRate, otEnkelRatePerHour: otEnkelRate,
    sickRate100, sickRate80,
    semesterSupplementPerDay, semesterTillagg,
    karensDeduction: sickResult.karensDeduction, sickDeduct100: sickResult.sickDeduct100, sickPay80: sickResult.sickPay80,
    vabParentalDeduction, totalErsattningNetto,
    obYear, obMonth, autoOB, obData, extra, extraTax,
    ob1Amount: ob1Amt, ob2Amount: ob2Amt, ob3Amount: ob3Amt, otAmount: otAmt, otEnkelAmount: otEnkelAmt,
    totalOBOnly, totalOBOnlyHours: obData.ob1 + obData.ob2 + obData.ob3, totalOB,
    totalSjukOBGain: sickOBGain,
    sickOB1Hours: sickResult.sickOB1Hours, sickOB2Hours: sickResult.sickOB2Hours, sickOB3Hours: sickResult.sickOB3Hours,
    sickOB1Amount: sickResult.sickOB1Amount, sickOB2Amount: sickResult.sickOB2Amount, sickOB3Amount: sickResult.sickOB3Amount,
    jobbBrutto, jobbBruttoExact, tax, netBeforeFack: f2(jobbBrutto - tax),
    unionFee: calcUnion(jobbBrutto), jobbNetto: f2(jobbBrutto - tax - calcUnion(jobbBrutto)),
    netSalary, netSalaryExact, utjämning: f2(netSalary - netSalaryExact)
  };
}

function renderUI(data) {
  const lagName = {A:'Lag A',B:'Lag B',C:'Lag C',D:'Lag D',E:'Lag E'}[data.lag] || 'Manuell';
  vabSummary.style.display = data.totalVABParental > 0 ? 'flex' : 'none';
  obGroundingDisplay.innerText = fc(data.obGroundingBase) + ' kr';
  ob1Rate.innerText = '/460 = ' + fd(data.ob1RatePerHour,2) + ' kr/h';
  ob2Rate.innerText = '/260 = ' + fd(data.ob2RatePerHour,2) + ' kr/h';
  ob3Rate.innerText = '/150 = ' + fd(data.ob3RatePerHour,2) + ' kr/h';
  otRate.innerText = '/72 = ' + fd(data.otRatePerHour,2) + ' kr/h';
  otEnkelRate.innerText = '/94 = ' + fd(data.otEnkelRatePerHour,2) + ' kr/h';
  selectedPeriod.innerText = MONTHS[data.selectedMonth-1] + ' ' + data.selectedYear + ' · ' + lagName;
  tableMonthLabel.innerText = data.isAuto ? MONTHS[data.obMonth-1] + ' ' + data.obYear : '—';
  finalNetSalary.innerText = fc(data.netSalary) + ' kr';
  overviewTotalNet.innerText = fc(data.netSalary) + ' kr';

  const chips = [];

  chips.push({ type:'neutral', html: `<div class="detail-chip"><span>Grundlön + Driftformstillägg</span><span>${fc(data.obGroundingBase)} kr</span></div>` });

  if (data.totalOBOnlyHours > 0) {
    const obOTHTML = `<div class="expandable-chip" onclick="toggleExpand(this)">
      <div class="expandable-header"><span>Totalt OB</span><span>${fd(data.totalOBOnlyHours,2)}h / +${fd(data.totalOBOnly,2)} kr <span class="expandable-arrow">▼</span></span></div>
      <div class="expandable-details">
        <div class="tax-detail-row">OB1 (${fd(data.obData.ob1,2)}h x ${fd(data.ob1RatePerHour,2)} kr): +${fd(data.ob1Amount,2)} kr</div>
        <div class="tax-detail-row">OB2 (${fd(data.obData.ob2,2)}h x ${fd(data.ob2RatePerHour,2)} kr): +${fd(data.ob2Amount,2)} kr</div>
        <div class="tax-detail-row">OB3 (${fd(data.obData.ob3,2)}h x ${fd(data.ob3RatePerHour,2)} kr): +${fd(data.ob3Amount,2)} kr</div>
        <div class="tax-detail-row total">Summa OB: ${fd(data.totalOBOnlyHours,2)}h / +${fd(data.totalOBOnly,2)} kr</div>
      </div></div>`;
    chips.push({ type:'success', html: obOTHTML });
  }
  if (data.otAmount > 0) {
    chips.push({ type:'success', html: `<div class="detail-chip"><span>Övertid (${fd(p(otHours.value),2)}h x ${fd(data.otRatePerHour,2)} kr)</span><span>+${fd(data.otAmount,2)} kr</span></div>` });
  }
  if (data.otEnkelAmount > 0) {
    chips.push({ type:'success', html: `<div class="detail-chip"><span>ÖT enkel (${fd(p(otEnkelHours.value),2)}h x ${fd(data.otEnkelRatePerHour,2)} kr)</span><span>+${fd(data.otEnkelAmount,2)} kr</span></div>` });
  }

  if (data.vacationCount > 0) {
    const semesterMonthName = data.isAuto ? MONTHS[data.obMonth-1] + ' ' + data.obYear : '';
    const semHTML = `<div class="detail-chip info"><span>Semestertillägg (${data.vacationCount} dgr, ${fd(data.semesterSupplementPerDay,2)} kr/d)</span><span>+${fd(data.semesterTillagg,2)} kr (intjänad ${semesterMonthName})</span></div>`;
    chips.push({ type:'info', html: semHTML });
  }

  if (data.karensDeduction > 0) {
    chips.push({ type:'danger', html: `<div class="detail-chip danger"><span>Karensavdrag</span><span>-${fd(data.karensDeduction,2)} kr</span></div>` });
  }

  if (data.sickDeduct100 > 0) {
    chips.push({ type:'danger', html: `<div class="detail-chip danger"><span>Sjukavdrag 100%</span><span>-${fd(data.sickDeduct100,2)} kr</span></div>` });
    chips.push({ type:'success', html: `<div class="detail-chip success"><span>Sjukersättning 80%</span><span>+${fd(data.sickPay80,2)} kr</span></div>` });
  }

  if (data.totalSjukOBGain > 0) {
    const totalSickOBHours = data.sickOB1Hours + data.sickOB2Hours + data.sickOB3Hours;
    let sickDetails = '';
    if (data.sickOB1Hours > 0) sickDetails += `<div class="tax-detail-row">OB1 (${fd(data.sickOB1Hours,2)}h x ${fd(data.ob1RatePerHour,2)} kr): +${fd(data.sickOB1Amount,2)} kr</div>`;
    if (data.sickOB2Hours > 0) sickDetails += `<div class="

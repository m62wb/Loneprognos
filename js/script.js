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

document.addEventListener('DOMContentLoaded', function() {

function applyIndustrialVacation(year, lag) { /* ... oförändrad ... */ }
function countVacationDaysInMonth(year, month) { /* ... oförändrad ... */ }
function countVABDaysInMonth(year, month) { /* ... oförändrad ... */ }
function countParentalDaysInMonth(year, month) { /* ... oförändrad ... */ }
function calcParentalDeduction(year, month, lag, baseSalary, sickRate100) { /* ... oförändrad ... */ }

// ----- SJUKAVDRAG OCH SJUK-OB (MINUTMODELL FÖR KARENSAVDRAG PÅ OB) -----
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
      sickDays.push({date, shift, hoursMissed});
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

  let totalKarensHours = 0, totalSickHours = 0, totalSickOBGain = 0;
  // Samla först OB-timmarna per period, opåverkade av karensen
  let rawOB1 = 0, rawOB2 = 0, rawOB3 = 0;
  let aterinsjuknande = false;
  let karensPeriods = 0;

  for (const period of periods) {
    if (prevEnd) {
      const daysSince = daysBetween(prevEnd, period.start);
      aterinsjuknande = (daysSince <= 5);
    } else {
      aterinsjuknande = false;
    }

    let periodHours = 0;
    for (const day of sickDays) {
      if (day.date >= period.start && day.date <= period.end) {
        periodHours += day.hoursMissed;
        const ob = calcOB(day.date, day.shift, lag);
        rawOB1 += ob.ob1;
        rawOB2 += ob.ob2;
        rawOB3 += ob.ob3;
      }
    }
    totalSickHours += periodHours;
    if (!aterinsjuknande) {
      totalKarensHours += Math.min(6.8, periodHours);
      totalSickHours -= Math.min(6.8, periodHours);
      karensPeriods++;
    }
    prevEnd = new Date(period.end);
  }

  // ---- Karensen äter OB-timmarna minut för minut ----
  let remainingKarens = totalKarensHours; // så många OB-timmar ska försvinna
  let ob1AfterKarens = rawOB1;
  let ob2AfterKarens = rawOB2;
  let ob3AfterKarens = rawOB3;

  // Dra från OB1 först
  if (remainingKarens > 0 && ob1AfterKarens > 0) {
    const deduct = Math.min(remainingKarens, ob1AfterKarens);
    ob1AfterKarens -= deduct;
    remainingKarens -= deduct;
  }
  // Sedan OB2
  if (remainingKarens > 0 && ob2AfterKarens > 0) {
    const deduct = Math.min(remainingKarens, ob2AfterKarens);
    ob2AfterKarens -= deduct;
    remainingKarens -= deduct;
  }
  // Sist OB3 (ifall)
  if (remainingKarens > 0 && ob3AfterKarens > 0) {
    const deduct = Math.min(remainingKarens, ob3AfterKarens);
    ob3AfterKarens -= deduct;
    remainingKarens -= deduct;
  }

  // Beräkna sjuk-OB på de återstående OB-timmarna
  const sickOB1Amount = f2(ob1AfterKarens * f2(ob1r) * 0.8);
  const sickOB2Amount = f2(ob2AfterKarens * f2(ob2r) * 0.8);
  const sickOB3Amount = f2(ob3AfterKarens * f2(ob3r) * 0.8);
  totalSickOBGain = f2(sickOB1Amount + sickOB2Amount + sickOB3Amount);

  localStorage.setItem('sickPrevEnd', periods[periods.length-1].end.toISOString().split('T')[0]);
  localStorage.setItem('sickPrevYear', year);
  localStorage.setItem('sickPrevMonth', month);

  const karensDeduction = f2(totalKarensHours * sickRate100);
  const sickDeduct100 = f2(totalSickHours * sickRate100);
  const sickPay80 = f2(totalSickHours * sickRate80);
  const sickNetLoss = f2(sickDeduct100 - sickPay80);
  const totalSickLoss = f2(karensDeduction + sickNetLoss);
  return {
    deduction: totalSickLoss, compensation: sickPay80, sickOBGain: totalSickOBGain,
    karensDeduction, sickDeduct100, sickPay80,
    sickOB1Hours: ob1AfterKarens, sickOB2Hours: ob2AfterKarens, sickOB3Hours: ob3AfterKarens,
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

function openSickPopup(dateStr) { /* ... oförändrad ... */ }

let lastAutoOB={ob1:0,ob2:0,ob3:0}, lastAutoLag='', lastAutoYear=0, lastAutoMonth=0;

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
  const sickOB1Hours = sickResult.sickOB1Hours;
  const sickOB2Hours = sickResult.sickOB2Hours;
  const sickOB3Hours = sickResult.sickOB3Hours;
  const sickOB1Amount = sickResult.sickOB1Amount;
  const sickOB2Amount = sickResult.sickOB2Amount;
  const sickOB3Amount = sickResult.sickOB3Amount;

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

  if (autoOB) {
    ob1Hours.value = fd(autoOB.ob1, 2);
    ob2Hours.value = fd(autoOB.ob2, 2);
    ob3Hours.value = fd(autoOB.ob3, 2);
  }

  if (isAuto && (lag !== lastAutoLag || obYear !== lastAutoYear || obMonth !== lastAutoMonth)) manualOBOverride = false;
  lastAutoLag = lag; lastAutoYear = obYear; lastAutoMonth = obMonth;
  if (!isAuto) manualOBOverride = false;

  const lockEnabled = obLockToggle.checked;
  let obData;
  if (isAuto && lockEnabled && !manualOBOverride) {
    obData = { ob1: Math.round(p(ob1Hours.value)), ob2: Math.round(p(ob2Hours.value)), ob3: Math.round(p(ob3Hours.value)) };
  } else if (isAuto && lockEnabled && manualOBOverride) {
    obData = { ob1: p(ob1Hours.value), ob2: p(ob2Hours.value), ob3: p(ob3Hours.value) };
  } else {
    if (isAuto && !lockEnabled) {
      const c1 = p(ob1Hours.value), c2 = p(ob2Hours.value), c3 = p(ob3Hours.value);
      if (Math.abs(c1 - lastAutoOB.ob1) > 0.001 || Math.abs(c2 - lastAutoOB.ob2) > 0.001 || Math.abs(c3 - lastAutoOB.ob3) > 0.001) manualOBOverride = true;
      obData = { ob1: p(ob1Hours.value), ob2: p(ob2Hours.value), ob3: p(ob3Hours.value) };
    } else { obData = { ob1: p(ob1Hours.value), ob2: p(ob2Hours.value), ob3: p(ob3Hours.value) }; }
  }

  const otH = p(otHours.value), otEnkelH = p(otEnkelHours.value);
  const ob1Amt = f2(obData.ob1 * ob1r);
  const ob2Amt = f2(obData.ob2 * ob2r);
  const ob3Amt = f2(obData.ob3 * ob3r);
  const otAmt = f2(otH * otRate);
  const otEnkelAmt = f2(otEnkelH * otEnkelRate);
  const totalOBOnly = f2(ob1Amt + ob2Amt + ob3Amt);
  const totalOB = f2(totalOBOnly + otAmt + otEnkelAmt);

  const totalBeforeDeductions = f2(obGroundingBase + totalOB + semesterTillagg);
  const jobbBruttoExact = f2(totalBeforeDeductions - totalSickLoss + sickOBGain - vabParentalDeduction);
  const jobbBrutto = Math.round(jobbBruttoExact);
  const taxExact = taxFromTable33Col1(jobbBruttoExact, selectedYear);
  const tax = f2(taxExact);
  const netSalaryExact = f2(jobbBruttoExact - taxExact - calcUnion(jobbBrutto) + totalErsattningNetto);
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
    obYear, obMonth, lockEnabled, obData, autoOB,
    ob1Amount: ob1Amt, ob2Amount: ob2Amt, ob3Amount: ob3Amt, otAmount: otAmt, otEnkelAmount: otEnkelAmt,
    totalOBOnly, totalOBOnlyHours: obData.ob1 + obData.ob2 + obData.ob3, totalOB,
    totalSjukOBGain: sickOBGain,
    sickOB1Hours, sickOB2Hours, sickOB3Hours, sickOB1Amount, sickOB2Amount, sickOB3Amount,
    jobbBrutto, jobbBruttoExact, tax, netBeforeFack: f2(jobbBrutto - tax),
    unionFee: calcUnion(jobbBrutto), jobbNetto: f2(jobbBrutto - tax - calcUnion(jobbBrutto)),
    netSalary, netSalaryExact, utjämning: f2(netSalary - netSalaryExact)
  };
}

// ... resten av renderUI och övriga funktioner är oförändrade

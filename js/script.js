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

// ----- ALLA FUNKTIONER SOM HTML ANROPAR MÅSTE VARA GLOBALA -----
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
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {

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

function calcParentalDeduction(year, month, lag, baseSalary, sickRate100) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const key = date.toISOString().split('T')[0];
    const isFL = (fromvaroMap.get(key) === 3);
    const shift = getOrdinaryShift(date, lag);
    const isWork = (shift > 0 && !isPermissionDay(date, lag));
    allDates.push({ date, isFL, isWork });
  }
  const periods = []; let currentStart = null;
  for (let i = 0; i < allDates.length; i++) {
    const day = allDates[i];
    if (day.isFL) {
      if (currentStart === null) currentStart = day.date;
    } else if (!day.isWork && currentStart !== null) {
      continue;
    } else {
      if (currentStart !== null) {
        periods.push({ start: new Date(currentStart), end: new Date(allDates[i-1].date) });
        currentStart = null;
      }
    }
  }
  if (currentStart !== null) periods.push({ start: new Date(currentStart), end: new Date(allDates[allDates.length-1].date) });
  if (periods.length === 0) return 0;
  let totalDeduction = 0;
  for (const period of periods) {
    let workDays = 0; const d = new Date(period.start);
    while (d <= period.end) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const shift = getOrdinaryShift(d, lag);
        if (shift > 0 && !isPermissionDay(d, lag)) workDays++;
      }
      d.setDate(d.getDate() + 1);
    }
    const calDays = Math.round((period.end - period.start) / 86400000) + 1;
    totalDeduction += workDays > 5 ? (baseSalary / 30) * calDays : sickRate100 * (workDays * VAB_HPD);
  }
  return f2(totalDeduction);
}

function calcSickDeduction(year, month, lag, baseSalary, sickRate100, sickRate80, ob1r, ob2r, ob3r) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const sickDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d); const key = date.toISOString().split('T')[0];
    if (fromvaroMap.get(key) === 4) {
      const detail = sickDetailMap.get(key) || {type:'full'};
      const hoursMissed = detail.type === 'partial' ? (detail.hoursMissed || 0) : 12.25;
      sickDays.push({date, shift: getShift(date, lag), hoursMissed});
    }
  }
  if (sickDays.length === 0) return { deduction:0, compensation:0, sickOBGain:0, karensDeduction:0, sickDeduct100:0, sickPay80:0 };
  sickDays.sort((a,b) => a.date - b.date);
  const periods = []; let start = sickDays[0].date, end = sickDays[0].date;
  for (let i = 1; i < sickDays.length; i++) {
    const prev = new Date(end); prev.setDate(prev.getDate() + 1);
    if (sickDays[i].date.getTime() === prev.getTime()) end = sickDays[i].date;
    else { periods.push({start: new Date(start), end: new Date(end)}); start = sickDays[i].date; end = sickDays[i].date; }
  }
  periods.push({start: new Date(start), end: new Date(end)});
  const aterinsjuknande = document.getElementById('aterinsjuknandeCheck').checked;
  let totalKarensHours = 0, totalSickHours = 0, totalSickOBGain = 0;
  for (const period of periods) {
    let periodHours = 0, periodSickOB = 0;
    for (const day of sickDays) {
      if (day.date >= period.start && day.date <= period.end) {
        periodHours += day.hoursMissed;
        const ob = calcOB(day.date, day.shift, lag);
        const totalOBHours = ob.ob1 + ob.ob2 + ob.ob3;
        if (totalOBHours > 0) {
          const fraction = day.hoursMissed / 12.25;
          const obAmount = ob.ob1 * ob1r + ob.ob2 * ob2r + ob.ob3 * ob3r;
          periodSickOB += obAmount * fraction * 0.8;
        }
      }
    }
    totalSickHours += periodHours;
    if (!aterinsjuknande) {
      totalKarensHours += Math.min(6.8, periodHours);
      totalSickHours -= Math.min(6.8, periodHours);
    }
    totalSickOBGain += periodSickOB;
  }
  const karensDeduction = f2(totalKarensHours * sickRate100);
  const sickDeduct100 = f2(totalSickHours * sickRate100);
  const sickPay80 = f2(totalSickHours * sickRate80);
  const sickNetLoss = f2(sickDeduct100 - sickPay80);
  const totalSickLoss = f2(karensDeduction + sickNetLoss);
  return { deduction: totalSickLoss, compensation: sickPay80, sickOBGain: f2(totalSickOBGain), karensDeduction, sickDeduct100, sickPay80 };
}

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
  const ob1r = obGroundingBase / O1D, ob2r = obGroundingBase / O2D, ob3r = obGroundingBase / O3D;
  const ob1Rate = f2(ob1r), ob2Rate = f2(ob2r), ob3Rate = f2(ob3r);
  const sickRate100 = f2(baseSalary / (141 + 2/3)), sickRate80 = f2(baseSalary / (177 + 1/12));

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
  if (autoOB) { ob1Hours.value = fd(autoOB.ob1,2); ob2Hours.value = fd(autoOB.ob2,2); ob3Hours.value = fd(autoOB.ob3,2); }
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
  const ob1Amt = f2(obData.ob1 * ob1r), ob2Amt = f2(obData.ob2 * ob2r), ob3Amt = f2(obData.ob3 * ob3r);
  const otAmt = f2(otH * (obGroundingBase / OTD)), otEnkelAmt = f2(otEnkelH * (obGroundingBase / OTENKELD));
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
    ob1RatePerHour: ob1Rate, ob2RatePerHour: ob2Rate, ob3RatePerHour: ob3Rate,
    otRatePerHour: f2(obGroundingBase / OTD), otEnkelRatePerHour: f2(obGroundingBase / OTENKELD),
    sickRate100, sickRate80,
    semesterSupplementPerDay, semesterTillagg,
    karensDeduction: sickResult.karensDeduction, sickDeduct100: sickResult.sickDeduct100, sickPay80: sickResult.sickPay80,
    vabParentalDeduction, totalErsattningNetto,
    obYear, obMonth, lockEnabled, obData, autoOB,
    ob1Amount: ob1Amt, ob2Amount: ob2Amt, ob3Amount: ob3Amt, otAmount: otAmt, otEnkelAmount: otEnkelAmt,
    totalOBOnly, totalOBOnlyHours: obData.ob1 + obData.ob2 + obData.ob3, totalOB,
    totalSjukOBGain: sickOBGain,
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
  lockLabel.innerText = data.lockEnabled ? 'Låst' : 'Lås';
  ob1Hours.disabled = data.lockEnabled; ob2Hours.disabled = data.lockEnabled; ob3Hours.disabled = data.lockEnabled;
  if (data.isAuto && data.lockEnabled && !manualOBOverride && data.autoOB) {
    ob1Hours.value = fd(data.autoOB.ob1,2); ob2Hours.value = fd(data.autoOB.ob2,2); ob3Hours.value = fd(data.autoOB.ob3,2);
  }
  selectedPeriod.innerText = MONTHS[data.selectedMonth-1] + ' ' + data.selectedYear + ' · ' + lagName;
  tableMonthLabel.innerText = data.isAuto ? MONTHS[data.obMonth-1] + ' ' + data.obYear : '—';
  finalNetSalary.innerText = fc(data.netSalary) + ' kr';
  overviewTotalNet.innerText = fc(data.netSalary) + ' kr';

  let obOTHTML = '';
  if (data.totalOBOnlyHours > 0) {
    obOTHTML = `<div class="expandable-chip" onclick="toggleExpand(this)">
      <div class="expandable-header"><span>Totalt OB</span><span>${fd(data.totalOBOnlyHours,2)}h / +${fd(data.totalOBOnly,2)} kr <span class="expandable-arrow">▼</span></span></div>
      <div class="expandable-details">
        <div class="tax-detail-row">OB1 (${fd(data.obData.ob1,2)}h x ${fd(data.ob1RatePerHour,2)} kr): +${fd(data.ob1Amount,2)} kr</div>
        <div class="tax-detail-row">OB2 (${fd(data.obData.ob2,2)}h x ${fd(data.ob2RatePerHour,2)} kr): +${fd(data.ob2Amount,2)} kr</div>
        <div class="tax-detail-row">OB3 (${fd(data.obData.ob3,2)}h x ${fd(data.ob3RatePerHour,2)} kr): +${fd(data.ob3Amount,2)} kr</div>
        <div class="tax-detail-row total">Summa OB: ${fd(data.totalOBOnlyHours,2)}h / +${fd(data.totalOBOnly,2)} kr</div>
      </div></div>`;
  }
  if (data.otAmount > 0) obOTHTML += `<div class="detail-chip"><span>Övertid (${fd(p(otHours.value),2)}h x ${fd(data.otRatePerHour,2)} kr)</span><span>+${fd(data.otAmount,2)} kr</span></div>`;
  if (data.otEnkelAmount > 0) obOTHTML += `<div class="detail-chip"><span>ÖT enkel (${fd(p(otEnkelHours.value),2)}h x ${fd(data.otEnkelRatePerHour,2)} kr)</span><span>+${fd(data.otEnkelAmount,2)} kr</span></div>`;

  let karensHTML = data.karensDeduction > 0 ? `<div class="detail-chip danger"><span>Karensavdrag</span><span>-${fd(data.karensDeduction,2)} kr</span></div>` : '';
  let extraSickHTML = '';
  if (data.sickDeduct100 > 0) {
    extraSickHTML = `<div class="detail-chip danger"><span>Sjukavdrag 100%</span><span>-${fd(data.sickDeduct100,2)} kr</span></div>
                     <div class="detail-chip success"><span>Sjukersättning 80%</span><span>+${fd(data.sickPay80,2)} kr</span></div>`;
  }
  let sjukObHTML = data.totalSjukOBGain > 0 ? `<div class="detail-chip success"><span>Sjuk-OB ersättning</span><span>+${fd(data.totalSjukOBGain,2)} kr</span></div>` : '';
  let vabHTML = data.totalVABParental > 0 ? `<div class="detail-chip danger"><span>VAB/F-ledig avdrag</span><span>-${fd(data.vabParentalDeduction,2)} kr</span></div>` : '';
  const semesterMonthName = data.isAuto ? MONTHS[data.obMonth-1] + ' ' + data.obYear : '';
  let semesterHTML = data.vacationCount > 0 ? `<div class="detail-chip info"><span>Semestertillägg (${data.vacationCount} dgr, ${fd(data.semesterSupplementPerDay,2)} kr/d)</span><span>+${fd(data.semesterTillagg,2)} kr (intjänad ${semesterMonthName})</span></div>` : '';
  let bidragHTML = (data.totalVABParental > 0 || ftpDays.value > 0) ? `<div class="detail-chip success"><span>FK/AFA netto</span><span>+${fd(data.totalErsattningNetto,2)} kr</span></div>` : '';

  detailGrid.innerHTML = 
    `<div class="detail-chip"><span>Grundlön</span><span>${fc(data.baseSalary)} kr</span></div>` +
    `<div class="detail-chip"><span>OB-grundande</span><span>${fc(data.obGroundingBase)} kr</span></div>` +
    obOTHTML + semesterHTML + karensHTML + extraSickHTML + sjukObHTML + vabHTML + bidragHTML +
    `<div class="detail-chip"><span>Bruttolön jobb</span><span>${fd(data.jobbBruttoExact,2)} kr</span></div>` +
    `<div class="detail-chip"><span>Skatt (tabell 33)</span><span>-${fc(data.tax)} kr</span></div>` +
    `<div class="detail-chip"><span>Nettolön före fack</span><span>${fc(data.netBeforeFack)} kr</span></div>` +
    `<div class="detail-chip"><span>IF Metall</span><span>-${fc(data.unionFee)} kr</span></div>` +
    `<div class="detail-chip"><span>Nettolön jobb</span><span>${fc(data.jobbNetto)} kr</span></div>` +
    (data.totalErsattningNetto > 0 ? `<div class="detail-chip success"><span>Nettolön bidrag</span><span>+${fc(data.totalErsattningNetto)} kr</span></div>` : '') +
    (Math.abs(data.utjämning) > 0.001 ? `<div class="detail-chip ${data.utjämning>0?'success':'danger'}"><span>Öresutjämning</span><span>${data.utjämning>0?'+':''}${fd(Math.abs(data.utjämning),2)} kr</span></div>` : '') +
    `<div class="detail-chip success"><strong>Totalt netto: ${fc(data.netSalary)} kr</strong></div>`;

  if (data.isAuto) {
    let daysInMonth = new Date(data.obYear, data.obMonth, 0).getDate();
    let shiftNames = ['Ledig', 'Dag', 'Natt'];
    let tbody = ''; let isBlueWeek = false; let lastShownWeek = null;
    for (let d = 1; d <= daysInMonth; d++) {
      let date = new Date(data.obYear, data.obMonth - 1, d);
      let dateStr = date.toISOString().split('T')[0];
      let fromvaroVal = fromvaroMap.get(dateStr) || 0;
      let shift = getShift(date, data.lag);
      let ob = calcOB(date, shift, data.lag);
      let isPerm = isPermissionDay(date, data.lag);
      if (fromvaroVal !== 0) ob = {ob1:0, ob2:0, ob3:0};
      let dayName = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör'][date.getDay()];
      let weekNum = getWeekNumber(date);
      let weekLabel = '';
      if (d === 1 || (date.getDay() === 1 && weekNum !== lastShownWeek)) {
        if (date.getDay() === 1 || d === 1) isBlueWeek = !isBlueWeek;
        weekLabel = ' v' + weekNum; lastShownWeek = weekNum;
      }
      let shiftText = isPerm ? 'Perm' : shiftNames[shift];
      if (shiftOverrideMap.has(dateStr) && !isPerm) shiftText += '*';
      let emoji = ''; let fromvaroText = '';
      if (fromvaroVal === 1) { fromvaroText = 'Semester'; emoji = '🏖️'; }
      else if (fromvaroVal === 2) { fromvaroText = 'VAB'; emoji = '👶'; }
      else if (fromvaroVal === 3) { fromvaroText = 'F-ledig'; emoji = '🍼'; }
      else if (fromvaroVal === 4) { fromvaroText = 'Sjuk'; emoji = '🤒'; }
      let station = (data.lag === 'E') ? getStationE(date, shift, data.lag) : '-';
      let rowClass = '';
      if (fromvaroVal === 0 && shift > 0 && !isPerm) { rowClass = (shift === 1) ? 'row-day' : 'row-night'; }
      else if (fromvaroVal === 1) rowClass = 'row-vacation';
      else if (fromvaroVal === 2) rowClass = 'row-vab';
      else if (fromvaroVal === 3) rowClass = 'row-parental';
      else if (fromvaroVal === 4) rowClass = 'row-sick';
      let fromvaroCell = shift !== 0 ? `<select class="fromvaro-select" onchange="setFromvaro('${dateStr}',this.value)" onclick="event.stopPropagation()">
        <option value="" ${fromvaroText===""?'selected':''}>Ingen</option>
        <option value="Semester" ${fromvaroText==="Semester"?'selected':''}>Sem</option>
        <option value="VAB" ${fromvaroText==="VAB"?'selected':''}>VAB</option>
        <option value="F-ledig" ${fromvaroText==="F-ledig"?'selected':''}>F-ledig</option>
        <option value="Sjuk" ${fromvaroText==="Sjuk"?'selected':''}>Sjuk</option>
      </select>` : '';
      let passSelect = `<select class="shift-select" onchange="changeShift('${dateStr}',this.value,'${data.lag}')" onclick="event.stopPropagation()">
        <option value="0" ${shift===0?'selected':''}>Led</option>
        <option value="1" ${shift===1?'selected':''}>Dag</option>
        <option value="2" ${shift===2?'selected':''}>Natt</option>
      </select>`;
      let weekCellClass = isBlueWeek ? 'blue-week-cell' : '';
      let dayCellContent = `${d} ${dayName}${weekLabel}`;
      if (emoji) dayCellContent += `<span class="day-emoji">${emoji}</span>`;
      tbody += `<tr class="${rowClass}"><td class="${weekCellClass}">${dayCellContent}</td><td>${shiftText}</td><td>${fd(ob.ob1,2)}h</td><td>${fd(ob.ob2,2)}h</td><td>${fd(ob.ob3,2)}h</td><td>${fromvaroCell}</td><td>${station}</td><td>${passSelect}</td></tr>`;
    }
    tableBody.innerHTML = tbody;
  } else { tableBody.innerHTML = '<tr><td colspan="8">Välj ett lag</td></tr>'; }
}

function autoSaveState() { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(getCurrentState())); }
function updateUI() {
  const data = calculateEverything(); renderUI(data); updateSettingsLabel();
  if (data.isAuto && data.lockEnabled && !manualOBOverride && data.autoOB) {
    ob1Hours.value = fd(data.autoOB.ob1,2); ob2Hours.value = fd(data.autoOB.ob2,2); ob3Hours.value = fd(data.autoOB.ob3,2);
  }
  closeSettingsBoxIfNeeded(); renderOBChart(); showMainIfValid(); autoSaveState();
}
function closeSettingsBoxIfNeeded() {
  const settingsContent = document.getElementById('settingsContent');
  const arrow = document.getElementById('settingsArrow');
  if (settingsContent && settingsContent.classList.contains('open') && lagSelect.value !== '') {
    settingsContent.classList.remove('open'); if (arrow) arrow.textContent = '▼';
  }
}
function resetOB() {
  const lag = lagSelect.value;
  if (lag !== 'manual' && lag !== '') {
    let y = parseInt(yearSelect.value), m = parseInt(monthSelect.value), om = m - 1;
    if (om === 0) { om = 12; y--; }
    const ob = getOBForMonth(y, om, lag);
    ob1Hours.value = fd(ob.ob1,2); ob2Hours.value = fd(ob.ob2,2); ob3Hours.value = fd(ob.ob3,2);
  } else { ob1Hours.value = '0'; ob2Hours.value = '0'; ob3Hours.value = '0'; }
  manualOBOverride = false; updateUI();
}
function toggleExpand(el){ el.querySelector('.expandable-details').classList.toggle('open'); el.querySelector('.expandable-arrow').classList.toggle('open'); }
function updateYearSummary() {
  const y = parseInt(yearSelect.value); const lag = lagSelect.value;
  if (lag === 'manual' || lag === '') { document.getElementById('yearSummaryGrid').innerHTML = 'Välj lag'; return; }
  document.getElementById('yearSummaryYear').innerText = y;
  const bs = p(salaryInput.value) || 0; const da = f2(bs * DRIFT / 100); const obBase = bs + da;
  const o1r = f2(obBase / O1D), o2r = f2(obBase / O2D), o3r = f2(obBase / O3D);
  let totBrutto = 0, totNetto = 0, totSkatt = 0, totFack = 0, totOB = 0, totSemester = 0;
  for (let m = 1; m <= 12; m++) {
    let obMonth = m - 1, obYear = y; if (obMonth === 0) { obMonth = 12; obYear--; }
    const obData = getOBForMonth(obYear, obMonth, lag);
    const mOB = f2(obData.ob1 * o1r + obData.ob2 * o2r + obData.ob3 * o3r); totOB += mOB;
    const vacDays = countVacationDaysInMonth(obYear, obMonth);
    const semTillagg = f2(vacDays * f2(obBase / 125)); totSemester += semTillagg;
    const jb = Math.round(obBase + mOB + semTillagg);
    const tax = taxFromTable33Col1(jb, y); const uf = calcUnion(jb); const net = jb - tax - uf;
    totBrutto += jb; totNetto += net; totSkatt += tax; totFack += uf;
  }
  document.getElementById('yearSummaryGrid').innerHTML =
    `<div>Total bruttolön: ${fc(totBrutto)} kr</div>` +
    `<div>Total nettolön: ${fc(totNetto)} kr</div>` +
    `<div>Total skatt: -${fc(totSkatt)} kr</div>` +
    `<div>Fackavgift: -${fc(totFack)} kr</div>` +
    `<div>Totalt OB: +${fc(totOB)} kr</div>` +
    `<div>Semestertillägg: +${fc(totSemester)} kr</div>`;
}
function updateSettingsLabel() {
  const profSelect = document.getElementById('profileSelect');
  const lagSelectEl = document.getElementById('lagSelect');
  const profName = (profSelect && profSelect.value) ? profSelect.value : '--';
  const lagName = lagSelectEl && lagSelectEl.selectedIndex >= 0 ? lagSelectEl.options[lagSelectEl.selectedIndex].text : 'Välj lag';
  const label = document.getElementById('settingsLabel');
  if (label) label.textContent = 'Profil: ' + profName + ' | Lag: ' + lagName;
}
function renderOBChart() {
  const lag = lagSelect.value; if (lag === 'manual' || lag === '') return;
  const year = parseInt(yearSelect.value);
  const bs = p(salaryInput.value) || 0; const da = f2(bs * DRIFT / 100); const obBase = bs + da;
  const o1r = f2(obBase / O1D), o2r = f2(obBase / O2D), o3r = f2(obBase / O3D);
  const labels = []; const data = [];
  for (let m = 1; m <= 12; m++) {
    const obData = getOBForMonth(year, m, lag);
    labels.push(MONTHS[m-1]); data.push(f2(obData.ob1 * o1r + obData.ob2 * o2r + obData.ob3 * o3r));
  }
  const ctx = document.getElementById('obChart'); if (!ctx) return;
  if (window.obChartInstance) window.obChartInstance.destroy();
  window.obChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'OB‑ersättning (kr)', data, backgroundColor: 'rgba(88,166,255,0.6)', borderColor: 'rgba(88,166,255,1)', borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: '#8b949e' } }, x: { ticks: { color: '#8b949e' } } }, plugins: { legend: { labels: { color: '#8b949e' } } } }
  });
}
function populateSelectors(){
  for(let y=SY;y<=EY;y++){ let o=document.createElement('option'); o.value=y; o.textContent=y; yearSelect.appendChild(o); }
  let now=new Date(); yearSelect.value=Math.max(SY,Math.min(EY,now.getFullYear()));
  MONTHS.forEach((m,i)=>{ let o=document.createElement('option'); o.value=i+1; o.textContent=m; monthSelect.appendChild(o); });
  monthSelect.value=now.getMonth()+1;
}

let lagSelect=document.getElementById('lagSelect'), salaryInput=document.getElementById('salaryInput'),
    yearSelect=document.getElementById('yearSelect'), monthSelect=document.getElementById('monthSelect'),
    otHours=document.getElementById('otHours'), otEnkelHours=document.getElementById('otEnkelHours'),
    ob1Hours=document.getElementById('ob1Hours'), ob2Hours=document.getElementById('ob2Hours'), ob3Hours=document.getElementById('ob3Hours'),
    sgiInput=document.getElementById('sgiInput'), ftpDays=document.getElementById('ftpDays'),
    ob1Rate=document.getElementById('ob1Rate'), ob2Rate=document.getElementById('ob2Rate'), ob3Rate=document.getElementById('ob3Rate'),
    otRate=document.getElementById('otRate'), otEnkelRate=document.getElementById('otEnkelRate'),
    selectedPeriod=document.getElementById('selectedPeriod'), finalNetSalary=document.getElementById('finalNetSalary'),
    detailGrid=document.getElementById('detailGrid'), tableBody=document.querySelector('#salaryTable tbody'),
    tableMonthLabel=document.getElementById('tableMonthLabel'), obGroundingDisplay=document.getElementById('obGroundingDisplay'),
    lockLabel=document.getElementById('lockLabel'), vabSummary=document.getElementById('vabSummary'),
    yearSummaryYear=document.getElementById('yearSummaryYear'), yearSummaryGrid=document.getElementById('yearSummaryGrid'),
    obLockToggle=document.getElementById('obLockToggle'), overviewTotalNet=document.getElementById('overviewTotalNet');

lagSelect.addEventListener('change', updateUI);
salaryInput.addEventListener('input',updateUI);
yearSelect.addEventListener('change',updateUI); monthSelect.addEventListener('change',updateUI);
otHours.addEventListener('input',updateUI); otEnkelHours.addEventListener('input',updateUI);
ob1Hours.addEventListener('input',updateUI); ob2Hours.addEventListener('input',updateUI); ob3Hours.addEventListener('input',updateUI);
sgiInput.addEventListener('input',updateUI); ftpDays.addEventListener('change',updateUI);
obLockToggle.addEventListener('change',updateUI);

[ob1Hours, ob2Hours, ob3Hours].forEach(f => f.addEventListener('input', () => { if (!obLockToggle.checked) manualOBOverride = true; }));

(function() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : 'light');
  document.getElementById('themeToggleCheckbox').checked = savedTheme === 'dark';
})();

populateSelectors();
const savedAutosave = localStorage.getItem(AUTOSAVE_KEY);
if (savedAutosave) { try { applyState(JSON.parse(savedAutosave)); } catch(e) { updateUI(); } }
else { if (lagSelect.value && lagSelect.value !== 'manual') applyIndustrialVacation(parseInt(yearSelect.value), lagSelect.value); updateUI(); }

window.setFromvaro=setFromvaro; window.changeShift=changeShift; window.resetSchema=resetSchema;
window.resetAllShifts=resetAllShifts; window.toggleExpand=toggleExpand;
window.toggleTheme = toggleTheme; window.toggleSettings = toggleSettings;
window.toggleVAB = toggleVAB; window.toggleOB = toggleOB; window.toggleOverview = toggleOverview;
window.toggleYearSummary = toggleYearSummary; window.updateUI = updateUI;
window.resetOB = resetOB;

document.querySelectorAll('.numeric-only').forEach(field => {
  field.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (field.classList.contains('numeric-hours')) {
      const match = this.value.match(/^(\d{0,3})(\.\d{0,2})?/);
      this.value = match ? match[0] : '';
    }
  });
});

updateProfileList();
});

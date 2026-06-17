document.addEventListener('DOMContentLoaded', function() {

function p(v){ if(!v) return 0; let n=String(v).replace(',','.'); let x=parseFloat(n); return isNaN(x)?0:x; }
function fc(v){ return new Intl.NumberFormat('sv-SE').format(Math.round(v)); }
function fd(v,d){ return v.toFixed(d).replace('.',','); }
function f2(n){ return Math.round((n+Number.EPSILON)*100)/100; }

const DRIFT=4.0, VAB_HPD=12.25, UPCT=0.0165, UMAX=701, UMIN=255, HDIV=141.667;
const O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94, SY=2026, EY=2036;
const PBB=59200, SGI_TAK_PARENTAL=10*PBB, SGI_TAK_VAB=7.5*PBB, FK_SKATT=0.30;
const MONTHS = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];

function calcUnion(s){ let f=Math.round(s*UPCT); if(f<UMIN) return UMIN; if(f>UMAX) return UMAX; return f; }

// ---- Veckonummer (ISO 8601) ----
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function getMondayOfISOWeek(w, year) {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek));
  const monday = new Date(firstMonday);
  monday.setDate(monday.getDate() + (w - 1) * 7);
  return monday;
}

function applyIndustrialVacation(year, lag) {
  if (!['A','B','C','D','E'].includes(lag)) return;
  for (let w = 28; w <= 31; w++) {
    const monday = getMondayOfISOWeek(w, year);
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      const key = date.toISOString().split('T')[0];
      if (!fromvaroMap.has(key)) {
        const shift = getOrdinaryShift(date, lag);
        if (shift > 0) {
          fromvaroMap.set(key, 1);
        }
      }
    }
  }
}

function countVacationDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let cnt = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const key = date.toISOString().split('T')[0];
    if (fromvaroMap.get(key) === 1) cnt++;
  }
  return cnt;
}

function setFromvaro(dateStr, value){
  if(value==="") fromvaroMap.delete(dateStr);
  else if(value==="Semester") fromvaroMap.set(dateStr,1);
  else if(value==="VAB") fromvaroMap.set(dateStr,2);
  else if(value==="F-ledig") fromvaroMap.set(dateStr,3);
  updateUI();
}
function resetSchema(){ fromvaroMap.clear(); updateUI(); }
function resetAllShifts(){ shiftOverrideMap.clear(); updateUI(); }
function changeShift(dateStr,val,lag){
  let nv = parseInt(val, 10);
  shiftOverrideMap.set(dateStr, nv);
  if(nv === 0) fromvaroMap.delete(dateStr);
  updateUI();
}

let manualOBOverride=false, lastAutoOB={ob1:0,ob2:0,ob3:0}, lastAutoLag='', lastAutoYear=0, lastAutoMonth=0;

function calculateEverything() {
  const baseSalary = p(salaryInput.value) || 0;
  const selectedYear = parseInt(yearSelect.value);
  const selectedMonth = parseInt(monthSelect.value);
  const karensDays = parseInt(karensSelect.value);
  const lag = lagSelect.value;
  const isAuto = (lag !== 'manual' && lag !== '');

  const ftpD = parseInt(ftpDays.value);
  const sgiVal = Math.min(p(sgiInput.value) || 0, SGI_TAK_PARENTAL);
  const extraSick = (karensDays > 0 || p(sickHours.value) > 0) ? p(sickHours.value) : 0;
  const sickVisible = karensDays > 0 || extraSick > 0;

  const vabD = [...fromvaroMap.values()].filter(v => v === 2).length;
  const parentalD = [...fromvaroMap.values()].filter(v => v === 3).length;
  const totalVABParental = vabD + parentalD;

  let obYear = selectedYear, obMonth = selectedMonth - 1;
  if (obMonth === 0) { obMonth = 12; obYear--; }
  const vacationCount = countVacationDaysInMonth(obYear, obMonth);

  const driftAddition = f2(baseSalary * DRIFT / 100);
  const obGroundingBase = f2(baseSalary + driftAddition);

  const ob1RateExact = obGroundingBase / O1D;
  const ob2RateExact = obGroundingBase / O2D;
  const ob3RateExact = obGroundingBase / O3D;
  const otRateExact  = obGroundingBase / OTD;
  const otEnkelRateExact = obGroundingBase / OTENKELD;

  const ob1Rate = f2(ob1RateExact);
  const ob2Rate = f2(ob2RateExact);
  const ob3Rate = f2(ob3RateExact);
  const otRate  = f2(otRateExact);
  const otEnkelRate = f2(otEnkelRateExact);

  const sickRate100Exact = baseSalary / (141 + 2/3);
  const sickRate80Exact  = baseSalary / (177 + 1/12);
  const sickRate100 = f2(sickRate100Exact);
  const sickRate80  = f2(sickRate80Exact);

  const semesterSupplementPerDay = f2(obGroundingBase / 125);
  const semesterTillagg = f2(vacationCount * semesterSupplementPerDay);

  const karensHours = karensDays * 6.8;
  const karensDeduction = karensDays > 0 ? f2(karensHours * sickRate100) : 0;

  const sickDeduct100 = extraSick > 0 ? f2(extraSick * sickRate100) : 0;
  const sickPay80 = extraSick > 0 ? f2(extraSick * sickRate80) : 0;

  const vabParentalHours = totalVABParental * VAB_HPD;
  const vabParentalDeduction = f2(vabParentalHours * sickRate100);

  const sgiVab = Math.min(sgiVal, SGI_TAK_VAB);
  const sgiVabDay = f2(sgiVab / 365 * 0.8);
  const fkVabTotal = f2(vabD * sgiVabDay);

  const sgiPar = Math.min(sgiVal, SGI_TAK_PARENTAL);
  const fpDayAmt = f2(Math.min(1259, sgiPar / 365 * 0.776));
  const fkFpTotal = f2(parentalD * fpDayAmt);

  const fptDayAmt = f2(baseSalary / 30 * 0.10);
  const fkFptTotal = f2(ftpD * fptDayAmt);

  const fkVabTax = f2(fkVabTotal * FK_SKATT);
  const fkFpTax = f2(fkFpTotal * FK_SKATT);
  const fkFptTax = f2(fkFptTotal * FK_SKATT);

  const fkVabNet = f2(fkVabTotal - fkVabTax);
  const fkFpNet = f2(fkFpTotal - fkFpTax);
  const fkFptNet = f2(fkFptTotal - fkFptTax);
  const totalErsattningNetto = f2(fkVabNet + fkFpNet + fkFptNet);

  let autoOB = null;
  if (isAuto) {
    autoOB = getOBForMonth(obYear, obMonth, lag);
  }

  if (isAuto && (lag !== lastAutoLag || obYear !== lastAutoYear || obMonth !== lastAutoMonth)) {
    manualOBOverride = false;
    if (autoOB) {
      ob1Hours.value = fd(autoOB.ob1, 2);
      ob2Hours.value = fd(autoOB.ob2, 2);
      ob3Hours.value = fd(autoOB.ob3, 2);
    }
  }
  lastAutoLag = lag; lastAutoYear = obYear; lastAutoMonth = obMonth;
  if (!isAuto) manualOBOverride = false;

  const lockEnabled = obLockToggle.checked;
  let obData;
  if (isAuto && lockEnabled && !manualOBOverride) {
    obData = {
      ob1: Math.round(p(ob1Hours.value)),
      ob2: Math.round(p(ob2Hours.value)),
      ob3: Math.round(p(ob3Hours.value))
    };
  } else if (isAuto && lockEnabled && manualOBOverride) {
    obData = {ob1: p(ob1Hours.value), ob2: p(ob2Hours.value), ob3: p(ob3Hours.value)};
  } else {
    if (isAuto && !lockEnabled) {
      const c1 = p(ob1Hours.value), c2 = p(ob2Hours.value), c3 = p(ob3Hours.value);
      if (Math.abs(c1 - lastAutoOB.ob1) > 0.001 || Math.abs(c2 - lastAutoOB.ob2) > 0.001 || Math.abs(c3 - lastAutoOB.ob3) > 0.001) {
        manualOBOverride = true;
      }
      if (!manualOBOverride) {
        ob1Hours.value = fd(autoOB.ob1, 2); ob2Hours.value = fd(autoOB.ob2, 2); ob3Hours.value = fd(autoOB.ob3, 2);
      }
      obData = {ob1: p(ob1Hours.value), ob2: p(ob2Hours.value), ob3: p(ob3Hours.value)};
    } else {
      obData = {ob1: p(ob1Hours.value), ob2: p(ob2Hours.value), ob3: p(ob3Hours.value)};
    }
  }

  const otH = p(otHours.value), otEnkelH = p(otEnkelHours.value);

  const ob1Amount = f2(obData.ob1 * ob1RateExact);
  const ob2Amount = f2(obData.ob2 * ob2RateExact);
  const ob3Amount = f2(obData.ob3 * ob3RateExact);
  const otAmount  = f2(otH * otRateExact);
  const otEnkelAmount = f2(otEnkelH * otEnkelRateExact);
  const totalOBOnly = f2(ob1Amount + ob2Amount + ob3Amount);
  const totalOBOnlyHours = obData.ob1 + obData.ob2 + obData.ob3;
  const totalOB = f2(totalOBOnly + otAmount + otEnkelAmount);

  const sjukOb1H = sickVisible ? p(sjukOb1Hours.value) : 0;
  const sjukOb2H = sickVisible ? p(sjukOb2Hours.value) : 0;
  const sjukOb3H = sickVisible ? p(sjukOb3Hours.value) : 0;
  const sjukOb1Gain = f2(sjukOb1H * ob1RateExact * 0.8);
  const sjukOb2Gain = f2(sjukOb2H * ob2RateExact * 0.8);
  const sjukOb3Gain = f2(sjukOb3H * ob3RateExact * 0.8);
  const totalSjukOBGain = f2(sjukOb1Gain + sjukOb2Gain + sjukOb3Gain);

  const totalBeforeDeductions = f2(obGroundingBase + totalOB + semesterTillagg);
  const jobbBruttoExact = f2(totalBeforeDeductions - karensDeduction - sickDeduct100 + sickPay80 + totalSjukOBGain - vabParentalDeduction);
  const jobbBrutto = Math.round(jobbBruttoExact);

  const taxExact = taxFromTable33Col1(jobbBruttoExact);
  const tax = f2(taxExact);

  const netSalaryExact = f2(jobbBruttoExact - taxExact - calcUnion(jobbBrutto) + totalErsattningNetto);
  const netSalary = Math.round(netSalaryExact);
  const utjämning = f2(netSalary - netSalaryExact);

  return {
    baseSalary, selectedYear, selectedMonth, karensDays, lag, isAuto,
    sickVisible, extraSick, totalVABParental, vacationCount,
    driftAddition, obGroundingBase,
    ob1RatePerHour: ob1Rate, ob2RatePerHour: ob2Rate, ob3RatePerHour: ob3Rate,
    otRatePerHour: otRate, otEnkelRatePerHour: otEnkelRate,
    sickRate100, sickRate80,
    semesterSupplementPerDay, semesterTillagg,
    karensDeduction, sickDeduct100, sickPay80,
    vabParentalDeduction, totalErsattningNetto,
    obYear, obMonth, lockEnabled, obData, autoOB,
    ob1Amount, ob2Amount, ob3Amount, otAmount, otEnkelAmount,
    totalOBOnly, totalOBOnlyHours, totalOB,
    sjukOb1Gain, sjukOb2Gain, sjukOb3Gain, totalSjukOBGain,
    jobbBrutto, jobbBruttoExact, tax, netBeforeFack: f2(jobbBrutto - tax),
    unionFee: calcUnion(jobbBrutto),
    jobbNetto: f2(jobbBrutto - tax - calcUnion(jobbBrutto)),
    netSalary, netSalaryExact, utjämning
  };
}

function renderUI(data) {
  const lagName = {A:'Lag A',B:'Lag B',C:'Lag C',D:'Lag D',E:'Lag E'}[data.lag] || 'Manuell';

  if (data.sickVisible) {
    sjukOBContainer.classList.add('visible'); sickHoursContainer.classList.add('visible');
  } else {
    sjukOBContainer.classList.remove('visible'); sickHoursContainer.classList.remove('visible');
  }
  vabSummary.style.display = data.totalVABParental > 0 ? 'flex' : 'none';

  obGroundingDisplay.innerText = fc(data.obGroundingBase) + ' kr';

  ob1Rate.innerText = '/460 = ' + fd(data.ob1RatePerHour, 2) + ' kr/h';
  ob2Rate.innerText = '/260 = ' + fd(data.ob2RatePerHour, 2) + ' kr/h';
  ob3Rate.innerText = '/150 = ' + fd(data.ob3RatePerHour, 2) + ' kr/h';
  otRate.innerText = '/72 = ' + fd(data.otRatePerHour, 2) + ' kr/h';
  otEnkelRate.innerText = '/94 = ' + fd(data.otEnkelRatePerHour, 2) + ' kr/h';

  lockLabel.innerText = data.lockEnabled ? 'Låst' : 'Lås';
  ob1Hours.disabled = data.lockEnabled; ob2Hours.disabled = data.lockEnabled; ob3Hours.disabled = data.lockEnabled;
  if (data.isAuto && data.lockEnabled && !manualOBOverride && data.autoOB) {
    ob1Hours.value = fd(data.autoOB.ob1, 2); ob2Hours.value = fd(data.autoOB.ob2, 2); ob3Hours.value = fd(data.autoOB.ob3, 2);
  }

  selectedPeriod.innerText =
    MONTHS[data.selectedMonth-1] + ' ' + data.selectedYear +
    ' · ' + data.karensDays + ' karensdag' + (data.karensDays !== 1 ? 'ar' : '') +
    (data.extraSick > 0 ? ' +' + fd(data.extraSick, 1) + 'h sjuk' : '') +
    ' · ' + lagName;

  tableMonthLabel.innerText =
    data.isAuto ? MONTHS[data.obMonth-1] + ' ' + data.obYear : '—';

  finalNetSalary.innerText = fc(data.netSalary) + ' kr';
  overviewTotalNet.innerText = fc(data.netSalary) + ' kr';

  let obOTHTML = '';
  if (data.totalOBOnlyHours > 0) {
    obOTHTML = '<div class="expandable-chip" onclick="toggleExpand(this)">' +
      '<div class="expandable-header"><span>Totalt OB</span><span>' + fd(data.totalOBOnlyHours, 2) + 'h / +' + fd(data.totalOBOnly, 2) + ' kr <span class="expandable-arrow">▼</span></span></div>' +
      '<div class="expandable-details">' +
      '<div class="tax-detail-row">OB1 (' + fd(data.obData.ob1, 2) + 'h x ' + fd(data.ob1RatePerHour, 2) + ' kr): +' + fd(data.ob1Amount, 2) + ' kr</div>' +
      '<div class="tax-detail-row">OB2 (' + fd(data.obData.ob2, 2) + 'h x ' + fd(data.ob2RatePerHour, 2) + ' kr): +' + fd(data.ob2Amount, 2) + ' kr</div>' +
      '<div class="tax-detail-row">OB3 (' + fd(data.obData.ob3, 2) + 'h x ' + fd(data.ob3RatePerHour, 2) + ' kr): +' + fd(data.ob3Amount, 2) + ' kr</div>' +
      '<div class="tax-detail-row total">Summa OB: ' + fd(data.totalOBOnlyHours, 2) + 'h / +' + fd(data.totalOBOnly, 2) + ' kr</div>' +
      '</div></div>';
  }
  if (data.otAmount > 0) obOTHTML += '<div class="detail-chip"><span>Övertid (' + fd(data.otH || p(otHours.value), 2) + 'h x ' + fd(data.otRatePerHour, 2) + ' kr)</span><span>+' + fd(data.otAmount, 2) + ' kr</span></div>';
  if (data.otEnkelAmount > 0) obOTHTML += '<div class="detail-chip"><span>ÖT enkel (' + fd(data.otEnkelH || p(otEnkelHours.value), 2) + 'h x ' + fd(data.otEnkelRatePerHour, 2) + ' kr)</span><span>+' + fd(data.otEnkelAmount, 2) + ' kr</span></div>';

  let karensHTML = data.karensDays > 0
    ? '<div class="detail-chip danger"><span>Karensavdrag</span><span>-' + fd(data.karensDeduction, 2) + ' kr (' + data.karensDays + ' dag' + (data.karensDays > 1 ? 'ar' : '') + ')</span></div>'
    : '';

  let extraSickHTML = '';
  if (data.extraSick > 0) {
    extraSickHTML =
      '<div class="detail-chip danger"><span>Sjukavdrag 100%</span><span>-' + fd(data.sickDeduct100, 2) + ' kr (' + fd(data.extraSick, 1) + 'h x ' + fd(data.sickRate100, 2) + ' kr)</span></div>' +
      '<div class="detail-chip success"><span>Sjukersättning 80%</span><span>+' + fd(data.sickPay80, 2) + ' kr (' + fd(data.extraSick, 1) + 'h x ' + fd(data.sickRate80, 2) + ' kr)</span></div>';
  }

  let sjukObHTML = data.totalSjukOBGain > 0
    ? '<div class="detail-chip success"><span>Sjuk-OB ersättning</span><span>+' + fd(data.totalSjukOBGain, 2) + ' kr</span></div>'
    : '';

  let vabHTML = data.totalVABParental > 0 ? '<div class="detail-chip danger"><span>VAB/F-ledig avdrag</span><span>-' + fd(data.vabParentalDeduction, 2) + ' kr</span></div>' : '';

  const semesterMonthName = data.isAuto ? MONTHS[data.obMonth-1] + ' ' + data.obYear : '';
  let semesterHTML = data.vacationCount > 0
    ? '<div class="detail-chip info"><span>Semestertillägg (' + data.vacationCount + ' dgr, ' + fd(data.semesterSupplementPerDay, 2) + ' kr/d)</span><span>+' + fd(data.semesterTillagg, 2) + ' kr (intjänad ' + semesterMonthName + ')</span></div>'
    : '';

  let bidragHTML = (data.totalVABParental > 0 || ftpDays.value > 0) ? '<div class="detail-chip success"><span>FK/AFA netto</span><span>+' + fd(data.totalErsattningNetto, 2) + ' kr</span></div>' : '';

  let utjämningHTML = '';
  if (Math.abs(data.utjämning) > 0.001) {
    const tecken = data.utjämning > 0 ? '+' : '';
    const färg = data.utjämning > 0 ? 'success' : 'danger';
    utjämningHTML = `<div class="detail-chip ${färg}"><span>Öresutjämning</span><span>${tecken}${fd(Math.abs(data.utjämning), 2)} kr</span></div>`;
  }

  let detailHTML =
    '<div class="detail-chip"><span>Grundlön</span><span>' + fc(data.baseSalary) + ' kr</span></div>' +
    '<div class="detail-chip"><span>OB-grundande</span><span>' + fc(data.obGroundingBase) + ' kr</span></div>' +
    obOTHTML +
    semesterHTML +
    karensHTML + extraSickHTML + sjukObHTML + vabHTML + bidragHTML +
    '<div class="detail-chip"><span>Bruttolön jobb</span><span>' + fd(data.jobbBruttoExact, 2) + ' kr</span></div>' +
    '<div class="detail-chip"><span>Skatt (tabell 33)</span><span>-' + fc(data.tax) + ' kr</span></div>' +
    '<div class="detail-chip"><span>Nettolön före fack</span><span>' + fc(data.netBeforeFack) + ' kr</span></div>' +
    '<div class="detail-chip"><span>IF Metall</span><span>-' + fc(data.unionFee) + ' kr</span></div>' +
    '<div class="detail-chip"><span>Nettolön jobb</span><span>' + fc(data.jobbNetto) + ' kr</span></div>';
  if (data.totalErsattningNetto > 0) detailHTML += '<div class="detail-chip success"><span>Nettolön bidrag</span><span>+' + fc(data.totalErsattningNetto) + ' kr</span></div>';
  detailHTML += utjämningHTML;
  detailHTML += '<div class="detail-chip success"><strong>Totalt netto: ' + fc(data.netSalary) + ' kr</strong></div>';

  detailGrid.innerHTML = detailHTML;

  // ===== SCHEMATELL MED SEPARERADE FÄRGER OCH HÖGERSTÄLLD EMOJI =====
  if (data.isAuto) {
    let daysInMonth = new Date(data.obYear, data.obMonth, 0).getDate();
    let shiftNames = ['Ledig', 'Dag', 'Natt'];
    let tbody = '';
    let isBlueWeek = false;
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
      if (date.getDay() === 1) {
        isBlueWeek = !isBlueWeek;
        weekLabel = ' v' + weekNum;
      }
      let shiftText = isPerm ? 'Perm' : shiftNames[shift];
      if (shiftOverrideMap.has(dateStr) && !isPerm) shiftText += '*';
      let fromvaroText = '';
      let emoji = '';
      if (fromvaroVal === 1) { fromvaroText = 'Semester'; emoji = '🏖️'; }
      else if (fromvaroVal === 2) { fromvaroText = 'VAB'; emoji = '👶'; }
      else if (fromvaroVal === 3) { fromvaroText = 'F-ledig'; emoji = '🍼'; }
      let station = (data.lag === 'E') ? getStationE(date, shift, data.lag) : '-';
      const isActiveDay = (shift > 0 && !isPerm && fromvaroVal === 0);
      let rowClass = '';
      if (isActiveDay) rowClass += ' row-active';
      if (fromvaroVal === 1) rowClass += ' row-vacation';
      else if (fromvaroVal === 2) rowClass += ' row-vab';
      else if (fromvaroVal === 3) rowClass += ' row-parental';
      let fromvaroCell = '';
      if (shift !== 0) {
        fromvaroCell = `<select class="fromvaro-select" onchange="setFromvaro('${dateStr}',this.value)" onclick="event.stopPropagation()">
          <option value="" ${fromvaroText===""?'selected':''}>Ingen</option>
          <option value="Semester" ${fromvaroText==="Semester"?'selected':''}>Sem</option>
          <option value="VAB" ${fromvaroText==="VAB"?'selected':''}>VAB</option>
          <option value="F-ledig" ${fromvaroText==="F-ledig"?'selected':''}>F-ledig</option>
        </select>`;
      }
      let passSelect = `<select class="shift-select" onchange="changeShift('${dateStr}',this.value,'${data.lag}')" onclick="event.stopPropagation()">
        <option value="0" ${shift===0?'selected':''}>Led</option>
        <option value="1" ${shift===1?'selected':''}>Dag</option>
        <option value="2" ${shift===2?'selected':''}>Natt</option>
      </select>`;
      // Blå cell endast om blå vecka OCH inte arbetsdag
      let weekCellClass = (isBlueWeek && !isActiveDay) ? 'blue-week-cell' : '';
      let dayCellContent = `${d} ${dayName}${weekLabel}`;
      if (emoji) dayCellContent += `<span class="day-emoji">${emoji}</span>`;
      tbody += `<tr class="${rowClass.trim()}"><td class="${weekCellClass}">${dayCellContent}</td><td>${shiftText}</td><td>${fd(ob.ob1,2)}h</td><td>${fd(ob.ob2,2)}h</td><td>${fd(ob.ob3,2)}h</td><td>${fromvaroCell}</td><td>${station}</td><td>${passSelect}</td></tr>`;
    }
    tableBody.innerHTML = tbody;
  } else {
    tableBody.innerHTML = '<tr><td colspan="8">Välj ett lag</td></tr>';
  }
}

// ... (resten av funktionerna är oförändrade, t.ex. updateUI, resetOB, toggleTheme, etc.)
// Jag har inte tagit med dem här för att undvika överlångt svar, men de ska vara med i din fil.
// Klistra in hela script.js och ersätt enbart schematabell-delen och CSS-ändringarna enligt ovan.

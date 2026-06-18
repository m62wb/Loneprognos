const AUTOSAVE_KEY = 'loneprognos_autosave_v1';

document.addEventListener('DOMContentLoaded', function() {

// Global flagga för att stoppa lagbyte‑rensning under profilladdning
window.isLoadingProfile = false;

function applyIndustrialVacation(year, lag) {
  if (!['A','B','C','D','E'].includes(lag)) return;
  for (let w = 28; w <= 31; w++) {
    const monday = getMondayOfISOWeek(w, year);
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      const key = date.toISOString().split('T')[0];
      if (vacationOverrideMap.has(key)) continue;
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
  const date = new Date(dateStr);
  const week = getWeekNumber(date);
  if (week >= 28 && week <= 31) {
    vacationOverrideMap.set(dateStr, true);
  }

  if(value==="") fromvaroMap.delete(dateStr);
  else if(value==="Semester") fromvaroMap.set(dateStr,1);
  else if(value==="VAB") fromvaroMap.set(dateStr,2);
  else if(value==="F-ledig") fromvaroMap.set(dateStr,3);
  updateUI();
}
function resetSchema(){ 
  fromvaroMap.clear(); 
  vacationOverrideMap.clear(); 
  updateUI(); 
}
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

  const taxExact = taxFromTable33Col1(jobbBruttoExact, selectedYear);
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
      let rowClass = '';
      if (fromvaroVal === 0 && shift > 0 && !isPerm) {
        rowClass = (shift === 1) ? 'row-day' : 'row-night';
      }
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
      let weekCellClass = isBlueWeek ? 'blue-week-cell' : '';
      let dayCellContent = `${d} ${dayName}${weekLabel}`;
      if (emoji) dayCellContent += `<span class="day-emoji">${emoji}</span>`;
      tbody += `<tr class="${rowClass.trim()}"><td class="${weekCellClass}">${dayCellContent}</td><td>${shiftText}</td><td>${fd(ob.ob1,2)}h</td><td>${fd(ob.ob2,2)}h</td><td>${fd(ob.ob3,2)}h</td><td>${fromvaroCell}</td><td>${station}</td><td>${passSelect}</td></tr>`;
    }
    tableBody.innerHTML = tbody;
  } else {
    tableBody.innerHTML = '<tr><td colspan="8">Välj ett lag</td></tr>';
  }
}

function showMainIfValid() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const lag = lagSelect.value;
  if (lag !== '' && lag !== 'manual') {
    main.style.display = '';
  } else if (lag === 'manual') {
    main.style.display = '';
  } else {
    main.style.display = 'none';
  }
}

function autoSaveState() {
  if (typeof getCurrentState === 'function') {
    const state = getCurrentState();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
  }
}

function updateUI() {
  applyIndustrialVacation(parseInt(yearSelect.value), lagSelect.value);
  const data = calculateEverything();
  renderUI(data);
  updateSettingsLabel();
  if (data.isAuto && data.lockEnabled && !manualOBOverride && data.autoOB) {
    ob1Hours.value = fd(data.autoOB.ob1, 2);
    ob2Hours.value = fd(data.autoOB.ob2, 2);
    ob3Hours.value = fd(data.autoOB.ob3, 2);
  }
  closeSettingsBoxIfNeeded();
  renderOBChart();
  showMainIfValid();
  autoSaveState();
}

function closeSettingsBoxIfNeeded() {
  const settingsContent = document.getElementById('settingsContent');
  const arrow = document.getElementById('settingsArrow');
  if (settingsContent && settingsContent.classList.contains('open') && lagSelect.value !== '') {
    settingsContent.classList.remove('open');
    if (arrow) arrow.textContent = '▼';
  }
}

function resetOB() {
  const lag = lagSelect.value;
  if (lag !== 'manual' && lag !== '') {
    let y = parseInt(yearSelect.value);
    let m = parseInt(monthSelect.value);
    let om = m - 1;
    if (om === 0) { om = 12; y--; }
    const ob = getOBForMonth(y, om, lag);
    ob1Hours.value = fd(ob.ob1, 2);
    ob2Hours.value = fd(ob.ob2, 2);
    ob3Hours.value = fd(ob.ob3, 2);
  } else {
    ob1Hours.value = '0'; ob2Hours.value = '0'; ob3Hours.value = '0';
  }
  manualOBOverride = false;
  updateUI();
}

function toggleExpand(el){ let d=el.querySelector('.expandable-details'), a=el.querySelector('.expandable-arrow'); d.classList.toggle('open'); a.classList.toggle('open'); }

function toggleTheme() {
    const checkbox = document.getElementById('themeToggleCheckbox');
    const isDark = checkbox.checked;
    const html = document.documentElement;
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleVAB(){ let c=document.getElementById('vabContent'), a=document.getElementById('vabArrow'); c.classList.toggle('open'); a.innerText=c.classList.contains('open')?'▲':'▼'; }
function toggleOB(){ let c=document.getElementById('obContent'), a=document.getElementById('obArrow'); c.classList.toggle('open'); a.innerText=c.classList.contains('open')?'▲':'▼'; }
function toggleOverview(){ let c=document.getElementById('overviewContent'); c.style.display = c.style.display==='none'?'block':'none'; }
function toggleYearSummary(){ let d=document.getElementById('yearDetails'), a=document.getElementById('yearArrow'); if(d.style.display==='none'){ d.style.display='block'; a.innerText='▲'; updateYearSummary(); } else { d.style.display='none'; a.innerText='▼'; } }

function updateYearSummary() {
  const y = parseInt(yearSelect.value);
  const lag = lagSelect.value;
  if (lag === 'manual' || lag === '') {
    document.getElementById('yearSummaryGrid').innerHTML = 'Välj lag';
    return;
  }
  document.getElementById('yearSummaryYear').innerText = y;
  const bs = p(salaryInput.value) || 0;
  const da = f2(bs * DRIFT / 100);
  const obBase = bs + da;
  const o1r = f2(obBase / O1D);
  const o2r = f2(obBase / O2D);
  const o3r = f2(obBase / O3D);
  let totBrutto = 0, totNetto = 0, totSkatt = 0, totFack = 0, totOB = 0, totSemester = 0;
  for (let m = 1; m <= 12; m++) {
    let obMonth = m - 1, obYear = y;
    if (obMonth === 0) { obMonth = 12; obYear--; }
    const obData = getOBForMonth(obYear, obMonth, lag);
    const ob1Amt = f2(obData.ob1 * o1r);
    const ob2Amt = f2(obData.ob2 * o2r);
    const ob3Amt = f2(obData.ob3 * o3r);
    const mOB = f2(ob1Amt + ob2Amt + ob3Amt);
    totOB += mOB;
    const vacDays = countVacationDaysInMonth(obYear, obMonth);
    const semTillagg = f2(vacDays * f2(obBase / 125));
    totSemester += semTillagg;
    const jb = Math.round(obBase + mOB + semTillagg);
    const tax = taxFromTable33Col1(jb, y);
    const uf = calcUnion(jb);
    const net = jb - tax - uf;
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

function toggleSettings() {
    const c = document.getElementById('settingsContent');
    const a = document.getElementById('settingsArrow');
    if (c) {
        c.classList.toggle('open');
        if (a) a.textContent = c.classList.contains('open') ? '▲' : '▼';
    }
}

let obChartInstance = null;
function renderOBChart() {
    const lag = lagSelect.value;
    if (lag === 'manual' || lag === '') return;
    const year = parseInt(yearSelect.value);
    const bs = p(salaryInput.value) || 0;
    const da = f2(bs * DRIFT / 100);
    const obBase = bs + da;
    const o1r = f2(obBase / O1D);
    const o2r = f2(obBase / O2D);
    const o3r = f2(obBase / O3D);
    const labels = []; const data = [];
    for (let m = 1; m <= 12; m++) {
        const obData = getOBForMonth(year, m, lag);
        const amount = f2(obData.ob1 * o1r + obData.ob2 * o2r + obData.ob3 * o3r);
        labels.push(MONTHS[m-1]); data.push(amount);
    }
    const ctx = document.getElementById('obChart');
    if (!ctx) return;
    if (obChartInstance) obChartInstance.destroy();
    obChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'OB‑ersättning (kr)',
                data: data,
                backgroundColor: 'rgba(88,166,255,0.6)',
                borderColor: 'rgba(88,166,255,1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#8b949e' } },
                x: { ticks: { color: '#8b949e' } }
            },
            plugins: { legend: { labels: { color: '#8b949e' } } }
        }
    });
}

function populateSelectors(){
  for(let y=SY;y<=EY;y++){ let o=document.createElement('option'); o.value=y; o.textContent=y; yearSelect.appendChild(o); }
  let now=new Date();
  yearSelect.value=Math.max(SY,Math.min(EY,now.getFullYear()));
  MONTHS.forEach((m,i)=>{ let o=document.createElement('option'); o.value=i+1; o.textContent=m; monthSelect.appendChild(o); });
  monthSelect.value=now.getMonth()+1;
}

let lagSelect=document.getElementById('lagSelect'), salaryInput=document.getElementById('salaryInput'),
    yearSelect=document.getElementById('yearSelect'), monthSelect=document.getElementById('monthSelect'),
    karensSelect=document.getElementById('karensSelect'), otHours=document.getElementById('otHours'),
    otEnkelHours=document.getElementById('otEnkelHours'), ob1Hours=document.getElementById('ob1Hours'),
    ob2Hours=document.getElementById('ob2Hours'), ob3Hours=document.getElementById('ob3Hours'),
    sjukOb1Hours=document.getElementById('sjukOb1Hours'), sjukOb2Hours=document.getElementById('sjukOb2Hours'),
    sjukOb3Hours=document.getElementById('sjukOb3Hours'), sickHours=document.getElementById('sickHours'),
    ftpDays=document.getElementById('ftpDays'), sgiInput=document.getElementById('sgiInput'),
    ob1Rate=document.getElementById('ob1Rate'), ob2Rate=document.getElementById('ob2Rate'),
    ob3Rate=document.getElementById('ob3Rate'), otRate=document.getElementById('otRate'),
    otEnkelRate=document.getElementById('otEnkelRate'), selectedPeriod=document.getElementById('selectedPeriod'),
    finalNetSalary=document.getElementById('finalNetSalary'), detailGrid=document.getElementById('detailGrid'),
    tableBody=document.querySelector('#salaryTable tbody'), tableMonthLabel=document.getElementById('tableMonthLabel'),
    obGroundingDisplay=document.getElementById('obGroundingDisplay'), sjukOBContainer=document.getElementById('sjukOBContainer'),
    sickHoursContainer=document.getElementById('sickHoursContainer'), lockLabel=document.getElementById('lockLabel'),
    vabSummary=document.getElementById('vabSummary'), vabInfo=document.getElementById('vabInfo'),
    yearSummaryYear=document.getElementById('yearSummaryYear'), yearSummaryGrid=document.getElementById('yearSummaryGrid'),
    obLockToggle=document.getElementById('obLockToggle'), overviewTotalNet=document.getElementById('overviewTotalNet');

// ---- Lagbyte rensar hela schemat (utom under profilladdning) ----
lagSelect.addEventListener('change', function() {
  if (window.isLoadingProfile) return;
  fromvaroMap.clear();
  vacationOverrideMap.clear();
  shiftOverrideMap.clear();
  updateUI();
});

salaryInput.addEventListener('input',updateUI);
yearSelect.addEventListener('change',updateUI); monthSelect.addEventListener('change',updateUI);
karensSelect.addEventListener('change',updateUI); otHours.addEventListener('input',updateUI);
otEnkelHours.addEventListener('input',updateUI); ob1Hours.addEventListener('input',updateUI);
ob2Hours.addEventListener('input',updateUI); ob3Hours.addEventListener('input',updateUI);
sjukOb1Hours.addEventListener('input',updateUI); sjukOb2Hours.addEventListener('input',updateUI);
sjukOb3Hours.addEventListener('input',updateUI); sickHours.addEventListener('input',updateUI);
ftpDays.addEventListener('change',updateUI); sgiInput.addEventListener('input',updateUI);
obLockToggle.addEventListener('change',updateUI);

[ob1Hours, ob2Hours, ob3Hours].forEach(function(field) {
  field.addEventListener('input', function() {
    if (!obLockToggle.checked) { manualOBOverride = true; }
  });
});

(function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const isDark = (savedTheme === 'dark');
    const html = document.documentElement;
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const checkbox = document.getElementById('themeToggleCheckbox');
    if (checkbox) checkbox.checked = isDark;
})();

populateSelectors();

const savedAutosave = localStorage.getItem(AUTOSAVE_KEY);
if (savedAutosave) {
  try {
    const state = JSON.parse(savedAutosave);
    if (typeof applyState === 'function') {
      window.isLoadingProfile = true;
      applyState(state);
    } else {
      updateUI();
    }
  } catch(e) {
    updateUI();
  }
} else {
  updateUI();
}

window.setFromvaro=setFromvaro; window.changeShift=changeShift; window.resetSchema=resetSchema;
window.resetAllShifts=resetAllShifts; window.toggleExpand=toggleExpand;
window.toggleYearSummary=toggleYearSummary; window.toggleVAB=toggleVAB; window.toggleOB=toggleOB;
window.toggleOverview=toggleOverview;
window.toggleTheme = toggleTheme; window.toggleSettings = toggleSettings;
window.resetOB = resetOB; window.manualOBOverride = manualOBOverride;
window.updateUI = updateUI;
window.salaryInput = salaryInput; window.lagSelect = lagSelect;
window.yearSelect = yearSelect; window.monthSelect = monthSelect;
window.karensSelect = karensSelect; window.otHours = otHours; window.otEnkelHours = otEnkelHours;
window.ob1Hours = ob1Hours; window.ob2Hours = ob2Hours; window.ob3Hours = ob3Hours;
window.sjukOb1Hours = sjukOb1Hours; window.sjukOb2Hours = sjukOb2Hours; window.sjukOb3Hours = sjukOb3Hours;
window.sickHours = sickHours; window.ftpDays = ftpDays; window.sgiInput = sgiInput;
window.obLockToggle = obLockToggle;

document.querySelectorAll('.numeric-only').forEach(function(field) {
  field.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9.,]/g, '');
    if (this.value.includes(',')) { this.value = this.value.replace(',', '.'); }
    if (field.classList.contains('numeric-hours')) {
      var match = this.value.match(/^(\d{0,3})(\.\d{0,2})?/);
      this.value = match ? match[0] : '';
    }
  });
});

});

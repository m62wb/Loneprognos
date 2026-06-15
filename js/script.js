document.addEventListener('DOMContentLoaded', function() {

// ---------- Hjälpfunktioner ----------
function p(v){ if(!v) return 0; let n=String(v).replace(',','.'); let x=parseFloat(n); return isNaN(x)?0:x; }
function fc(v){ return new Intl.NumberFormat('sv-SE').format(Math.round(v)); }
function fd(v,d){ return v.toFixed(d).replace('.',','); }
function f2(n){ return Math.round((n+Number.EPSILON)*100)/100; }

// ---------- Konstanter ----------
const DRIFT=4.0, VAB_HPD=12.25, UPCT=0.0165, UMAX=701, UMIN=255, HDIV=141.667;
const O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94, SY=2026, EY=2036;
const PBB=59200, SGI_TAK_PARENTAL=10*PBB, SGI_TAK_VAB=7.5*PBB, FK_SKATT=0.30;
const MONTHS = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];

function calcUnion(s){ let f=Math.round(s*UPCT); if(f<UMIN) return UMIN; if(f>UMAX) return UMAX; return f; }

// ---------- Frånvaro och pass ----------
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

// Exponera dem globalt (behövs för onclick i HTML)
window.setFromvaro = setFromvaro;
window.changeShift = changeShift;
window.resetSchema = resetSchema;
window.resetAllShifts = resetAllShifts;
window.resetOB = resetOB;  // definieras i arsoversikt.js

// ---------- Tillstånd ----------
let manualOBOverride=false, lastAutoOB={ob1:0,ob2:0,ob3:0}, lastAutoLag='', lastAutoYear=0, lastAutoMonth=0;

// ---------- Beräkningsfunktioner ----------

function calculateEverything() {
  const baseSalary = p(window.salaryInput.value) || 0;
  const selectedYear = parseInt(window.yearSelect.value);
  const selectedMonth = parseInt(window.monthSelect.value);
  const karensDays = parseInt(window.karensSelect.value);
  const lag = window.lagSelect.value;
  const isAuto = (lag !== 'manual');

  const ftpD = parseInt(window.ftpDays.value);
  const sgiVal = Math.min(p(window.sgiInput.value) || 0, SGI_TAK_PARENTAL);
  const extraSick = (karensDays > 0 || p(window.sickHours.value) > 0) ? p(window.sickHours.value) : 0;
  const sickVisible = karensDays > 0 || extraSick > 0;

  const vabD = [...fromvaroMap.values()].filter(v => v === 2).length;
  const parentalD = [...fromvaroMap.values()].filter(v => v === 3).length;
  const totalVABParental = vabD + parentalD;
  const vacationCount = [...fromvaroMap.values()].filter(v => v === 1).length;

  const driftAddition = Math.round(baseSalary * DRIFT / 100);
  const obGroundingBase = baseSalary + driftAddition;

  const ob1RatePerHour = obGroundingBase / O1D;
  const ob2RatePerHour = obGroundingBase / O2D;
  const ob3RatePerHour = obGroundingBase / O3D;
  const otRatePerHour = obGroundingBase / OTD;
  const otEnkelRatePerHour = obGroundingBase / OTENKELD;

  const sickRate100 = baseSalary / 141.667;
  const sickRate80 = baseSalary / 177.0837;

  const semesterSupplementPerDay = (baseSalary + driftAddition) / 125;
  const semesterTillagg = f2(vacationCount * semesterSupplementPerDay);

  const karensHours = karensDays * 6.8;
  const karensDeduction = karensDays > 0 ? f2(karensHours * sickRate100) : 0;
  const sickDeduct100 = f2(extraSick * sickRate100);
  const sickPay80 = f2(extraSick * sickRate80);
  const sickNetLoss = f2(sickDeduct100 - sickPay80);
  const totalSickLoss = f2(karensDeduction + sickNetLoss);

  const vabParentalHours = totalVABParental * VAB_HPD;
  const vabParentalDeduction = f2(vabParentalHours * sickRate100);

  const sgiVab = Math.min(sgiVal, SGI_TAK_VAB);
  const sgiVabDay = f2(sgiVab / 365 * 0.8);
  const fkVabTotal = f2(vabD * sgiVabDay);

  const sgiPar = Math.min(sgiVal, SGI_TAK_PARENTAL);
  const fpDayAmt = Math.min(1259, f2(sgiPar / 365 * 0.776));
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

  let obYear = selectedYear, obMonth = selectedMonth - 1;
  if (obMonth === 0) { obMonth = 12; obYear--; }

  let autoOB = null;
  if (isAuto) {
    autoOB = getOBForMonth(obYear, obMonth, lag);
    if (lag !== lastAutoLag || obYear !== lastAutoYear || obMonth !== lastAutoMonth) {
      manualOBOverride = false;
    }
    lastAutoLag = lag;
    lastAutoYear = obYear;
    lastAutoMonth = obMonth;
    lastAutoOB = autoOB;
  } else {
    manualOBOverride = false;
  }

  const lockEnabled = window.obLockToggle.checked;
  let obData;
  if (isAuto && lockEnabled && !manualOBOverride) {
    obData = autoOB;
  } else if (isAuto && lockEnabled && manualOBOverride) {
    obData = {ob1: p(window.ob1Hours.value), ob2: p(window.ob2Hours.value), ob3: p(window.ob3Hours.value)};
  } else {
    if (isAuto && !lockEnabled) {
      const c1 = p(window.ob1Hours.value), c2 = p(window.ob2Hours.value), c3 = p(window.ob3Hours.value);
      if (Math.abs(c1 - lastAutoOB.ob1) > 0.001 || Math.abs(c2 - lastAutoOB.ob2) > 0.001 || Math.abs(c3 - lastAutoOB.ob3) > 0.001) {
        manualOBOverride = true;
      }
      if (!manualOBOverride) {
        window.ob1Hours.value = fd(autoOB.ob1, 2);
        window.ob2Hours.value = fd(autoOB.ob2, 2);
        window.ob3Hours.value = fd(autoOB.ob3, 2);
      }
      obData = {ob1: p(window.ob1Hours.value), ob2: p(window.ob2Hours.value), ob3: p(window.ob3Hours.value)};
    } else {
      obData = {ob1: p(window.ob1Hours.value), ob2: p(window.ob2Hours.value), ob3: p(window.ob3Hours.value)};
    }
  }

  const otH = p(window.otHours.value), otEnkelH = p(window.otEnkelHours.value);
  const ob1Amount = Math.round(obData.ob1 * ob1RatePerHour);
  const ob2Amount = Math.round(obData.ob2 * ob2RatePerHour);
  const ob3Amount = Math.round(obData.ob3 * ob3RatePerHour);
  const otAmount = Math.round(otH * otRatePerHour);
  const otEnkelAmount = Math.round(otEnkelH * otEnkelRatePerHour);
  const totalOBOnly = ob1Amount + ob2Amount + ob3Amount;
  const totalOBOnlyHours = obData.ob1 + obData.ob2 + obData.ob3;
  const totalOB = totalOBOnly + otAmount + otEnkelAmount;

  const sjukOb1H = sickVisible ? p(window.sjukOb1Hours.value) : 0;
  const sjukOb2H = sickVisible ? p(window.sjukOb2Hours.value) : 0;
  const sjukOb3H = sickVisible ? p(window.sjukOb3Hours.value) : 0;
  const sjukOb1Loss = f2(sjukOb1H * ob1RatePerHour * 0.2);
  const sjukOb2Loss = f2(sjukOb2H * ob2RatePerHour * 0.2);
  const sjukOb3Loss = f2(sjukOb3H * ob3RatePerHour * 0.2);
  const totalSjukOB = f2(sjukOb1Loss + sjukOb2Loss + sjukOb3Loss);

  const totalBeforeKarens = obGroundingBase + totalOB + semesterTillagg;
  const jobbBrutto = f2(totalBeforeKarens - totalSickLoss - totalSjukOB - vabParentalDeduction);
  const tax = taxFromTable33Col1(jobbBrutto);
  const netBeforeFack = f2(jobbBrutto - tax);
  const unionFee = calcUnion(jobbBrutto);
  const jobbNetto = f2(netBeforeFack - unionFee);
  const netSalary = f2(jobbNetto + totalErsattningNetto);

  return {
    baseSalary, selectedYear, selectedMonth, karensDays, lag, isAuto,
    sickVisible, extraSick, totalVABParental, vacationCount,
    driftAddition, obGroundingBase,
    ob1RatePerHour, ob2RatePerHour, ob3RatePerHour, otRatePerHour, otEnkelRatePerHour,
    semesterSupplementPerDay, semesterTillagg,
    karensDeduction, totalSickLoss,
    vabParentalDeduction, totalErsattningNetto,
    obYear, obMonth, lockEnabled, obData, autoOB,
    ob1Amount, ob2Amount, ob3Amount, otAmount, otEnkelAmount,
    totalOBOnly, totalOBOnlyHours, totalOB,
    sjukOb1Loss, sjukOb2Loss, sjukOb3Loss, totalSjukOB,
    jobbBrutto, tax, netBeforeFack, unionFee, jobbNetto, netSalary
  };
}

function renderUI(data) {
  const lagName = {A:'Lag A',B:'Lag B',C:'Lag C',D:'Lag D',E:'Lag E'}[data.lag] || 'Manuell';

  if (data.sickVisible) {
    window.sjukOBContainer.classList.add('visible');
    window.sickHoursContainer.classList.add('visible');
  } else {
    window.sjukOBContainer.classList.remove('visible');
    window.sickHoursContainer.classList.remove('visible');
  }
  window.vabSummary.style.display = data.totalVABParental > 0 ? 'flex' : 'none';

  window.obGroundingDisplay.innerText = fc(data.obGroundingBase) + ' kr';

  window.ob1Rate.innerText = '/460 = ' + fd(data.ob1RatePerHour, 2) + ' kr/h';
  window.ob2Rate.innerText = '/260 = ' + fd(data.ob2RatePerHour, 2) + ' kr/h';
  window.ob3Rate.innerText = '/150 = ' + fd(data.ob3RatePerHour, 2) + ' kr/h';
  window.otRate.innerText = '/72 = ' + fd(data.otRatePerHour, 2) + ' kr/h';
  window.otEnkelRate.innerText = '/94 = ' + fd(data.otEnkelRatePerHour, 2) + ' kr/h';

  window.lockLabel.innerText = data.lockEnabled ? 'Låst' : 'Lås';
  window.ob1Hours.disabled = data.lockEnabled;
  window.ob2Hours.disabled = data.lockEnabled;
  window.ob3Hours.disabled = data.lockEnabled;
  if (data.isAuto && data.lockEnabled && !manualOBOverride) {
    window.ob1Hours.value = fd(data.autoOB.ob1, 2);
    window.ob2Hours.value = fd(data.autoOB.ob2, 2);
    window.ob3Hours.value = fd(data.autoOB.ob3, 2);
  }

  window.selectedPeriod.innerText =
    MONTHS[data.selectedMonth-1] + ' ' + data.selectedYear +
    ' · ' + data.karensDays + ' karensdag' + (data.karensDays !== 1 ? 'ar' : '') +
    (data.extraSick > 0 ? ' +' + fd(data.extraSick, 1) + 'h sjuk' : '') +
    ' · ' + lagName;

  window.tableMonthLabel.innerText =
    data.isAuto ? MONTHS[data.obMonth-1] + ' ' + data.obYear : '—';

  window.finalNetSalary.innerText = fc(data.netSalary) + ' kr';
  window.overviewTotalNet.innerText = fc(data.netSalary) + ' kr';

  // Översikt (samma som tidigare)
  let obOTHTML = '';
  if (data.totalOBOnlyHours > 0) {
    obOTHTML = '<div class="expandable-chip" onclick="toggleExpand(this)">' +
      '<div class="expandable-header"><span>Totalt OB</span><span>' + fd(data.totalOBOnlyHours, 2) + 'h / +' + fc(data.totalOBOnly) + ' kr <span class="expandable-arrow">▼</span></span></div>' +
      '<div class="expandable-details">' +
      '<div class="tax-detail-row">OB1 (' + fd(data.obData.ob1, 2) + 'h x ' + fd(data.ob1RatePerHour, 2) + ' kr): +' + fc(data.ob1Amount) + ' kr</div>' +
      '<div class="tax-detail-row">OB2 (' + fd(data.obData.ob2, 2) + 'h x ' + fd(data.ob2RatePerHour, 2) + ' kr): +' + fc(data.ob2Amount) + ' kr</div>' +
      '<div class="tax-detail-row">OB3 (' + fd(data.obData.ob3, 2) + 'h x ' + fd(data.ob3RatePerHour, 2) + ' kr): +' + fc(data.ob3Amount) + ' kr</div>' +
      '<div class="tax-detail-row total">Summa OB: ' + fd(data.totalOBOnlyHours, 2) + 'h / +' + fc(data.totalOBOnly) + ' kr</div>' +
      '</div></div>';
  }
  if (data.otAmount > 0) obOTHTML += '<div class="detail-chip"><span>Övertid (' + fd(data.otH || p(window.otHours.value), 2) + 'h x ' + fd(data.otRatePerHour, 2) + ' kr)</span><span>+' + fc(data.otAmount) + ' kr</span></div>';
  if (data.otEnkelAmount > 0) obOTHTML += '<div class="detail-chip"><span>ÖT enkel (' + fd(data.otEnkelH || p(window.otEnkelHours.value), 2) + 'h x ' + fd(data.otEnkelRatePerHour, 2) + ' kr)</span><span>+' + fc(data.otEnkelAmount) + ' kr</span></div>';

  let karensHTML = data.karensDays > 0 ? '<div class="detail-chip danger"><span>Karens</span><span>' + data.karensDays + ' dag' + (data.karensDays > 1 ? 'ar' : '') + '</span></div>' : '';
  let extraSickHTML = data.extraSick > 0 ? '<div class="detail-chip danger"><span>Sjuktimmar</span><span>' + fd(data.extraSick, 1) + 'h (netto -20%)</span></div>' : '';
  let sjukObHTML = data.totalSjukOB > 0 ? '<div class="detail-chip danger"><span>Sjuk-OB förlust</span><span>-' + fc(data.totalSjukOB) + ' kr</span></div>' : '';
  let vabHTML = data.totalVABParental > 0 ? '<div class="detail-chip danger"><span>VAB/F-ledig avdrag</span><span>-' + fc(data.vabParentalDeduction) + ' kr</span></div>' : '';
  let semesterHTML = data.vacationCount > 0 ? '<div class="detail-chip info"><span>Semestertillägg (' + data.vacationCount + ' dgr, ' + fd(data.semesterSupplementPerDay, 2) + ' kr/d)</span><span>+' + fc(data.semesterTillagg) + ' kr</span></div>' : '';
  let bidragHTML = (data.totalVABParental > 0 || window.ftpDays.value > 0) ? '<div class="detail-chip success"><span>FK/AFA netto</span><span>+' + fc(data.totalErsattningNetto) + ' kr</span></div>' : '';

  let detailHTML =
    '<div class="detail-chip"><span>Grundlön</span><span>' + fc(data.baseSalary) + ' kr</span></div>' +
    '<div class="detail-chip"><span>OB-grundande</span><span>' + fc(data.obGroundingBase) + ' kr</span></div>' +
    obOTHTML +
    semesterHTML +
    karensHTML + extraSickHTML + sjukObHTML + vabHTML + bidragHTML +
    '<div class="detail-chip"><span>Bruttolön jobb</span><span>' + fc(data.jobbBrutto) + ' kr</span></div>' +
    '<div class="detail-chip"><span>Skatt (tabell 33)</span><span>-' + fc(data.tax) + ' kr</span></div>' +
    '<div class="detail-chip"><span>Nettolön före fack</span><span>' + fc(data.netBeforeFack) + ' kr</span></div>' +
    '<div class="detail-chip"><span>IF Metall</span><span>-' + fc(data.unionFee) + ' kr</span></div>' +
    '<div class="detail-chip"><span>Nettolön jobb</span><span>' + fc(data.jobbNetto) + ' kr</span></div>';
  if (data.totalErsattningNetto > 0) detailHTML += '<div class="detail-chip success"><span>Nettolön bidrag</span><span>+' + fc(data.totalErsattningNetto) + ' kr</span></div>';
  detailHTML += '<div class="detail-chip success"><strong>Totalt netto: ' + fc(data.netSalary) + ' kr</strong></div>';

  window.detailGrid.innerHTML = detailHTML;

  // Dagsschema
  if (data.isAuto) {
    let daysInMonth = new Date(data.obYear, data.obMonth, 0).getDate();
    let shiftNames = ['Ledig', 'Dag', 'Natt'];
    let tbody = '';
    for (let d = 1; d <= daysInMonth; d++) {
      let date = new Date(data.obYear, data.obMonth - 1, d);
      let dateStr = date.toISOString().split('T')[0];
      let fromvaroVal = fromvaroMap.get(dateStr) || 0;
      let shift = getShift(date, data.lag);
      let ob = calcOB(date, shift, data.lag);
      let isPerm = isPermissionDay(date, data.lag);
      if (fromvaroVal !== 0) ob = {ob1:0, ob2:0, ob3:0};
      let dayName = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör'][date.getDay()];
      let shiftText = isPerm ? 'Perm' : shiftNames[shift];
      if (shiftOverrideMap.has(dateStr) && !isPerm) shiftText += '*';
      let fromvaroText = '';
      if (fromvaroVal === 1) fromvaroText = 'Semester';
      else if (fromvaroVal === 2) fromvaroText = 'VAB';
      else if (fromvaroVal === 3) fromvaroText = 'F-ledig';
      let station = (data.lag === 'E') ? getStationE(date, shift, data.lag) : '-';
      let rowClass = '';
      if (shift > 0 && !isPerm && fromvaroVal === 0) rowClass = 'row-active';
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
      tbody += `<tr class="${rowClass}"><td>${d} ${dayName}</td><td>${shiftText}</td><td>${fd(ob.ob1,2)}h</td><td>${fd(ob.ob2,2)}h</td><td>${fd(ob.ob3,2)}h</td><td>${fromvaroCell}</td><td>${station}</td><td>${passSelect}</td></tr>`;
    }
    window.tableBody.innerHTML = tbody;
  } else {
    window.tableBody.innerHTML = '<tr><td colspan="8">Välj ett lag</td></tr>';
  }
}

function updateUI() {
  const data = calculateEverything();
  renderUI(data);
}

// Exponera updateUI globalt så att ui.js kan anropa den
window.updateUI = updateUI;

// Starta gränssnittet – populateSelectors har redan körts i ui.js
updateUI();

});

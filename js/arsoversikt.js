function updateYearSummary() {
  const y = parseInt(yearSelect.value);
  const lag = lagSelect.value;
  if (lag === 'manual' || lag === '') {
    document.getElementById('yearSummaryGrid').innerHTML = 'Välj lag';
    return;
  }
  document.getElementById('yearSummaryYear').innerText = y;

  const bs = p(salaryInput.value) || 0;
  const da = Math.round(bs * DRIFT / 100);
  const obBase = bs + da;
  const o1r = obBase / O1D;
  const o2r = obBase / O2D;
  const o3r = obBase / O3D;

  let totBrutto = 0, totNetto = 0, totSkatt = 0, totFack = 0, totOB = 0;
  for (let m = 1; m <= 12; m++) {
    const obData = getOBForMonth(y, m, lag);
    const ob1Amt = Math.round(obData.ob1 * o1r);
    const ob2Amt = Math.round(obData.ob2 * o2r);
    const ob3Amt = Math.round(obData.ob3 * o3r);
    const mOB = ob1Amt + ob2Amt + ob3Amt;
    totOB += mOB;
    const jb = obBase + mOB;
    const tax = taxFromTable33Col1(jb);
    const uf = calcUnion(jb);
    const net = jb - tax - uf;
    totBrutto += jb;
    totNetto += net;
    totSkatt += tax;
    totFack += uf;
  }

  document.getElementById('yearSummaryGrid').innerHTML =
    `<div>Total bruttolön: ${fc(totBrutto)} kr</div>` +
    `<div>Total nettolön: ${fc(totNetto)} kr</div>` +
    `<div>Total skatt: -${fc(totSkatt)} kr</div>` +
    `<div>Fackavgift: -${fc(totFack)} kr</div>` +
    `<div>Totalt OB: +${fc(totOB)} kr</div>`;
}

window.updateYearSummary = updateYearSummary;

document.addEventListener('DOMContentLoaded', function () {

  // ---------- Toggle-funktioner ----------
  function toggleExpand(el) {
    const d = el.querySelector('.expandable-details');
    const a = el.querySelector('.expandable-arrow');
    d.classList.toggle('open');
    a.classList.toggle('open');
  }

  function toggleTheme() {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  function toggleVAB() {
    const c = document.getElementById('vabContent');
    const a = document.getElementById('vabArrow');
    c.classList.toggle('open');
    a.innerText = c.classList.contains('open') ? '▲' : '▼';
  }

  function toggleOB() {
    const c = document.getElementById('obContent');
    const a = document.getElementById('obArrow');
    c.classList.toggle('open');
    a.innerText = c.classList.contains('open') ? '▲' : '▼';
  }

  function toggleOverview() {
    const c = document.getElementById('overviewContent');
    c.style.display = c.style.display === 'none' ? 'block' : 'none';
  }

  function toggleYearSummary() {
    const d = document.getElementById('yearDetails');
    const a = document.getElementById('yearArrow');
    if (d.style.display === 'none') {
      d.style.display = 'block';
      a.innerText = '▲';
      window.updateYearSummary();   // global från arsoversikt.js
    } else {
      d.style.display = 'none';
      a.innerText = '▼';
    }
  }

  // Exponera för HTML onclick
  window.toggleExpand = toggleExpand;
  window.toggleTheme = toggleTheme;
  window.toggleVAB = toggleVAB;
  window.toggleOB = toggleOB;
  window.toggleOverview = toggleOverview;
  window.toggleYearSummary = toggleYearSummary;

  // ---------- Populate selectors ----------
  function populateSelectors() {
    const SY = 2026, EY = 2036;
    const MONTHS = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];

    const yearSelect = document.getElementById('yearSelect');
    for (let y = SY; y <= EY; y++) {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      yearSelect.appendChild(o);
    }

    const monthSelect = document.getElementById('monthSelect');
    MONTHS.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = i + 1;
      o.textContent = m;
      monthSelect.appendChild(o);
    });

    const now = new Date();
    yearSelect.value = Math.max(SY, Math.min(EY, now.getFullYear()));
    monthSelect.value = now.getMonth() + 1;
  }
  window.populateSelectors = populateSelectors;
  populateSelectors();   // kör direkt för att fylla listorna

  // ---------- Hämta alla DOM-element och gör dem globala ----------
  window.lagSelect = document.getElementById('lagSelect');
  window.salaryInput = document.getElementById('salaryInput');
  window.yearSelect = document.getElementById('yearSelect');
  window.monthSelect = document.getElementById('monthSelect');
  window.karensSelect = document.getElementById('karensSelect');
  window.otHours = document.getElementById('otHours');
  window.otEnkelHours = document.getElementById('otEnkelHours');
  window.ob1Hours = document.getElementById('ob1Hours');
  window.ob2Hours = document.getElementById('ob2Hours');
  window.ob3Hours = document.getElementById('ob3Hours');
  window.sjukOb1Hours = document.getElementById('sjukOb1Hours');
  window.sjukOb2Hours = document.getElementById('sjukOb2Hours');
  window.sjukOb3Hours = document.getElementById('sjukOb3Hours');
  window.sickHours = document.getElementById('sickHours');
  window.ftpDays = document.getElementById('ftpDays');
  window.sgiInput = document.getElementById('sgiInput');
  window.ob1Rate = document.getElementById('ob1Rate');
  window.ob2Rate = document.getElementById('ob2Rate');
  window.ob3Rate = document.getElementById('ob3Rate');
  window.otRate = document.getElementById('otRate');
  window.otEnkelRate = document.getElementById('otEnkelRate');
  window.selectedPeriod = document.getElementById('selectedPeriod');
  window.finalNetSalary = document.getElementById('finalNetSalary');
  window.detailGrid = document.getElementById('detailGrid');
  window.tableBody = document.querySelector('#salaryTable tbody');
  window.tableMonthLabel = document.getElementById('tableMonthLabel');
  window.obGroundingDisplay = document.getElementById('obGroundingDisplay');
  window.sjukOBContainer = document.getElementById('sjukOBContainer');
  window.sickHoursContainer = document.getElementById('sickHoursContainer');
  window.lockLabel = document.getElementById('lockLabel');
  window.vabSummary = document.getElementById('vabSummary');
  window.vabInfo = document.getElementById('vabInfo');
  window.yearSummaryYear = document.getElementById('yearSummaryYear');
  window.yearSummaryGrid = document.getElementById('yearSummaryGrid');
  window.obLockToggle = document.getElementById('obLockToggle');
  window.overviewTotalNet = document.getElementById('overviewTotalNet');

  // ---------- Knyt eventlyssnare ----------
  // (updateUI måste vara global – den sätts i script.js)
  lagSelect.addEventListener('change', window.updateUI);
  salaryInput.addEventListener('input', window.updateUI);
  yearSelect.addEventListener('change', window.updateUI);
  monthSelect.addEventListener('change', window.updateUI);
  karensSelect.addEventListener('change', window.updateUI);
  otHours.addEventListener('input', window.updateUI);
  otEnkelHours.addEventListener('input', window.updateUI);
  ob1Hours.addEventListener('input', window.updateUI);
  ob2Hours.addEventListener('input', window.updateUI);
  ob3Hours.addEventListener('input', window.updateUI);
  sjukOb1Hours.addEventListener('input', window.updateUI);
  sjukOb2Hours.addEventListener('input', window.updateUI);
  sjukOb3Hours.addEventListener('input', window.updateUI);
  sickHours.addEventListener('input', window.updateUI);
  ftpDays.addEventListener('change', window.updateUI);
  sgiInput.addEventListener('input', window.updateUI);
  obLockToggle.addEventListener('change', window.updateUI);

  // Frånvaro / skift – funktioner finns globalt (script.js)
  window.setFromvaro = window.setFromvaro || function(){};
  window.changeShift = window.changeShift || function(){};
  window.resetSchema = window.resetSchema || function(){};
  window.resetAllShifts = window.resetAllShifts || function(){};
  window.resetOB = window.resetOB || function(){};

});

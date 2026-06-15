// -------------------------------------------------------------------
// Scenariohanterare – Spara/ladda/ta bort inställningar i localStorage
// -------------------------------------------------------------------

const STORAGE_KEY = 'loneprognos_scenarios';

// Hjälp: hämta hela scenariolistan från localStorage
function getAllScenarios() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

// Hjälp: spara hela scenariolistan till localStorage
function saveAllScenarios(scenarios) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

// Bygg upp ett tillståndsobjekt från nuvarande gränssnitt
function getCurrentState() {
  return {
    salary: window.salaryInput.value,
    lag: window.lagSelect.value,
    karensDays: window.karensSelect.value,
    sickHours: window.sickHours.value,
    sjukOb1: window.sjukOb1Hours.value,
    sjukOb2: window.sjukOb2Hours.value,
    sjukOb3: window.sjukOb3Hours.value,
    sgi: window.sgiInput.value,
    ftpDays: window.ftpDays.value,
    ob1: window.ob1Hours.value,
    ob2: window.ob2Hours.value,
    ob3: window.ob3Hours.value,
    ot: window.otHours.value,
    otEnkel: window.otEnkelHours.value,
    year: window.yearSelect.value,
    month: window.monthSelect.value,
    lockEnabled: window.obLockToggle.checked,
    // Frånvaro och skiftöverstyrningar – sparas som arrayer
    fromvaro: Array.from(fromvaroMap.entries()),
    shiftOverrides: Array.from(shiftOverrideMap.entries()),
    // VAB-sektionen öppen/stängd sparas inte – den får vara stängd vid laddning
  };
}

// Återställ gränssnittet från ett tillståndsobjekt
function applyState(state) {
  window.salaryInput.value = state.salary;
  window.lagSelect.value = state.lag;
  window.karensSelect.value = state.karensDays;
  window.sickHours.value = state.sickHours || '';
  window.sjukOb1Hours.value = state.sjukOb1 || '';
  window.sjukOb2Hours.value = state.sjukOb2 || '';
  window.sjukOb3Hours.value = state.sjukOb3 || '';
  window.sgiInput.value = state.sgi;
  window.ftpDays.value = state.ftpDays;
  window.ob1Hours.value = state.ob1 || '';
  window.ob2Hours.value = state.ob2 || '';
  window.ob3Hours.value = state.ob3 || '';
  window.otHours.value = state.ot || '';
  window.otEnkelHours.value = state.otEnkel || '';
  window.yearSelect.value = state.year;
  window.monthSelect.value = state.month;
  window.obLockToggle.checked = state.lockEnabled;

  // Rensa och återställ frånvaro och skiftöverstyrningar
  fromvaroMap.clear();
  if (state.fromvaro) {
    for (const [key, val] of state.fromvaro) {
      fromvaroMap.set(key, val);
    }
  }
  shiftOverrideMap.clear();
  if (state.shiftOverrides) {
    for (const [key, val] of state.shiftOverrides) {
      shiftOverrideMap.set(key, val);
    }
  }

  // Återställ den manuella överstyrningsflaggan (så att lås/reset fungerar rätt)
  // Vi sätter manualOBOverride till false – eftersom vi laddar ett helt nytt tillstånd.
  // (Om du vill bevara den exakta flaggan skulle vi behöva spara den också, men
  // det är enklare att nollställa den vid laddning.)
  if (typeof manualOBOverride !== 'undefined') {
    manualOBOverride = false;
  }

  // Uppdatera gränssnittet med de nya värdena
  if (window.updateUI) {
    window.updateUI();
  }
}

// ---------- Globala funktioner (anropas från HTML) ----------

// Uppdatera dropdownen med alla scenarionamn
function updateScenarioList() {
  const select = document.getElementById('scenarioSelect');
  if (!select) return;
  const scenarios = getAllScenarios();
  select.innerHTML = '<option value="">-- Välj scenario --</option>';
  for (const name of Object.keys(scenarios)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

// Spara nuvarande tillstånd med ett namn
window.saveScenario = function () {
  const nameInput = document.getElementById('scenarioName');
  const name = nameInput.value.trim();
  if (!name) {
    alert('Ange ett namn på scenariot.');
    return;
  }
  const state = getCurrentState();
  const scenarios = getAllScenarios();
  scenarios[name] = state;
  saveAllScenarios(scenarios);
  updateScenarioList();
  nameInput.value = '';
};

// Ladda valt scenario
window.loadScenario = function () {
  const select = document.getElementById('scenarioSelect');
  const name = select.value;
  if (!name) {
    alert('Välj ett scenario att ladda.');
    return;
  }
  const scenarios = getAllScenarios();
  const state = scenarios[name];
  if (!state) {
    alert('Scenariot kunde inte hittas.');
    return;
  }
  applyState(state);
};

// Ta bort valt scenario
window.deleteScenario = function () {
  const select = document.getElementById('scenarioSelect');
  const name = select.value;
  if (!name) {
    alert('Välj ett scenario att ta bort.');
    return;
  }
  if (!confirm(`Är du säker på att du vill ta bort scenariot "${name}"?`)) {
    return;
  }
  const scenarios = getAllScenarios();
  delete scenarios[name];
  saveAllScenarios(scenarios);
  updateScenarioList();
};

// Nollställ formuläret (rensa alla fält, inte spara)
window.resetAll = function () {
  if (confirm('Vill du verkligen nollställa alla fält? Detta går inte att ångra.')) {
    // Återställ alla inputs
    window.salaryInput.value = 37664;
    window.lagSelect.value = 'E';
    window.karensSelect.value = '0';
    window.sickHours.value = '';
    window.sjukOb1Hours.value = '';
    window.sjukOb2Hours.value = '';
    window.sjukOb3Hours.value = '';
    window.sgiInput.value = 592000;
    window.ftpDays.value = '0';
    window.ob1Hours.value = '';
    window.ob2Hours.value = '';
    window.ob3Hours.value = '';
    window.otHours.value = '';
    window.otEnkelHours.value = '';
    window.yearSelect.value = new Date().getFullYear();
    window.monthSelect.value = new Date().getMonth() + 1;
    window.obLockToggle.checked = true;
    fromvaroMap.clear();
    shiftOverrideMap.clear();
    if (typeof manualOBOverride !== 'undefined') manualOBOverride = false;
    if (window.updateUI) window.updateUI();
  }
};

// När sidan laddats, fyll i listan
document.addEventListener('DOMContentLoaded', function () {
  updateScenarioList();
});

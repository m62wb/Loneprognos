// ---------- Profilhanterare (tidigare scenarier) ----------
const STORAGE_KEY = 'loneprognos_profiler';

function getAllProfiles() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveAllProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function getCurrentState() {
  return {
    salary: salaryInput.value,
    lag: lagSelect.value,
    karensDays: karensSelect.value,
    sickHours: sickHours.value,
    sjukOb1: sjukOb1Hours.value,
    sjukOb2: sjukOb2Hours.value,
    sjukOb3: sjukOb3Hours.value,
    sgi: sgiInput.value,
    ftpDays: ftpDays.value,
    ob1: ob1Hours.value,
    ob2: ob2Hours.value,
    ob3: ob3Hours.value,
    ot: otHours.value,
    otEnkel: otEnkelHours.value,
    year: yearSelect.value,
    month: monthSelect.value,
    lockEnabled: obLockToggle.checked,
    fromvaro: Array.from(fromvaroMap.entries()),
    shiftOverrides: Array.from(shiftOverrideMap.entries()),
  };
}

function applyState(state) {
  salaryInput.value = state.salary;
  lagSelect.value = state.lag;
  karensSelect.value = state.karensDays;
  sickHours.value = state.sickHours || '';
  sjukOb1Hours.value = state.sjukOb1 || '';
  sjukOb2Hours.value = state.sjukOb2 || '';
  sjukOb3Hours.value = state.sjukOb3 || '';
  sgiInput.value = state.sgi;
  ftpDays.value = state.ftpDays;
  ob1Hours.value = state.ob1 || '';
  ob2Hours.value = state.ob2 || '';
  ob3Hours.value = state.ob3 || '';
  otHours.value = state.ot || '';
  otEnkelHours.value = state.otEnkel || '';
  yearSelect.value = state.year;
  monthSelect.value = state.month;
  obLockToggle.checked = state.lockEnabled;

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

  if (typeof manualOBOverride !== 'undefined') {
    manualOBOverride = false;
  }

  if (typeof updateUI === 'function') {
    updateUI();
  }
}

function updateProfileList() {
  const select = document.getElementById('profileSelect');
  if (!select) return;
  const profiles = getAllProfiles();
  select.innerHTML = '<option value="">-- Välj profil --</option>';
  for (const name of Object.keys(profiles)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

// Globala funktioner för HTML-knapparna
window.saveProfile = function () {
  const nameInput = document.getElementById('profileName');
  const name = nameInput.value.trim();
  if (!name) {
    alert('Ange ett namn på profilen.');
    return;
  }
  const state = getCurrentState();
  const profiles = getAllProfiles();
  profiles[name] = state;
  saveAllProfiles(profiles);
  updateProfileList();
  nameInput.value = '';
};

window.loadProfile = function () {
  const select = document.getElementById('profileSelect');
  const name = select.value;
  if (!name) return;
  const profiles = getAllProfiles();
  const state = profiles[name];
  if (!state) {
    alert('Profilen kunde inte hittas.');
    return;
  }
  applyState(state);
};

window.deleteProfile = function () {
  const select = document.getElementById('profileSelect');
  const name = select.value;
  if (!name) {
    alert('Välj en profil att ta bort.');
    return;
  }
  if (!confirm(`Är du säker på att du vill ta bort profilen "${name}"?`)) {
    return;
  }
  const profiles = getAllProfiles();
  delete profiles[name];
  saveAllProfiles(profiles);
  updateProfileList();
};

window.resetAll = function () {
  if (confirm('Vill du verkligen nollställa alla fält? Detta går inte att ångra.')) {
    salaryInput.value = 37664;
    lagSelect.value = 'E';
    karensSelect.value = '0';
    sickHours.value = '';
    sjukOb1Hours.value = '';
    sjukOb2Hours.value = '';
    sjukOb3Hours.value = '';
    sgiInput.value = 592000;
    ftpDays.value = '0';
    ob1Hours.value = '';
    ob2Hours.value = '';
    ob3Hours.value = '';
    otHours.value = '';
    otEnkelHours.value = '';
    yearSelect.value = new Date().getFullYear();
    monthSelect.value = new Date().getMonth() + 1;
    obLockToggle.checked = true;
    fromvaroMap.clear();
    shiftOverrideMap.clear();
    if (typeof manualOBOverride !== 'undefined') manualOBOverride = false;
    if (typeof updateUI === 'function') updateUI();
  }
};

// Fyll listan när sidan laddas
window.addEventListener('DOMContentLoaded', function () {
  updateProfileList();
});

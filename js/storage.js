const STORAGE_KEY = 'loneprognos_profiler_v3';
const AUTOSAVE_KEY = 'loneprognos_autosave_v1';

function getAllProfiles() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}
function saveAllProfiles(profiles) { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); }

function getCurrentState() {
  return {
    salary: salaryInput.value, lag: lagSelect.value,
    sickHours: '', sjukOb1: '', sjukOb2: '', sjukOb3: '',
    sgi: sgiInput.value, ftpDays: ftpDays.value,
    ob1: ob1Hours.value, ob2: ob2Hours.value, ob3: ob3Hours.value,
    ot: otHours.value, otEnkel: otEnkelHours.value,
    year: yearSelect.value, month: monthSelect.value, lockEnabled: obLockToggle.checked,
    fromvaro: Array.from(fromvaroMap.entries()),
    shiftOverrides: Array.from(shiftOverrideMap.entries()),
    vacationOverrides: Array.from(vacationOverrideMap.entries()),
    sickDetails: Array.from(sickDetailMap.entries())
  };
}

function applyState(state) {
  window.isLoadingProfile = true;
  salaryInput.value = state.salary; lagSelect.value = state.lag;
  sgiInput.value = state.sgi; ftpDays.value = state.ftpDays;
  ob1Hours.value = state.ob1 || ''; ob2Hours.value = state.ob2 || ''; ob3Hours.value = state.ob3 || '';
  otHours.value = state.ot || ''; otEnkelHours.value = state.otEnkel || '';
  yearSelect.value = state.year; monthSelect.value = state.month; obLockToggle.checked = state.lockEnabled;
  fromvaroMap.clear(); if (state.fromvaro) for (let [k,v] of state.fromvaro) fromvaroMap.set(k,v);
  shiftOverrideMap.clear(); if (state.shiftOverrides) for (let [k,v] of state.shiftOverrides) shiftOverrideMap.set(k,v);
  vacationOverrideMap.clear(); if (state.vacationOverrides) for (let [k,v] of state.vacationOverrides) vacationOverrideMap.set(k,v);
  sickDetailMap.clear(); if (state.sickDetails) for (let [k,v] of state.sickDetails) sickDetailMap.set(k,v);
  manualOBOverride = false;
  if (typeof updateUI === 'function') updateUI();
  window.isLoadingProfile = false;
}

function updateProfileList() {
  const select = document.getElementById('profileSelect');
  if (!select) return;
  const profiles = getAllProfiles();
  select.innerHTML = '<option value="">-- Välj profil --</option>';
  for (const name of Object.keys(profiles)) {
    const opt = document.createElement('option'); opt.value = name; opt.textContent = name; select.appendChild(opt);
  }
}

// ---------- NY PROFIL-POPUP (ersätter prompt) ----------
window.saveProfilePopup = function() {
  const dialog = document.getElementById('profileDialog');
  const nameInput = document.getElementById('profileName');
  const lagSelect = document.getElementById('profileLag');
  const salaryInput = document.getElementById('profileSalary');
  const saveBtn = document.getElementById('profileSaveBtn');
  const cancelBtn = document.getElementById('profileCancelBtn');

  // Fyll i nuvarande värden som förslag
  nameInput.value = '';
  lagSelect.value = document.getElementById('lagSelect').value || 'E';
  salaryInput.value = document.getElementById('salaryInput').value || '';

  dialog.showModal();

  // Rensa tidigare lyssnare
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  const newSaveBtn = document.getElementById('profileSaveBtn');
  const newCancelBtn = document.getElementById('profileCancelBtn');

  newCancelBtn.onclick = function() {
    dialog.close();
  };

  newSaveBtn.onclick = function() {
    const name = nameInput.value.trim();
    const lag = lagSelect.value;
    const salary = salaryInput.value.replace(',', '.').trim();

    if (!name || name === '') {
      alert('Ange ett namn.');
      return;
    }
    if (!salary || isNaN(parseFloat(salary))) {
      alert('Ange en giltig lön.');
      return;
    }

    // Sätt fälten så att state fångas korrekt
    document.getElementById('lagSelect').value = lag;
    document.getElementById('salaryInput').value = salary;

    const state = getCurrentState();
    const profiles = getAllProfiles();
    profiles[name] = state;
    saveAllProfiles(profiles);
    updateProfileList();
    document.getElementById('profileSelect').value = name;
    dialog.close();

    if (typeof updateUI === 'function') updateUI();
  };
};

window.loadScenario = function() {
  const select = document.getElementById('profileSelect');
  const name = select.value;
  if (!name) return;
  const profiles = getAllProfiles();
  const state = profiles[name];
  if (!state) { alert('Profilen kunde inte hittas.'); return; }
  applyState(state);
};

window.deleteScenario = function() {
  const select = document.getElementById('profileSelect');
  const name = select.value;
  if (!name) { alert('Välj en profil att ta bort.'); return; }
  if (!confirm(`Är du säker på att du vill ta bort profilen "${name}"?`)) return;
  const profiles = getAllProfiles();
  delete profiles[name];
  saveAllProfiles(profiles);
  updateProfileList();
};

window.resetAll = function() {
  if (confirm('Vill du verkligen nollställa alla fält? Detta går inte att ångra.')) {
    document.getElementById('salaryInput').value = 37664;
    document.getElementById('lagSelect').value = 'E';
    document.getElementById('sgiInput').value = 592000;
    document.getElementById('ftpDays').value = '0';
    document.getElementById('ob1Hours').value = '';
    document.getElementById('ob2Hours').value = '';
    document.getElementById('ob3Hours').value = '';
    document.getElementById('otHours').value = '';
    document.getElementById('otEnkelHours').value = '';
    document.getElementById('yearSelect').value = new Date().getFullYear();
    document.getElementById('monthSelect').value = new Date().getMonth() + 1;
    document.getElementById('obLockToggle').checked = true;
    fromvaroMap.clear(); shiftOverrideMap.clear(); vacationOverrideMap.clear(); sickDetailMap.clear();
    manualOBOverride = false;
    if (typeof updateUI === 'function') updateUI();
  }
};

window.addEventListener('DOMContentLoaded', function () {
  updateProfileList();
});

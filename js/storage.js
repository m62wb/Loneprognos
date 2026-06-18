const STORAGE_KEY = 'loneprognos_profiler_v3';
const AUTOSAVE_KEY = 'loneprognos_autosave_v1';

function getAllProfiles() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}
function saveAllProfiles(profiles) { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); }

function getCurrentState() {
  return {
    salary: salaryInput.value, lag: lagSelect.value, karensDays: karensSelect.value,
    sickHours: sickHours.value, sjukOb1: sjukOb1Hours.value, sjukOb2: sjukOb2Hours.value,
    sjukOb3: sjukOb3Hours.value, sgi: sgiInput.value, ftpDays: ftpDays.value,
    ob1: ob1Hours.value, ob2: ob2Hours.value, ob3: ob3Hours.value,
    ot: otHours.value, otEnkel: otEnkelHours.value,
    year: yearSelect.value, month: monthSelect.value, lockEnabled: obLockToggle.checked,
    fromvaro: Array.from(fromvaroMap.entries()),
    shiftOverrides: Array.from(shiftOverrideMap.entries()),
    vacationOverrides: Array.from(vacationOverrideMap.entries())
  };
}

function applyState(state) {
  // Blockera lagSelect‑rensning under hela återställningen
  window.isLoadingProfile = true;

  salaryInput.value = state.salary; lagSelect.value = state.lag;
  karensSelect.value = state.karensDays; sickHours.value = state.sickHours || '';
  sjukOb1Hours.value = state.sjukOb1 || ''; sjukOb2Hours.value = state.sjukOb2 || '';
  sjukOb3Hours.value = state.sjukOb3 || ''; sgiInput.value = state.sgi;
  ftpDays.value = state.ftpDays; ob1Hours.value = state.ob1 || '';
  ob2Hours.value = state.ob2 || ''; ob3Hours.value = state.ob3 || '';
  otHours.value = state.ot || ''; otEnkelHours.value = state.otEnkel || '';
  yearSelect.value = state.year; monthSelect.value = state.month;
  obLockToggle.checked = state.lockEnabled;

  fromvaroMap.clear();
  if (state.fromvaro) for (let [k,v] of state.fromvaro) fromvaroMap.set(k,v);
  shiftOverrideMap.clear();
  if (state.shiftOverrides) for (let [k,v] of state.shiftOverrides) shiftOverrideMap.set(k,v);
  if (typeof vacationOverrideMap !== 'undefined') {
    vacationOverrideMap.clear();
    if (state.vacationOverrides) for (let [k,v] of state.vacationOverrides) vacationOverrideMap.set(k,v);
  }
  manualOBOverride = false;

  if (typeof updateUI === 'function') updateUI();

  // Släpp flaggan när allt är klart
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

window.saveProfilePopup = function() { /* oförändrad */ };
window.loadScenario = function() { /* oförändrad */ };
window.deleteScenario = function() { /* oförändrad */ };
window.resetAll = function() { /* oförändrad */ };
window.addEventListener('DOMContentLoaded', function () { updateProfileList(); });

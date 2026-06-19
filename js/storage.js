// storage.js
const STORAGE_KEY = 'loneprognos_profiler_v3';
const AUTOSAVE_KEY = 'loneprognos_autosave_v1';

function getAllProfiles() { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
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
function updateProfileList() { /* ... */ }
window.saveProfilePopup = function() { /* ... */ };
window.loadScenario = function() { /* ... */ };
window.deleteScenario = function() { /* ... */ };
window.resetAll = function() { /* ... */ };
window.addEventListener('DOMContentLoaded', function () { updateProfileList(); });

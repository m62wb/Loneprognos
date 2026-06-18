function applyState(state) {
  isLoadingProfile = true;   // <-- förhindra lagbyte-rensning

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

  if (typeof vacationOverrideMap !== 'undefined') {
    vacationOverrideMap.clear();
    if (state.vacationOverrides) {
      for (const [key, val] of state.vacationOverrides) {
        vacationOverrideMap.set(key, val);
      }
    }
  }

  if (typeof manualOBOverride !== 'undefined') {
    manualOBOverride = false;
  }

  isLoadingProfile = false;  // <-- flagga av

  if (typeof updateUI === 'function') {
    updateUI();               // nu körs updateUI med fullständig data
  }
}

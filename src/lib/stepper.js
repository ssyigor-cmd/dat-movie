/**
 * Gerenciador de botões Stepper (incremento/decremento de episódios e temporadas)
 * com suporte a clique individual e clique-e-segure (hold timer).
 */

let holdTimeout = null;
let holdInterval = null;
let holdBtn = null;

export function updateStepperValue(btn, type, addSeasonLimits, detailSeasonLimits, addInputs, detailInputs) {
  if (!btn) return;
  const targetId = btn.dataset.target;
  const step = parseInt(btn.dataset.step) || 1;
  const hiddenInput = document.getElementById(targetId);
  const displaySpan = document.getElementById(targetId + 'Display');
  if (!hiddenInput || !displaySpan) return;

  let current = parseInt(hiddenInput.value) || 1;
  let newVal = current + step;
  const stepperType = btn.dataset.type;
  const limits = type === 'add' ? addSeasonLimits : detailSeasonLimits;
  const inputs = type === 'add' ? addInputs : detailInputs;

  if (stepperType === 'temp') {
    const maxTemp = limits.maxTemp || 1;
    if (newVal < 1) newVal = 1;
    if (newVal > maxTemp) newVal = maxTemp;
    hiddenInput.value = newVal;
    displaySpan.textContent = newVal;

    updateEpisodeLimit(stepperType, newVal, limits, inputs);
    if (inputs.epInput && inputs.epDisplay) {
      inputs.epInput.value = 1;
      inputs.epDisplay.textContent = 1;
    }
  } else if (stepperType === 'ep') {
    const currentTemp = parseInt(inputs.tempInput ? inputs.tempInput.value : 1) || 1;
    const maxEp = limits.maxEpByTemp?.[currentTemp] || 1;
    if (newVal < 1) newVal = 1;
    if (newVal > maxEp) newVal = maxEp;
    hiddenInput.value = newVal;
    displaySpan.textContent = newVal;
  }
}

export function updateEpisodeLimit(stepperType, temp, limits, inputs) {
  const maxEp = limits.maxEpByTemp?.[temp] || 1;
  if (!inputs || !inputs.epInput) return;
  const currentEp = parseInt(inputs.epInput.value) || 1;
  if (currentEp > maxEp) {
    inputs.epInput.value = maxEp;
    if (inputs.epDisplay) inputs.epDisplay.textContent = maxEp;
  }
}

export function clearHold() {
  if (holdTimeout) {
    clearTimeout(holdTimeout);
    holdTimeout = null;
  }
  if (holdInterval) {
    clearInterval(holdInterval);
    holdInterval = null;
  }
  holdBtn = null;
}

export function stopHold() {
  clearHold();
}

export function setupSteppers(containerSelector, modalType, onUpdateCallback) {
  const btns = document.querySelectorAll(containerSelector);
  btns.forEach(btn => {
    btn.dataset.modalType = modalType;

    const handleStepperClick = (e) => {
      onUpdateCallback(e.currentTarget, modalType);
    };

    const startHoldTimer = (targetBtn) => {
      if (holdBtn === targetBtn && (holdTimeout || holdInterval)) return;
      clearHold();
      holdBtn = targetBtn;
      holdTimeout = setTimeout(() => {
        onUpdateCallback(targetBtn, modalType);
        holdInterval = setInterval(() => {
          onUpdateCallback(targetBtn, modalType);
        }, 100);
        holdTimeout = null;
      }, 300);
    };

    const startHold = (e) => startHoldTimer(e.currentTarget);
    const startHoldTouch = (e) => {
      e.preventDefault();
      startHoldTimer(e.currentTarget);
    };

    btn.removeEventListener('click', btn._stepperClick);
    btn.removeEventListener('mousedown', btn._startHold);
    btn.removeEventListener('mouseup', stopHold);
    btn.removeEventListener('mouseleave', stopHold);
    btn.removeEventListener('touchstart', btn._startHoldTouch);
    btn.removeEventListener('touchend', stopHold);

    btn._stepperClick = handleStepperClick;
    btn._startHold = startHold;
    btn._startHoldTouch = startHoldTouch;

    btn.addEventListener('click', handleStepperClick);
    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', stopHold);
    btn.addEventListener('mouseleave', stopHold);
    btn.addEventListener('touchstart', startHoldTouch);
    btn.addEventListener('touchend', stopHold);
  });
}

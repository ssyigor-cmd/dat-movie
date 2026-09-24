import { lockScreen, unlockScreen, trapFocus, releaseFocusTrap } from './uiHelpers.js';

let confirmModal, confirmTitle, confirmMessage, confirmOk, confirmCancel, confirmClose;
let previousFocus = null;
let confirmResolver = null;

export function setupConfirmModal() {
  confirmModal = document.getElementById('confirmModal');
  confirmTitle = document.getElementById('confirmTitle');
  confirmMessage = document.getElementById('confirmMessage');
  confirmOk = document.getElementById('confirmOk');
  confirmCancel = document.getElementById('confirmCancel');
  confirmClose = document.getElementById('confirmClose');
  if (!confirmModal || !confirmOk) return;

  function close(result) {
    confirmModal.classList.remove('active');
    unlockScreen();
    releaseFocusTrap();
    // Re-trap detail modal if still open
    const detailModal = document.getElementById('detailModal');
    if (detailModal && detailModal.classList.contains('active')) {
      const m = detailModal.querySelector('.modal');
      if (m) trapFocus(m);
    }
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try { previousFocus.focus(); } catch (_) {}
    }
    if (confirmResolver) {
      const r = confirmResolver;
      confirmResolver = null;
      r(result);
    }
  }

  confirmOk.addEventListener('click', () => close(true));
  confirmCancel.addEventListener('click', () => close(false));
  confirmClose.addEventListener('click', () => close(false));
  confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) close(false); });
  document.addEventListener('keydown', (e) => {
    if (confirmModal.classList.contains('active') && e.key === 'Escape') {
      e.preventDefault();
      close(false);
    }
  });
}

export function showConfirm(message, title = 'Confirmar') {
  return new Promise((resolve) => {
    if (!confirmModal) {
      resolve(window.confirm(message));
      return;
    }
    previousFocus = document.activeElement;
    if (confirmTitle) confirmTitle.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
    if (confirmMessage) confirmMessage.textContent = message;
    confirmResolver = resolve;
    confirmModal.classList.add('active');
    lockScreen();
    const modalElem = confirmModal.querySelector('.modal');
    trapFocus(modalElem);
    // Focus confirm button
    setTimeout(() => { if (confirmCancel) confirmCancel.focus(); }, 0);
  });
}

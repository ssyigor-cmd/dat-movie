/**
 * Utilitários de Interface do Usuário (UI): Toast, Focus Trap, Screenlock, Canvas Orb e Validação de Formulário.
 */

let toastTimer = null;

/**
 * Exibe mensagem Toast na tela.
 * @param {HTMLElement} toastElem - Elemento DOM do toast.
 * @param {string} msg - Texto da mensagem.
 * @param {number} duration - Duração em milissegundos.
 */
export function showToast(toastElem, msg, duration = 2800) {
  if (!toastElem) return;
  toastElem.textContent = msg;
  toastElem.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElem.classList.remove('show'), duration);
}

/**
 * Exibe erro no console e gera uma mensagem de erro Toast para o usuário.
 * @param {HTMLElement} toastElem - Elemento DOM do toast.
 * @param {string} userMessage - Mensagem amigável ao usuário.
 * @param {Error} error - Objeto do erro original.
 * @param {number} duration - Duração em ms.
 */
export function showErrorToast(toastElem, userMessage, error, duration = 3000) {
  if (error) console.error(userMessage, error);
  showToast(toastElem, userMessage, duration);
}

// ========== SCREENLOCK (TRAVA DE ROLAGEM DE TELA) ==========
/**
 * Bloqueia a rolagem do corpo da página (body/html) ao abrir modais.
 */
export function lockScreen() {
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

/**
 * Restaura a rolagem da página se não houver nenhum modal ativo.
 */
export function unlockScreen() {
  const hasActiveModal = document.querySelector('.modal-overlay.active');
  if (!hasActiveModal) {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

// ========== FOCUS TRAP ==========
let activeFocusTrapHandler = null;
let lastFocusedBeforeModal = null;

/**
 * Prende o foco do teclado dentro do elemento modal fornecido.
 * @param {HTMLElement} modalRoot - Contêiner modal.
 */
export function trapFocus(modalRoot) {
  releaseFocusTrap();
  lastFocusedBeforeModal = document.activeElement;

  const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  activeFocusTrapHandler = function(e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(modalRoot.querySelectorAll(focusableSelector))
      .filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', activeFocusTrapHandler);

  const firstFocusable = modalRoot.querySelector(focusableSelector);
  if (firstFocusable) setTimeout(() => firstFocusable.focus(), 50);
}

/**
 * Libera a armadilha de foco e restaura a seleção para o elemento ativo anterior.
 */
export function releaseFocusTrap() {
  if (activeFocusTrapHandler) {
    document.removeEventListener('keydown', activeFocusTrapHandler);
    activeFocusTrapHandler = null;
  }
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
    lastFocusedBeforeModal.focus();
  }
  lastFocusedBeforeModal = null;
}

// ========== ANIMAÇÃO CANVAS ORB ==========
export function initOrb(containerId = 'orbIcon') {
  const container = document.getElementById(containerId);
  if (!container || container.querySelector('canvas')) return;

  const canvas = document.createElement('canvas');
  canvas.width = 28;
  canvas.height = 28;
  canvas.style.width = '28px';
  canvas.style.height = '28px';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const palette = ['#5EEAD4', '#7FF3E3', '#FFFFFF'];
  const center = { x: 14, y: 14 };
  const radius = 12;
  const particles = [];
  const count = 40;

  for (let i = 0; i < count; i++) {
    particles.push({
      angle: Math.random() * 2 * Math.PI,
      dist: radius * (0.3 + Math.random() * 0.7),
      speed: 0.005 + Math.random() * 0.01,
      phase: Math.random() * 2 * Math.PI,
      size: 1.5 + Math.random() * 2.5,
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }

  let time = 0;
  function draw() {
    time += 0.02;
    ctx.clearRect(0, 0, 28, 28);

    const grad = ctx.createRadialGradient(14, 14, 0, 14, 14, radius);
    grad.addColorStop(0, 'rgba(94, 234, 212, 0.25)');
    grad.addColorStop(1, 'rgba(94, 234, 212, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(14, 14, radius, 0, 2 * Math.PI);
    ctx.fill();

    particles.forEach(p => {
      const currentAngle = p.angle + time * p.speed;
      const currentDist = p.dist + Math.sin(time * 2 + p.phase) * 1.5;
      const x = center.x + Math.cos(currentAngle) * currentDist;
      const y = center.y + Math.sin(currentAngle) * currentDist;
      ctx.beginPath();
      ctx.arc(x, y, p.size * 0.6, 0, 2 * Math.PI);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const glow = ctx.createRadialGradient(14, 14, 0, 14, 14, 6);
    glow.addColorStop(0, 'rgba(255,255,255,0.6)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(14, 14, 6, 0, 2 * Math.PI);
    ctx.fill();

    requestAnimationFrame(draw);
  }
  draw();
}

// ========== VALIDAÇÃO DE CAMPOS ==========
export function setFieldError(input, message) {
  if (!input) return;
  input.classList.add('invalid');
  input.setAttribute('aria-invalid', 'true');
  const wrapper = input.closest('.form-group, .search-group, .auth-group, .info-block, .stepper');
  if (wrapper) {
    wrapper.classList.add('invalid');
    let errorEl = wrapper.querySelector('.field-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      wrapper.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }
}

export function clearFieldError(input) {
  if (!input) return;
  input.classList.remove('invalid');
  input.removeAttribute('aria-invalid');
  const wrapper = input.closest('.form-group, .search-group, .auth-group, .info-block, .stepper');
  if (wrapper) {
    wrapper.classList.remove('invalid');
    const errorEl = wrapper.querySelector('.field-error');
    if (errorEl) errorEl.remove();
  }
}

export function clearAllFieldErrors(container) {
  if (!container) return;
  container.querySelectorAll('.invalid').forEach(el => clearFieldError(el));
}

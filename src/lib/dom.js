/**
 * Referências centrais de elementos DOM.
 * Evita acesso repetido a document.getElementById e separa
 * a camada de UI da lógica de negócio.
 */

const $ = (id) => document.getElementById(id);

export const dom = {
  // Auth
  authContainer: $('authContainer'),
  authForm: $('authForm'),
  authTitle: $('authTitle'),
  authSubtitle: $('authSubtitle'),
  authEmail: $('authEmail'),
  authPassword: $('authPassword'),
  authName: $('authName'),
  authPasswordConfirm: $('authPasswordConfirm'),
  authRevealBtn: $('authRevealBtn'),
  authStrength: $('authStrength'),
  authSubmitBtn: $('authSubmitBtn'),
  authSwitchBtn: $('authSwitchBtn'),
  authSwitchText: $('authSwitchText'),
  authMessage: $('authMessage'),

// Grid / Search / Sections
  grid: $('grid'),
  gridSection: document.getElementById('gridSection'),
  searchView: document.getElementById('searchView'),
  pesquisaInput: $('pesquisaInput'),
  pesquisaGrid: $('pesquisaGrid'),
  pesquisaEmpty: $('pesquisaEmpty'),
  pesquisaLoading: $('pesquisaLoading'),
  searchInput: $('searchInput'),
  filterStatus: $('filterStatus'),
  filterTier: $('filterTier'),
  sortOrder: $('sortOrder'),

  // Modals
  titleInfoModal: $('titleInfoModal'),

  // Density
  densityToggleBtn: $('densityToggleBtn'),
  densityMenu: $('densityMenu'),
  densityOptions: document.querySelectorAll('.density-option'),

  // Lists

  // Filter wrappers
  statusWrapper: $('statusWrapper'),
  statusToggleBtn: $('statusToggleBtn'),
  statusMenu: $('statusMenu'),
  tierWrapper: $('tierWrapper'),
  tierToggleBtn: $('tierToggleBtn'),
  tierMenu: $('tierMenu'),
  sortToggleBtn: $('sortToggleBtn'),
  sortDirectionBtn: $('sortDirectionBtn'),
  sortMenu: $('sortMenu'),
  filterMenuOptions: document.querySelectorAll('.filter-option'),
  groupToggle: $('groupToggle'),

  // Navbar / Profile
  logoutBtn: $('logoutBtn'),
  homeSection: document.getElementById('homeSection'),
  profileToggle: $('profileToggle'),
  profileDropdown: $('profileDropdown'),
  profileName: $('profileName'),
  profileHeadName: $('profileHeadName'),
  profileEmailFull: $('profileEmailFull'),
  profileAvatar: $('profileAvatar'),
  profileNameView: $('profileNameView'),
  profileNameViewText: $('profileNameViewText'),
  profileNameEdit: $('profileNameEdit'),
  profileNameRow: $('profileNameRow'),
  profileNameInput: $('profileNameInput'),
  profileNameSave: $('profileNameSave'),
  profileNameCancel: $('profileNameCancel'),
  profileNameError: $('profileNameError'),
  showProgressBar: $('showProgressBar'),
  profileSince: $('profileSince'),

  // Navbar

  // Add modal fields
  // Stepper extras
  // Toast & Form
  // NOTA: 'form' já é declarado acima (grupo Auth/Form) — a duplicata aqui era
  // um no-op silencioso. ESLint (no-dupe-keys) pegou isso.
};

export default dom;

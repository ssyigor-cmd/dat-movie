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
  authEmail: $('authEmail'),
  authPassword: $('authPassword'),
  authLoginBtn: $('authLoginBtn'),
  authSignupBtn: $('authSignupBtn'),
  authMessage: $('authMessage'),

// Grid / Search / Sections
  grid: $('grid'),
  gridSection: document.getElementById('gridSection'),
  searchView: document.getElementById('searchView'),
  titlePageEl: $('titlePage'),
  pesquisaInput: $('pesquisaInput'),
  pesquisaGrid: $('pesquisaGrid'),
  pesquisaEmpty: $('pesquisaEmpty'),
  pesquisaLoading: $('pesquisaLoading'),
  searchInput: $('searchInput'),
  filterStatus: $('filterStatus'),
  filterTier: $('filterTier'),
  sortOrder: $('sortOrder'),

  // Modals
  modalOverlay: $('modalOverlay'),
  titleInfoModal: $('titleInfoModal'),
  modalClose: $('modalClose'),
  modalTitle: $('modalTitle'),
  form: $('form'),
  tipo: $('tipo'),
  statusSelect: $('status'),
  tierForm: $('tierForm'),
  btnSubmit: $('btnSubmit'),
  btnCancel: $('btnCancel'),
  addPanelDelete: $('addPanelDelete'),
  previewImg: $('previewImg'),
  previewImgCard: $('previewImgCard'),
  previewPlaceholder: $('previewPlaceholder'),
  formLoading: $('formLoading'),

  // Density
  densityToggleBtn: $('densityToggleBtn'),
  densityMenu: $('densityMenu'),
  densityOptions: document.querySelectorAll('.density-option'),

  // Lists
  addListToggle: $('addListToggle'),
  addListCheckboxes: $('addListCheckboxes'),
  addEpisodesBtn: $('addEpisodesBtn'),
  detailListToggle: $('detailListToggle'),
  detailListCheckboxes: $('detailListCheckboxes'),

  // Filter wrappers
  statusWrapper: $('statusWrapper'),
  statusToggleBtn: $('statusToggleBtn'),
  statusMenu: $('statusMenu'),
  tierWrapper: $('tierWrapper'),
  tierToggleBtn: $('tierToggleBtn'),
  tierMenu: $('tierMenu'),
  sortWrapper: $('sortWrapper'),
  sortToggleBtn: $('sortToggleBtn'),
  sortMenu: $('sortMenu'),
  filterMenuOptions: document.querySelectorAll('.filter-option'),
  groupToggle: $('groupToggle'),

  // Navbar / Profile
  logoutBtn: $('logoutBtn'),
  continueSection: $('continueSection'),
  continueGrid: $('continueGrid'),
  homeSection: document.getElementById('homeSection'),
  profileToggle: $('profileToggle'),
  profileDropdown: $('profileDropdown'),
  profileEmail: $('profileEmail'),
  profileEmailFull: $('profileEmailFull'),

  // Navbar
  navbar: document.getElementById('topNavbar'),
  navbarNav: document.getElementById('navbarNav'),
  headerListName: document.getElementById('headerListName'),

  // Add modal fields
  addTemporadaInput: $('addTemporada'),
  addEpisodioInput: $('addEpisodio'),
  addTemporadaDisplay: $('addTemporadaDisplay'),
  addEpisodioDisplay: $('addEpisodioDisplay'),
  addTierBadge: $('addTierBadge'),
  addTierDropdown: $('addTierDropdown'),
  addYearDisplay: $('addYearDisplay'),
  addLogoContainer: document.getElementById('addLogoContainer'),
  addLogoImg: document.getElementById('addLogoImg'),
  addOriginalTitle: $('addOriginalTitle'),
  addSinopse: document.getElementById('addSinopse'),
  addSinopseLoading: document.getElementById('addSinopseLoading'),
  addBlurBg: document.getElementById('addBlurBg'),
  addPosterWrap: document.getElementById('addPosterWrap'),
  modalTitleText: $('modalTitleText'),
  addPosterSteppersRow: $('addPosterSteppersRow'),
  // Relink modal
  relinkModal: $('relinkModal'),
  relinkResults: $('relinkResults'),
  relinkLoading: $('relinkLoading'),
  relinkSearch: $('relinkSearch'),
  relinkClose: $('relinkClose'),
  // Stepper extras
  addSeasonMax: $('addSeasonMax'),
  addSeasonName: $('addSeasonName'),
  addEpMax: $('addEpMax'),
  addEpTitle: $('addEpTitle'),
  addEpDate: $('addEpDate'),
  addEpOverview: $('addEpOverview'),
  addEpLoading: $('addEpLoading'),
  detailSeasonName: $('detailSeasonName'),
  detailAddedDate: $('detailAddedDate'),
  // List modals
  addListModal: $('addListModal'),
  detailListModal: $('detailListModal'),
  // Episodes & Confirm & Toast
  episodesModal: $('episodesModal'),
  episodesClose: $('episodesClose'),
  episodesTitle: $('episodesTitle'),
  episodesLoading: $('episodesLoading'),
  episodesContent: $('episodesContent'),
  confirmModal: $('confirmModal'),
  confirmMessage: $('confirmMessage'),
  confirmCancel: $('confirmCancel'),
  confirmOk: $('confirmOk'),
  // Toast & Form
  toast: document.getElementById('toast'),
  // NOTA: 'form' já é declarado acima (grupo Auth/Form) — a duplicata aqui era
  // um no-op silencioso. ESLint (no-dupe-keys) pegou isso.
};

export default dom;

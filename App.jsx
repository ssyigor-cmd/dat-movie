/* Dat-Movie — prévia mobile (390 × 844)
   Fonte de verdade visual: DESIGN.md + style.css do projeto.
   Dados, sessão e artes são de demonstração; nada chama Supabase nem TMDb. */

const TWEAK_SCHEMA = /*TWEAK-SCHEMA-BEGIN*/{
  "accentColor": { "kind": "color" },
  "density": { "kind": "enum", "options": ["comfortable", "compact"] },
  "device": { "kind": "enum", "options": ["frame", "fluid"] },
  "showNotes": { "kind": "boolean" }
}/*TWEAK-SCHEMA-END*/;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#E5D8BF",
  "density": "comfortable",
  "device": "frame",
  "showNotes": true
}/*EDITMODE-END*/;

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

/* ---------- dados de demonstração ---------- */

const SEED = [
  {
    id: 'ruptura', title: 'Ruptura', original: 'Severance', year: 2022, kind: 'serie',
    tier: 'S+', status: 'assistindo', season: 2, watched: 11, seasons: [9, 10],
    genres: ['Mistério', 'Drama'], tone: 1,
    synopsis:
      'Mark lidera uma equipe cujas memórias foram divididas cirurgicamente entre o trabalho e a vida pessoal. Fora do escritório, ele começa a investigar o que a empresa esconde.'
  },
  {
    id: 'duna-2', title: 'Duna: Parte Dois', original: 'Dune: Part Two', year: 2024, kind: 'filme',
    tier: 'S', status: 'concluido', runtime: '2h 46min',
    genres: ['Ficção científica', 'Aventura'], tone: 2,
    synopsis:
      'Paul Atreides se une a Chani e aos Fremen para vingar a conspiração que destruiu sua família, dividido entre o amor e o destino que enxerga à frente.'
  },
  {
    id: 'shogun', title: 'Shōgun', original: 'Shōgun', year: 2024, kind: 'serie',
    tier: 'S+', status: 'assistindo', season: 1, watched: 8, seasons: [10],
    genres: ['Drama', 'História'], tone: 5,
    synopsis:
      'No Japão feudal de 1600, um marinheiro inglês naufragado se torna peça central de uma disputa de poder entre senhores da guerra.'
  },
  {
    id: 'oppenheimer', title: 'Oppenheimer', original: 'Oppenheimer', year: 2023, kind: 'filme',
    tier: 'A', status: 'concluido', runtime: '3h 00min',
    genres: ['Drama', 'História'], tone: 0,
    synopsis:
      'A trajetória de J. Robert Oppenheimer, do laboratório de Los Alamos ao julgamento público sobre o uso da bomba atômica.'
  },
  {
    id: 'cidade-de-deus', title: 'Cidade de Deus', original: 'Cidade de Deus', year: 2002, kind: 'filme',
    tier: 'S+', status: 'concluido', runtime: '2h 10min',
    genres: ['Drama', 'Crime'], tone: 4,
    synopsis:
      'Buscapé cresce em uma favela do Rio entre os anos 1960 e 1980, onde a violência aumenta e o caminho da fotografia se abre como saída.'
  },
  {
    id: 'ainda-estou-aqui', title: 'Ainda Estou Aqui', original: 'Ainda Estou Aqui', year: 2024, kind: 'filme',
    tier: 'S', status: 'quero', runtime: '2h 17min',
    genres: ['Drama', 'História'], tone: 3,
    synopsis:
      'Eunice Paiva reconstrói a própria vida e a da família enquanto busca a verdade sobre o desaparecimento do marido durante a ditadura.'
  },
  {
    id: 'past-lives', title: 'Past Lives', original: 'Past Lives', year: 2023, kind: 'filme',
    tier: 'B', status: 'concluido', runtime: '1h 46min',
    genres: ['Romance', 'Drama'], tone: 6,
    synopsis:
      'Duas amizades de infância se reencontram em Nova York décadas depois e medem o que ficou no caminho entre Seul e a vida que escolheram.'
  },
  {
    id: 'fallout', title: 'Fallout', original: 'Fallout', year: 2024, kind: 'serie',
    tier: 'A', status: 'assistindo', season: 1, watched: 5, seasons: [8],
    genres: ['Ficção científica', 'Ação'], tone: 2,
    synopsis:
      'Duzentos anos após o apocalipse, uma moradora de abrigo sobe à superfície e encontra um mundo que não cabe no manual de sobrevivência.'
  },
  {
    id: 'the-bear', title: 'The Bear', original: 'The Bear', year: 2022, kind: 'serie',
    tier: 'S', status: 'pausado', season: 3, watched: 13, seasons: [8, 10, 10],
    genres: ['Drama', 'Comédia'], tone: 3,
    synopsis:
      'Um chef premiado volta a Chicago para assumir a lanchonete da família e tenta transformar a cozinha sem perder os irmãos pelo caminho.'
  },
  {
    id: 'bleach-tybw', title: 'Bleach: Thousand-Year Blood War', original: 'Bleach: Sennen Kessen-hen', year: 2022,
    kind: 'serie', tier: 'B', status: 'pausado', season: 3, watched: 22, seasons: [13, 13, 13],
    genres: ['Anime', 'Ação'], tone: 6,
    synopsis:
      'Ichigo volta à ação quando os Quincy declaram guerra à Sociedade das Almas, no arco final do mangá de Tite Kubo.'
  }
];

const TONE_GRADIENTS = [
  ['#3B352C', '#17130F'], ['#2E3238', '#12151A'], ['#3A3325', '#1A1608'],
  ['#27382F', '#0F1A15'], ['#363041', '#171320'], ['#3B312B', '#1A1310'],
  ['#313A3D', '#131719']
];

const TIER_STYLE = {
  'S+': { bg: '#FFD700', ink: '#3B2F00' },
  S: { bg: '#34D399', ink: '#06331F' },
  A: { bg: '#3B82F6', ink: '#0E2A4D' },
  B: { bg: '#F99E16', ink: '#452900' },
  C: { bg: '#F1500A', ink: '#3D1600' },
  D: { bg: '#EF4444', ink: '#430D0D' }
};

const STATUS_LABEL = {
  assistindo: 'Assistindo',
  concluido: 'Concluído',
  pausado: 'Pausado',
  quero: 'Quero ver'
};

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'assistindo', label: 'Assistindo' },
  { key: 'concluido', label: 'Concluído' },
  { key: 'pausado', label: 'Pausado' },
  { key: 'quero', label: 'Quero ver' }
];

const TIER_RANK = { 'S+': 0, S: 1, A: 2, B: 3, C: 4, D: 5 };

/* ---------- helpers ---------- */

function totalEpisodes(item) {
  return (item.seasons || []).reduce((acc, n) => acc + n, 0) || item.total || 0;
}

function progressOf(item) {
  const total = totalEpisodes(item);
  if (item.kind === 'filme') return item.status === 'concluido' ? 100 : 0;
  if (!total) return 0;
  return Math.round((Math.min(item.watched || 0, total) / total) * 100);
}

function episodeLabel(item) {
  if (item.kind === 'filme') return item.runtime || 'Filme';
  const total = totalEpisodes(item);
  return `T${item.season} · ${item.watched || 0}/${total}`;
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function useViewport() {
  const [size, setSize] = React.useState(() =>
    typeof window === 'undefined' ? { w: 1280, h: 900 } : { w: window.innerWidth, h: window.innerHeight }
  );
  React.useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/* ---------- ícones ---------- */

const ICONS = {
  inicio: 'M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.4v-6.1H9.4V21H5a1 1 0 0 1-1-1z',
  catalogo: 'M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z',
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2',
  perfil: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.5 20c.9-3.6 3.9-5.4 7.5-5.4s6.6 1.8 7.5 5.4',
  voltar: 'M15 5l-7 7 7 7',
  avancar: 'M9 5l7 7-7 7',
  coracao: 'M12 20s-7.2-4.3-7.2-9.3A4.2 4.2 0 0 1 12 7.9a4.2 4.2 0 0 1 7.2 2.8C19.2 15.7 12 20 12 20z',
  sol: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4',
  lua: 'M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5z',
  mais: 'M12 6v12M6 12h12',
  check: 'M5 12.5 10 17.5 19.5 6.5'
};

function Icon({ name, size = 20, filled = false, strokeWidth = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- primitivas ---------- */

function TierChip({ tier }) {
  const style = TIER_STYLE[tier] || TIER_STYLE.B;
  return (
    <span className="tier" style={{ background: style.bg, color: style.ink }}>
      {tier}
    </span>
  );
}

/* Estilos do cartão em linha: independem da ordem das folhas da prévia. */
const POSTER_WRAP_STYLE = { position: 'relative', display: 'block', width: '100%' };
const POSTER_TITLE_STYLE = {
  position: 'absolute',
  inset: 'auto 0 0 0',
  zIndex: 2,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  padding: '20px 7px 7px',
  fontFamily: 'var(--font-display, Sora, system-ui, sans-serif)',
  fontSize: '11.5px',
  fontWeight: 600,
  lineHeight: 1.25,
  letterSpacing: '-0.012em',
  color: '#F7F3EA',
  textAlign: 'left',
  background:
    'linear-gradient(180deg, rgba(16,17,18,0) 0%, rgba(16,17,18,0.55) 42%, rgba(16,17,18,0.92) 100%)'
};
const POSTER_BADGE_STYLE = {
  position: 'absolute',
  top: '6px',
  right: '6px',
  zIndex: 3,
  display: 'inline-flex'
};
const CARD_PROGRESS_STYLE = { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' };
const CARD_PCT_STYLE = {
  flex: '0 0 auto',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '9.5px',
  letterSpacing: '0.02em',
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.62
};

/* ------------------------------------------------------------------
   Camada de alinhamento com a identidade do app (style.css + marca).
   A prévia mantém a composição mobile, mas volta à linguagem original:
   marca de três faixas, mono só em dado técnico, cartão com título sobre
   a arte e barra + porcentagem, indicador de aba como a navbar do app.
   ------------------------------------------------------------------ */
const IDENTITY_CSS = `
.brand, .brand-name, .brand-mark { background: none; border: 0; box-shadow: none; }
.brand { gap: 8px; }
.brand-name {
  font-family: var(--font-display, Sora, system-ui, sans-serif);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.025em;
  text-transform: lowercase;
  color: inherit;
}
.brand-mark {
  --mark-h: 22px;
  position: relative;
  display: inline-block;
  width: calc(var(--mark-h) * 1.1071);
  height: var(--mark-h);
  padding: 0;
  border-radius: 0;
  font-size: 0;
  line-height: 0;
  color: var(--accent-ui, #E5D8BF);
}
.brand-mark::before,
.brand-mark::after {
  content: '';
  position: absolute;
  left: 0;


  border-radius: 2px;
  background: currentColor;
}
.brand-mark::before {
  top: 0;
  width: 77.42%;
  height: 21.43%;
  box-shadow: 0 calc(var(--mark-h) * 0.7857) 0 0 currentColor;
}
.brand-mark::after {
  top: 39.29%;
  width: 100%;
  height: 21.43%;
}
.brand-mark--lg { --mark-h: 28px; }

.eyebrow,
.kicker {
  font-family: var(--font-body, Inter, system-ui, sans-serif);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: inherit;
  opacity: 0.68;
}
.section-note,
.stat-l,
.screen-sub,
.row-meta,
.season-eps,
.detail-meta,
.detail-kind,
.progress-label {
  font-family: var(--font-body, Inter, system-ui, sans-serif);
  letter-spacing: 0;
  text-transform: none;
}
.stat-l { font-size: 10.5px; font-weight: 500; opacity: 0.66; }

.section-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  border: 0;
  background: none;
  font-family: var(--font-body, Inter, system-ui, sans-serif);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--accent-ui, #E5D8BF);
  cursor: pointer;
}
.section-link svg { opacity: 0.85; }
.section-link:focus-visible {
  outline: 2px solid var(--accent-ui, #E5D8BF);
  outline-offset: 3px;
  border-radius: 4px;
}
.section-empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.6;
}

.rail-card { gap: 6px; }
.grid-card { position: relative; display: grid; grid-template-rows: auto auto auto; gap: 6px; align-content: start; }
.grid-card > .poster-wrap { grid-row: 1; grid-column: 1; }
.grid-card > .card-title {
  grid-row: 1;
  grid-column: 1;
  align-self: end;
  z-index: 2;
  padding: 20px 7px 7px;
  font-family: var(--font-display, Sora, system-ui, sans-serif);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.012em;
  color: #F7F3EA;
  background: linear-gradient(180deg, rgba(16, 17, 18, 0) 0%, rgba(16, 17, 18, 0.55) 42%, rgba(16, 17, 18, 0.92) 100%);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.grid-card > .card-meta {
  font-family: var(--font-body, Inter, system-ui, sans-serif);
  font-size: 10.5px;
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.6;
}
.poster-wrap { display: block; width: 100%; position: relative; }
.poster-title {
  position: absolute;
  inset: auto 0 0 0;
  z-index: 2;
  padding: 20px 7px 7px;
  font-family: var(--font-display, Sora, system-ui, sans-serif);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.012em;
  color: #F7F3EA;
  text-align: left;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(16, 17, 18, 0) 0%, rgba(16, 17, 18, 0.55) 42%, rgba(16, 17, 18, 0.92) 100%);
}
.poster-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  display: inline-flex;
}
.card-progress { display: flex; align-items: center; gap: 8px; width: 100%; }
.card-progress .pbar { flex: 1 1 auto; min-width: 0; }
.card-pct {
  flex: 0 0 auto;
  font-family: var(--font-mono, monospace);
  font-size: 9.5px;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  opacity: 0.62;
}

.tab { position: relative; }
.tab.is-active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 26px;
  height: 3px;
  background: var(--accent-ui, #E5D8BF);
}
.avatar, .avatar--lg, .avatar-lg { border-radius: 999px !important; }

.link-row svg { transform: none; color: var(--accent-ui, #E5D8BF); }
.facts dt {
  font-family: var(--font-body, Inter, system-ui, sans-serif);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.62;
}
`;

function mountIdentityStyles() {
  if (typeof document === 'undefined' || document.getElementById('datmovie-identity')) return;
  const identityStyle = document.createElement('style');
  identityStyle.id = 'datmovie-identity';
  identityStyle.textContent = IDENTITY_CSS;
  /* no fim do body: vence as regras equivalentes da folha que desenha a prévia */
  (document.body || document.head).appendChild(identityStyle);
}

mountIdentityStyles();

function Poster({ item, dim = false }) {
  const [from, to] = TONE_GRADIENTS[item.tone % TONE_GRADIENTS.length];
  return (
    <div
      className={'poster' + (dim ? ' poster--dim' : '')}
      style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}
      aria-hidden="true"
    />
  );
}

function ProgressBar({ value, thin = false }) {
  return (
    <div className={'pbar' + (thin ? ' pbar--thin' : '')}>
      <span style={{ width: Math.max(value, value > 0 ? 3 : 0) + '%' }} />
    </div>
  );
}

/* Anatomia do cartão do app: arte com título sobreposto + barra e porcentagem
   (espelha .card-progress e .tier-stamp do style.css). */
function PosterCard({ item, badge = false }) {
  const pct = progressOf(item);
  return (
    <>
      <div className="poster-wrap" style={POSTER_WRAP_STYLE}>
        <Poster item={item} />
        <span className="poster-title" style={POSTER_TITLE_STYLE}>
          {item.title}
        </span>
        {badge && (
          <span className="poster-badge" style={POSTER_BADGE_STYLE}>
            <TierChip tier={item.tier} />
          </span>
        )}
      </div>
      <div className="card-progress" style={CARD_PROGRESS_STYLE}>
        <ProgressBar value={pct} thin />
        <span className="card-pct mono" style={CARD_PCT_STYLE}>
          {pct}%
        </span>
      </div>
    </>
  );
}

function Rail({ children }) {
  const ref = React.useRef(null);
  const [canScroll, setCanScroll] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setCanScroll(el.scrollWidth > el.clientWidth + 4);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className={'rail-wrap' + (canScroll ? ' rail-wrap--scrollable' : '')}>
      <div className="rail" ref={ref}>
        {children}
      </div>
    </div>
  );
}

/* ---------- telas ---------- */

function HomeScreen({ items, favorites, onOpen, onGoProfile, onGoCatalog }) {
  const ongoing = items.filter((i) => i.status === 'assistindo');
  const trending = items
    .filter((i) => i.status !== 'assistindo')
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])
    .slice(0, 5);

  return (
    <div className="screen">
      <div className="screen-head">
        <p className="kicker">Segunda, 19 de outubro</p>
        <h1 className="h-screen" tabIndex="-1">
          Boa noite, Rafael.
        </h1>
        <p className="screen-sub">
          {ongoing.length} séries em andamento · {favorites.length} favoritos
        </p>
      </div>

      <section className="section" aria-labelledby="home-continue">
        <div className="section-head">
          <h2 id="home-continue" className="h-section">
            Continuar assistindo
          </h2>
          <button className="section-link" onClick={onGoCatalog}>
            Ver tudo
            <Icon name="avancar" size={13} />
          </button>
        </div>
        {ongoing.length === 0 ? (
          <p className="section-empty">
            Nada em andamento. O que você abrir e marcar aparece aqui.
          </p>
        ) : (
          <Rail>
            {ongoing.map((item) => (
              <button
                key={item.id}
                id={'card-' + item.id}
                className="rail-card"
                onClick={() => onOpen(item.id)}
                aria-label={`Abrir ${item.title}, ${episodeLabel(item)}`}
              >
                <PosterCard item={item} />
              </button>
            ))}
          </Rail>
        )}
      </section>

      <section className="section" aria-labelledby="home-week">
        <div className="section-head">
          <h2 id="home-week" className="h-section">
            Sua semana
          </h2>
          <span className="section-note">últimos 7 dias</span>
        </div>
        <div className="stats">
          <div>
            <p className="stat-n mono">7</p>
            <p className="stat-l">Episódios</p>
          </div>
          <div>
            <p className="stat-n mono">4h 20</p>
            <p className="stat-l">Tempo</p>
          </div>
          <div>
            <p className="stat-n mono">2</p>
            <p className="stat-l">Zerados</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="home-top">
        <div className="section-head">
          <h2 id="home-top" className="h-section">
            Em alta no seu tier
          </h2>
          <button className="section-link" onClick={onGoCatalog}>
            Ver tudo
            <Icon name="avancar" size={13} />
          </button>
        </div>
        <Rail>
          {trending.map((item) => (
            <button
              key={item.id}
              id={'card-top-' + item.id}
              className="rail-card"
              onClick={() => onOpen(item.id)}
              aria-label={`Abrir ${item.title}, tier ${item.tier}`}
            >
              <PosterCard item={item} badge />
            </button>
          ))}
        </Rail>
      </section>

      <button className="link-row" onClick={onGoProfile}>
        <span>Ver seu perfil e preferências</span>
        <Icon name="avancar" size={16} />
      </button>
    </div>
  );
}

function CatalogScreen({ items, favorites, onOpen, filter, setFilter }) {
  const counts = {};
  FILTERS.forEach((f) => {
    counts[f.key] = f.key === 'todos' ? items.length : items.filter((i) => i.status === f.key).length;
  });
  const visible = filter === 'todos' ? items : items.filter((i) => i.status === filter);

  return (
    <div className="screen">
      <div className="screen-head">
        <p className="eyebrow">Seu acervo</p>
        <h1 className="h-screen" tabIndex="-1">
          Catálogo
        </h1>
        <p className="screen-sub mono">
          {items.length} títulos · {favorites.length} favoritos
        </p>
      </div>

      <div className="chips" role="group" aria-label="Filtrar catálogo por status">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            id={'filter-' + f.key}
            className={'chip' + (filter === f.key ? ' chip--on' : '')}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="chip-n mono">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Nada nesse status</p>
          <p className="empty-text">Nenhum título marcado como {STATUS_LABEL[filter]} ainda.</p>
          <button className="btn-ghost btn-ghost--sm" onClick={() => setFilter('todos')}>
            Limpar filtro
          </button>
        </div>
      ) : (
        <div className="grid" id="catalog-grid">
          {visible.map((item) => (
            <button
              key={item.id}
              id={'grid-' + item.id}
              className="grid-card"
              onClick={() => onOpen(item.id)}
              aria-label={`Abrir ${item.title}, tier ${item.tier}, ${STATUS_LABEL[item.status]}`}
            >
              <div className="poster-wrap">
                <Poster item={item} />
                <span className="poster-badge">
                  <TierChip tier={item.tier} />
                </span>
              </div>
              <span className="card-title">{item.title}</span>
              <span className="card-meta mono">
                {item.year} · {item.kind === 'serie' ? `${totalEpisodes(item)} eps` : 'Filme'}
              </span>
              <ProgressBar value={progressOf(item)} thin />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchScreen({ items, query, setQuery, onOpen, onGoCatalog }) {
  const term = normalize(query.trim());
  const matches = term
    ? items.filter(
        (i) =>
          normalize(i.title).includes(term) ||
          normalize(i.original).includes(term) ||
          i.genres.some((g) => normalize(g).includes(term))
      )
    : [];

  const suggestions = [...items]
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])
    .slice(0, 4);

  return (
    <div className="screen">
      <div className="screen-head">
        <p className="eyebrow">Encontre no acervo</p>
        <h1 className="h-screen" tabIndex="-1">
          Buscar
        </h1>
      </div>

      <div className="field">
        <Icon name="busca" size={18} />
        <input
          id="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Título, original ou gênero"
          aria-label="Buscar no acervo por título, título original ou gênero"
        />
        {query ? (
          <button className="field-clear" onClick={() => setQuery('')} aria-label="Limpar busca">
            ×
          </button>
        ) : null}
      </div>

      {term === '' ? (
        <section className="section" aria-labelledby="search-suggest">
          <div className="section-head">
            <h2 id="search-suggest" className="h-section">
              Sugestões do seu tier
            </h2>
          </div>
          <div className="rows">
            {suggestions.map((item) => (
              <button
                key={item.id}
                id={'suggest-' + item.id}
                className="row"
                onClick={() => onOpen(item.id)}
                aria-label={`Abrir ${item.title}`}
              >
                <div className="row-poster">
                  <Poster item={item} />
                </div>
                <span className="row-body">
                  <span className="row-title">{item.title}</span>
                  <span className="row-meta mono">
                    {item.year} · {item.kind === 'serie' ? 'Série' : 'Filme'}
                  </span>
                </span>
                <TierChip tier={item.tier} />
              </button>
            ))}
          </div>
        </section>
      ) : matches.length === 0 ? (
        <div className="empty" id="search-empty">
          <p className="empty-title">Nenhum título para “{query.trim()}”</p>
          <p className="empty-text">
            A busca cobre título, título original e gênero. Tente “drama”, “sci-fi” ou “ruptura”.
          </p>
          <button className="btn-ghost btn-ghost--sm" onClick={() => setQuery('')}>
            Limpar busca
          </button>
        </div>
      ) : (
        <section className="section" aria-labelledby="search-results">
          <div className="section-head">
            <h2 id="search-results" className="h-section">
              Resultados
            </h2>
            <span className="pill-count mono">{matches.length}</span>
          </div>
          <div className="rows" id="search-results-list">
            {matches.map((item) => (
              <button
                key={item.id}
                id={'result-' + item.id}
                className="row"
                onClick={() => onOpen(item.id)}
                aria-label={`Abrir ${item.title}`}
              >
                <div className="row-poster">
                  <Poster item={item} />
                </div>
                <span className="row-body">
                  <span className="row-title">{item.title}</span>
                  <span className="row-meta mono">
                    {item.year} · {STATUS_LABEL[item.status]} · {progressOf(item)}%
                  </span>
                </span>
                <TierChip tier={item.tier} />
              </button>
            ))}
          </div>
        </section>
      )}

      <button className="link-row" onClick={onGoCatalog}>
        <span>Abrir catálogo completo em grade</span>
        <Icon name="voltar" size={16} />
      </button>
    </div>
  );
}

function ProfileScreen({ items, favorites, theme, setTheme, onOpen }) {
  const completed = items.filter((i) => i.status === 'concluido').length;
  const favItems = items.filter((i) => favorites.includes(i.id));

  return (
    <div className="screen">
      <div className="profile-head">
        <div className="avatar avatar--lg" aria-hidden="true">
          RA
        </div>
        <div>
          <h1 className="h-screen h-screen--sm" tabIndex="-1">
            Rafael Andrade
          </h1>
          <p className="mono profile-mail">rafael@exemplo.com</p>
          <p className="profile-since">Conta de demonstração</p>
        </div>
      </div>

      <div className="stats stats--4">
        <div>
          <p className="stat-n mono">{items.length}</p>
          <p className="stat-l mono">Títulos</p>
        </div>
        <div>
          <p className="stat-n mono">{completed}</p>
          <p className="stat-l mono">Zerados</p>
        </div>
        <div>
          <p className="stat-n mono">{favorites.length}</p>
          <p className="stat-l mono">Favoritos</p>
        </div>
        <div>
          <p className="stat-n mono">87h</p>
          <p className="stat-l mono">Assistido</p>
        </div>
      </div>

      <section className="section" aria-labelledby="profile-theme">
        <h2 id="profile-theme" className="h-section">
          Tema do app
        </h2>
        <div className="segmented" role="group" aria-label="Tema do app">
          <button
            id="theme-dark"
            className={'segmented-opt' + (theme === 'dark' ? ' is-on' : '')}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <Icon name="lua" size={16} />
            Escuro
          </button>
          <button
            id="theme-light"
            className={'segmented-opt' + (theme === 'light' ? ' is-on' : '')}
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            <Icon name="sol" size={16} />
            Claro
          </button>
        </div>
      </section>

      <section className="section" aria-labelledby="profile-favs">
        <div className="section-head">
          <h2 id="profile-favs" className="h-section">
            Favoritos
          </h2>
          <span className="pill-count mono">{favItems.length}</span>
        </div>
        {favItems.length === 0 ? (
          <p className="empty-text empty-text--inline">
            Nenhum favorito ainda. Abra um título e use o coração no topo.
          </p>
        ) : (
          <Rail>
            {favItems.map((item) => (
              <button
                key={item.id}
                id={'fav-' + item.id}
                className="rail-card rail-card--sm"
                onClick={() => onOpen(item.id)}
                aria-label={`Abrir ${item.title}`}
              >
                <Poster item={item} />
                <span className="card-title">{item.title}</span>
              </button>
            ))}
          </Rail>
        )}
      </section>

      <div className="panel">
        <p className="panel-title">Sobre esta prévia</p>
        <p className="panel-text">
          Catálogo, sessão e imagens são de demonstração. A prévia não chama Supabase nem TMDb:
          marcar episódio, filtrar e favoritar mudam apenas o estado local deste preview.
        </p>
      </div>
    </div>
  );
}

function useSwipeBack(onBack, enabled) {
  const startX = React.useRef(0);
  const startY = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) return;
    const onTouchStart = (e) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (dx > 80 && Math.abs(dy) < 60) onBack();
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onBack, enabled]);
}

function DetailScreen({ item, favorite, onToggleFavorite, onAdvance, onBack, backButtonRef }) {
  const pct = progressOf(item);
  const total = totalEpisodes(item);
  const isFilm = item.kind === 'filme';
  const done = item.status === 'concluido';
  const [from, to] = TONE_GRADIENTS[item.tone % TONE_GRADIENTS.length];

  useSwipeBack(onBack, true);

  return (
    <div className="detail" role="region" aria-label={'Título: ' + item.title}>
      <div className="detail-top">
        <button className="icon-btn" id="detail-back" ref={backButtonRef} onClick={onBack} aria-label="Voltar">
          <Icon name="voltar" size={20} />
        </button>
        <span className="mono detail-top-label">Título</span>
        <button
          className={'icon-btn' + (favorite ? ' is-fav' : '')}
          id="detail-fav"
          aria-pressed={favorite}
          aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          onClick={onToggleFavorite}
        >
          <Icon name="coracao" size={19} filled={favorite} />
        </button>
      </div>

      <div className="detail-scroll">
        <div className="hero">
          <div className="hero-art" style={{ background: `linear-gradient(155deg, ${from}, ${to})` }} />
          <div className="hero-fade" />
        </div>

        <div className="detail-body">
          <div className="detail-head">
            <div className="detail-poster">
              <Poster item={item} />
            </div>
            <div className="detail-head-info">
              <span className="detail-flags">
                <TierChip tier={item.tier} />
                <span className="mono detail-kind">{isFilm ? 'Filme' : 'Série'}</span>
              </span>
              <h1 className="detail-title" id="detail-title" tabIndex="-1">
                {item.title}
              </h1>
              <p className="mono detail-meta">
                {item.year} · {STATUS_LABEL[item.status]}
                {!isFilm && item.season ? ` · T${item.season}` : ''}
              </p>
            </div>
          </div>

          <div className="panel panel--progress">
            <div className="progress-head">
              <p className="mono progress-label" id="detail-progress">
                {isFilm
                  ? done
                    ? 'Assistido'
                    : 'Ainda não assistido'
                  : `${item.watched || 0} de ${total} episódios`}
              </p>
              <span className="mono progress-pct">{pct}%</span>
            </div>
            <ProgressBar value={pct} />
          </div>

          <button className="btn-primary" id="detail-next" onClick={onAdvance}>
            <Icon name={done ? 'check' : 'mais'} size={18} />
            {isFilm
              ? done
                ? 'Marcar como não assistido'
                : 'Marcar como assistido'
              : done
                ? 'Série concluída'
                : 'Marcar +1 episódio'}
          </button>

          <section className="detail-block" aria-labelledby="detail-synopsis">
            <h2 id="detail-synopsis" className="h-section">
              Sinopse
            </h2>
            <p className="synopsis">{item.synopsis}</p>
          </section>

          <section className="detail-block" aria-labelledby="detail-genres">
            <h2 id="detail-genres" className="h-section">
              Gêneros
            </h2>
            <div className="chips chips--static">
              {item.genres.map((g) => (
                <span key={g} className="chip chip--static">
                  {g}
                </span>
              ))}
            </div>
          </section>

          {isFilm ? (
            <div className="panel">
              <dl className="facts">
                <div>
                  <dt className="mono">Duração</dt>
                  <dd className="mono">{item.runtime}</dd>
                </div>
                <div>
                  <dt className="mono">Ano</dt>
                  <dd className="mono">{item.year}</dd>
                </div>
                <div>
                  <dt className="mono">Título original</dt>
                  <dd className="mono">{item.original}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <section className="detail-block" aria-labelledby="detail-seasons">
              <h2 id="detail-seasons" className="h-section">
                Temporadas
              </h2>
              <div className="seasons">
                {item.seasons.map((eps, index) => {
                  const isCurrent = index + 1 === item.season;
                  return (
                    <div key={index} className={'season-row' + (isCurrent ? ' is-current' : '')}>
                      <span className="season-n">Temporada {index + 1}</span>
                      <span className="mono season-eps">{eps} episódios</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- app dentro do aparelho ---------- */

const TABS = [
  { key: 'inicio', label: 'Início', icon: 'inicio' },
  { key: 'catalogo', label: 'Catálogo', icon: 'catalogo' },
  { key: 'busca', label: 'Buscar', icon: 'busca' },
  { key: 'perfil', label: 'Perfil', icon: 'perfil' }
];

function MobileApp({ accentColor, accentInk, framed }) {
  const [items, setItems] = React.useState(SEED);
  const [favorites, setFavorites] = React.useState(['ruptura', 'cidade-de-deus', 'shogun']);
  const [screen, setScreen] = React.useState('inicio');
  const [filter, setFilter] = React.useState('todos');
  const [query, setQuery] = React.useState('');
  const [theme, setTheme] = React.useState('dark');
  const [detailId, setDetailId] = React.useState(null);
  const scrollRef = React.useRef(null);
  const backRef = React.useRef(null);
  const openerRef = React.useRef(null);

  const detail = items.find((i) => i.id === detailId) || null;

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [screen]);

  React.useEffect(() => {
    if (detailId && backRef.current) {
      backRef.current.focus();
    } else if (!detailId && openerRef.current) {
      const el = openerRef.current;
      openerRef.current = null;
      if (document.body.contains(el)) el.focus();
    }
  }, [detailId]);

  React.useEffect(() => {
    if (!detailId) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDetail();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detailId]);

  function openDetail(id) {
    openerRef.current = document.activeElement;
    setDetailId(id);
  }

  function closeDetail() {
    setDetailId(null);
  }

  function advance(item) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== item.id) return i;
        if (i.kind === 'filme') {
          return { ...i, status: i.status === 'concluido' ? 'quero' : 'concluido' };
        }
        const total = totalEpisodes(i);
        const next = Math.min((i.watched || 0) + 1, total);
        return {
          ...i,
          watched: next,
          status: next >= total ? 'concluido' : i.status === 'concluido' ? 'assistindo' : i.status
        };
      })
    );
  }

  function toggleFavorite(id) {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div
      className={'dm-phone' + (framed ? ' dm-phone--framed' : '')}
      data-theme={theme}
      style={{ '--accent': accentColor, '--accent-ink': accentInk }}
    >
      <div className="phone-inner">
        <div className="statusbar mono">
          <span>9:41</span>
          <span className="statusbar-right">
            <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
              <rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor" />
              <rect x="4.5" y="5" width="3" height="6" rx="1" fill="currentColor" />
              <rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="currentColor" />
              <rect x="13.5" y="0" width="3" height="11" rx="1" fill="currentColor" opacity="0.4" />
            </svg>
            <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true">
              <path d="M7.5 9.6 9.4 7.5a2.8 2.8 0 0 0-3.8 0zM3.4 5.4a6.4 6.4 0 0 1 8.2 0l1.2-1.4a8.3 8.3 0 0 0-10.6 0z" fill="currentColor" />
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" aria-hidden="true">
              <rect x="0.6" y="0.6" width="20" height="10.8" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.5" />
              <rect x="2.2" y="2.2" width="14" height="7.6" rx="1.8" fill="currentColor" />
              <path d="M22.2 4.2v3.6a1.9 1.9 0 0 0 0-3.6z" fill="currentColor" fillOpacity="0.5" />
            </svg>
          </span>
        </div>
        {framed ? <span className="island" aria-hidden="true" /> : null}

        <header className="appbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              d
            </span>
            <span className="brand-word">datmovie</span>
          </div>
          <div className="appbar-actions">
            <button
              className="icon-btn icon-btn--sm"
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Icon name={theme === 'dark' ? 'sol' : 'lua'} size={17} />
            </button>
            <button className="avatar" onClick={() => setScreen('perfil')} aria-label="Abrir perfil">
              RA
            </button>
          </div>
        </header>

        <div className="screen-scroll" ref={scrollRef}>
          {screen === 'inicio' && (
            <HomeScreen
              items={items}
              favorites={favorites}
              onOpen={openDetail}
              onGoProfile={() => setScreen('perfil')}
            />
          )}
          {screen === 'catalogo' && (
            <CatalogScreen
              items={items}
              favorites={favorites}
              onOpen={openDetail}
              filter={filter}
              setFilter={setFilter}
            />
          )}
          {screen === 'busca' && (
            <SearchScreen
              items={items}
              query={query}
              setQuery={setQuery}
              onOpen={openDetail}
              onGoCatalog={() => setScreen('catalogo')}
            />
          )}
          {screen === 'perfil' && (
            <ProfileScreen
              items={items}
              favorites={favorites}
              theme={theme}
              setTheme={setTheme}
              onOpen={openDetail}
            />
          )}
        </div>

        <nav className="tabbar" role="navigation" aria-label="Navegação principal">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              id={'tab-' + tab.key}
              className={'tab' + (screen === tab.key ? ' is-active' : '')}
              aria-current={screen === tab.key ? 'page' : undefined}
              aria-label={tab.label}
              onClick={() => setScreen(tab.key)}
            >
              <Icon name={tab.icon} size={21} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {detail && (
          <div className="detail-anchor">
            <DetailScreen
              item={detail}
              favorite={favorites.includes(detail.id)}
              onToggleFavorite={() => toggleFavorite(detail.id)}
              onAdvance={() => advance(detail)}
              onBack={closeDetail}
              backButtonRef={backRef}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- palco da prévia ---------- */

const NOTES = [
  {
    title: 'Barra de abas fixa',
    text: 'Os quatro destinos do desktop viram abas de 62px no rodapé, com área segura e item ativo em areia.'
  },
  {
    title: 'Trilhos de 2,5 cartões',
    text: 'Carrosséis com cartão de 132px e scroll-snap: o terceiro cartão cortado sinaliza que há mais à direita.'
  },
  {
    title: 'Filtros em chips',
    text: 'A barra de filtros e ordenação vira uma faixa rolável de pílulas com contagem por status.'
  },
  {
    title: 'Título em tela cheia',
    text: 'O modal de detalhes do desktop abre como página, com voltar e favoritar fixos no topo.'
  }
];

function StageControls({ device, setDevice }) {
  return (
    <div className="segmented segmented--stage" role="group" aria-label="Modo de visualização">
      <button
        id="stage-frame"
        className={'segmented-opt' + (device === 'frame' ? ' is-on' : '')}
        aria-pressed={device === 'frame'}
        onClick={() => setDevice('frame')}
      >
        Moldura
      </button>
      <button
        id="stage-fluid"
        className={'segmented-opt' + (device === 'fluid' ? ' is-on' : '')}
        aria-pressed={device === 'fluid'}
        onClick={() => setDevice('fluid')}
      >
        Fluido
      </button>
    </div>
  );
}

function App() {
  const tweak = TWEAK_DEFAULTS;
  const { w, h } = useViewport();
  const [device, setDevice] = React.useState(tweak.device);
  const narrow = w < 620;
  const framed = device === 'frame' && w >= 560;
  const showNotes = tweak.showNotes && w >= 1000;

  const accent = tweak.accentColor;
  const accentInk = (() => {
    const hex = accent.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.5 ? '#101112' : '#F4F1EA';
  })();

  const phoneHeight = framed
    ? Math.min(844, Math.max(560, h - 236))
    : Math.min(876, Math.max(560, h - (narrow ? 88 : 220)));

  React.useEffect(() => {
    if (document.getElementById('dm-fonts')) return;
    const link = document.createElement('link');
    link.id = 'dm-fonts';
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  return (
    <div
      className={'dm-stage' + (narrow ? ' dm-stage--narrow' : '')}
      style={{ '--accent': accent, '--accent-ink': accentInk, '--dens': tweak.density === 'compact' ? 0.84 : 1 }}
    >
      <style>{CSS}</style>

      <header className="stage-head">
        <div className="stage-brand">
          <span className="brand-mark brand-mark--lg" aria-hidden="true">
            d
          </span>
          <div>
            <p className="eyebrow">Prévia de interface</p>
            <h1 className="stage-title">Dat-Movie em mobile</h1>
            {!narrow && (
              <p className="stage-sub">
                Mesmo catálogo, mesmas cores, composição de 390 × 844.
              </p>
            )}
          </div>
        </div>
        {!narrow && <StageControls device={device} setDevice={setDevice} />}
      </header>

      <div className="stage-body">
        <section className="stage-phone" aria-label="Prévia do app em tela de celular">
          <div className="phone-meta mono">
            <span>{framed ? 'iPhone 16 · 390 × 844' : 'Viewport fluido · largura total'}</span>
            <span>{tweak.density === 'compact' ? 'Densidade compacta' : 'Densidade confortável'}</span>
          </div>
          <div
            className="phone-holder"
            style={{ height: phoneHeight + 'px', width: framed ? 390 : narrow ? '100%' : 430 }}
          >
            <MobileApp accentColor={accent} accentInk={accentInk} framed={framed} />
          </div>
        </section>

        {showNotes && (
          <aside className="stage-aside" aria-label="Notas de adaptação">
            <section>
              <h2 className="aside-title">O que muda no mobile</h2>
              <ol className="notes">
                {NOTES.map((note, i) => (
                  <li key={note.title}>
                    <span className="note-n mono">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="note-title">{note.title}</p>
                      <p className="note-text">{note.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="aside-card">
              <h2 className="aside-title aside-title--sm">Como testar</h2>
              <p className="aside-text">
                Abra um pôster, toque em “Marcar +1 episódio” e volte: trilho, catálogo e busca
                mostram o progresso novo. O tema claro é uma preferência do app, não da prévia.
              </p>
            </section>

            <p className="aside-legend mono">
              Dados de demonstração · artes geradas em CSS · sem Supabase, TMDb ou login real
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

const CSS = `
.dm-stage{
  --bg:#101112; --surface:#191A1C; --raised:#222325; --well:#151618;
  --text:#F2EDE3; --text-2:#AEAFB2; --muted:#838589; --outline:#2A2C30;
  --accent:#E5D8BF; --accent-ink:#101112; --accent-soft:rgba(229,216,191,.10);
  --font-body:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-display:'Sora','Inter',sans-serif;
  --font-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --dens:1;
  min-height:100vh;
  background:#0B0C0D;
  color:#F2EDE3;
  font-family:var(--font-body);
  font-size:15px;
  -webkit-font-smoothing:antialiased;
  padding:26px clamp(16px,3.2vw,44px) 44px;
  display:flex; flex-direction:column; gap:22px;
}
.dm-stage *, .dm-stage *::before, .dm-stage *::after{box-sizing:border-box}
.dm-stage h1,.dm-stage h2,.dm-stage h3,.dm-stage p,.dm-stage ol,.dm-stage dl,.dm-stage dd{margin:0;padding:0}
.dm-stage ol{list-style:none}
.dm-stage :where(button){font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.dm-stage :focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
.dm-stage .mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums}

/* ---- palco ---- */
.stage-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;width:100%;max-width:1040px;margin:0 auto}
.stage-brand{display:flex;align-items:center;gap:14px}
.stage-title{font:600 clamp(19px,2.4vw,25px)/1.15 var(--font-display);letter-spacing:-.02em}
.stage-sub{margin-top:5px;color:#9D9E9F;font-size:13.5px}
.eyebrow{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.stage-body{display:grid;grid-template-columns:auto minmax(260px,336px);gap:clamp(28px,5vw,88px);justify-content:center;align-items:start;width:100%;max-width:1040px;margin:0 auto}
.stage-phone{display:flex;flex-direction:column;gap:10px;align-items:center;min-width:0}
.phone-meta{display:flex;gap:16px;justify-content:space-between;width:100%;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6E7071}
.phone-holder{display:flex;justify-content:center;width:100%}

.segmented{display:inline-flex;background:var(--well);border-radius:999px;padding:4px;gap:2px}
.segmented--stage{background:#16181A;box-shadow:inset 0 0 0 1px #23262A}
.segmented-opt{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 15px;border-radius:999px;font-size:12.5px;font-weight:500;color:var(--text-2);transition:background .2s ease,color .2s ease}
.segmented-opt.is-on{background:var(--accent);color:var(--accent-ink);font-weight:600}
.segmented--stage{align-self:flex-end}

/* ---- notas ---- */
.stage-aside{display:flex;flex-direction:column;gap:22px;padding-top:6px}
.aside-title{font:600 14px/1.3 var(--font-display);letter-spacing:-.01em;margin-bottom:12px}
.aside-title--sm{font-size:13px;margin-bottom:8px}
.notes{display:flex;flex-direction:column;gap:14px}
.notes li{display:grid;grid-template-columns:26px 1fr;gap:10px}
.note-n{font-size:10.5px;color:var(--accent);padding-top:2px;letter-spacing:.06em}
.note-title{font-weight:600;font-size:13.5px;line-height:1.3}
.note-text{color:#929394;font-size:12.5px;line-height:1.5;margin-top:3px}
.aside-card{background:var(--surface);border-radius:10px;padding:16px}
.aside-text{color:#A5A6A7;font-size:12.5px;line-height:1.55}
.aside-legend{font-size:10px;line-height:1.6;letter-spacing:.04em;color:#6B6D6E;border-top:1px solid #1D1F21;padding-top:12px}

/* ---- moldura ---- */
.dm-phone{
  width:100%;height:100%;position:relative;
  background:var(--bg);color:var(--text);
  --accent-ui:var(--accent);
  overflow:hidden;
  border-radius:22px;
}
.dm-phone--framed{
  border-radius:54px;padding:10px;background:#000;
  box-shadow:0 0 0 1.5px #2B2D2F, 0 30px 70px -20px rgba(0,0,0,.85);
  max-width:390px;
}
.phone-inner{position:relative;display:flex;flex-direction:column;height:100%;overflow:hidden;border-radius:22px;background:var(--bg);color:var(--text)}
.dm-phone--framed .phone-inner{border-radius:44px}
.dm-phone[data-theme="light"]{
  --bg:#F4F1EA;--surface:#FFFFFF;--raised:#FFFFFF;--well:#ECE7DC;
  --text:#1B1915;--text-2:#55524A;--muted:#8A8478;--outline:#DDD7CA;
  --accent-soft:rgba(122,102,59,.12);
  --accent-ui:#7A663B;
}
.statusbar{display:flex;align-items:center;justify-content:space-between;height:44px;padding:0 26px;font-size:12px;color:var(--text);flex:0 0 auto}
.dm-phone--framed .statusbar{padding-top:6px}
.statusbar-right{display:flex;align-items:center;gap:5px}
.island{position:absolute;top:13px;left:50%;transform:translateX(-50%);width:108px;height:29px;background:#000;border-radius:20px;z-index:40}

.appbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px calc(16px * var(--dens)) 10px;flex:0 0 auto}
.brand{display:flex;align-items:center;gap:8px}
.brand-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--accent);color:var(--accent-ink);font:600 17px/1 var(--font-display);text-transform:lowercase}
.brand-mark--lg{width:38px;height:38px;border-radius:11px;font-size:23px}
.brand-word{font:600 15px/1 var(--font-display);letter-spacing:-.02em}
.appbar-actions{display:flex;align-items:center;gap:6px}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;color:var(--text);background:transparent;transition:background .2s ease,color .2s ease}
.icon-btn:hover{background:var(--raised)}
.icon-btn:active{background:var(--raised);transform:scale(.96)}
.icon-btn--sm{width:40px;height:40px;background:var(--surface);color:var(--text-2)}
.icon-btn.is-fav{color:var(--accent-ui)}
.avatar{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:var(--raised);color:var(--text);font:600 11.5px/1 var(--font-mono);letter-spacing:.04em}
.avatar--lg{width:60px;height:60px;font-size:17px;border-radius:20px;background:var(--accent-soft);color:var(--accent-ui)}

.screen-scroll{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--outline) transparent}
.screen-scroll::-webkit-scrollbar{width:0}
.screen{padding:4px calc(16px * var(--dens)) 26px;display:flex;flex-direction:column;gap:calc(24px * var(--dens))}
.screen-head{display:flex;flex-direction:column;gap:6px;margin-top:4px}
.h-screen{font:600 25px/1.12 var(--font-display);letter-spacing:-.025em}
.h-screen--sm{font-size:21px}
.screen-sub{color:var(--text-2);font-size:13px}
.screen-sub.mono{font-size:11px;letter-spacing:.04em}
.section{display:flex;flex-direction:column;gap:calc(12px * var(--dens))}
.section-head{display:flex;align-items:center;gap:8px;justify-content:space-between;padding-right:2px}
.h-section{font:600 13.5px/1.3 var(--font-display);letter-spacing:-.005em}
.section-note{font-size:10px;letter-spacing:.06em;color:var(--muted);text-transform:uppercase}
.pill-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--raised);color:var(--text-2);font-size:10.5px}

/* ---- trilhos e cartões ---- */
.rail-wrap{position:relative}
.rail-wrap--scrollable::after{content:'';position:absolute;top:0;right:0;bottom:0;width:32px;background:linear-gradient(90deg,transparent,var(--bg));pointer-events:none;z-index:5}
.rail{display:flex;gap:calc(12px * var(--dens));overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;margin:0 -2px;scrollbar-width:none}
.rail::-webkit-scrollbar{display:none}
.rail-card{flex:0 0 132px;scroll-snap-align:start;display:flex;flex-direction:column;gap:7px;text-align:left;transition:transform .15s ease}
.rail-card:active{transform:scale(.97)}
.rail-card--sm{flex-basis:104px}
.poster-wrap{position:relative;display:block}
.poster{position:relative;width:100%;aspect-ratio:2/3;border-radius:6px;overflow:hidden;isolation:isolate;container-type:inline-size;box-shadow:inset 0 0 0 1px rgba(242,237,227,.08)}
.poster::before{content:'';position:absolute;inset:0;background:radial-gradient(120% 85% at 78% 4%,rgba(229,216,191,.22),transparent 60%),radial-gradient(90% 70% at 12% 96%,rgba(0,0,0,.45),transparent 70%)}
.poster::after{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.30'/%3E%3C/svg%3E");opacity:.5;mix-blend-mode:overlay}
.poster-kind{position:absolute;top:7px;left:8px;font-size:max(7px,6.5cqi);letter-spacing:.14em;text-transform:uppercase;color:rgba(242,237,227,.7);z-index:1}
.poster-glyph{position:absolute;bottom:6%;left:4%;font-family:var(--font-display);font-weight:700;font-size:42cqi;line-height:1;letter-spacing:-.05em;color:rgba(242,237,227,.24);z-index:1}
.row-poster .poster-kind{display:none}
.row-poster .poster-glyph{bottom:8%;left:6%}
.poster-line{position:absolute;right:8px;bottom:10px;width:22px;height:1px;background:rgba(242,237,227,.35);z-index:1}
.poster-badge{position:absolute;top:6px;right:6px;z-index:2}
.card-title{font:500 12.5px/1.3 var(--font-body);color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-meta{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.tier{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:999px;font:600 9.5px/1 var(--font-mono);letter-spacing:.04em}
.pbar{position:relative;height:3px;border-radius:999px;background:var(--well);overflow:hidden}
.pbar span{display:block;height:100%;border-radius:999px;background:var(--accent-ui)}
.pbar--thin{height:2px}

/* ---- painéis / números ---- */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:var(--well);border-radius:10px;padding:calc(14px * var(--dens))}
.stats--4{grid-template-columns:repeat(2,1fr);row-gap:14px}
.stats--4 .stat-n{font-size:17px}
.stat-n{font:500 19px/1.1 var(--font-display);letter-spacing:-.02em}
.stat-l{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:6px}
.panel{background:var(--raised);border-radius:10px;padding:calc(15px * var(--dens))}
.panel-title{font:600 13px/1.3 var(--font-display)}
.panel-text{color:var(--text-2);font-size:12.5px;line-height:1.55;margin-top:6px}
.link-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:0 14px;border-radius:10px;background:var(--surface);color:var(--text-2);font-size:12.5px;text-align:left}
.link-row svg{transform:rotate(180deg);color:var(--muted)}

/* ---- chips ---- */
.chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -2px;padding:2px}
.chips::-webkit-scrollbar{display:none}
.chips--static{flex-wrap:wrap;overflow:visible}
.chip{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;min-height:36px;padding:0 12px;border-radius:999px;background:var(--raised);color:var(--text-2);font-size:12.5px;font-weight:500;transition:background .2s ease,color .2s ease}
.chip:hover{background:var(--well)}
.chip:active{transform:scale(.97)}
.chip--on{background:var(--accent);color:var(--accent-ink)}
.chip--on:hover{background:var(--accent)}
.chip--static{min-height:30px;font-size:12px;color:var(--text-2)}
.chip-n{font-family:var(--font-mono);font-size:10px;opacity:.7}

/* ---- grade ---- */
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:calc(14px * var(--dens)) 12px}
.grid-card{display:flex;flex-direction:column;gap:7px;text-align:left;min-width:0}

/* ---- linhas ---- */
.rows{display:flex;flex-direction:column;gap:2px}
.row{display:flex;align-items:center;gap:12px;width:100%;min-height:74px;padding:8px 10px 8px 8px;border-radius:10px;background:var(--surface);text-align:left}
.row:hover{background:var(--raised)}
.row-poster{width:42px;flex:0 0 42px}
.row-body{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 auto}
.row-title{font:500 13.5px/1.25 var(--font-body);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.row-meta{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}

/* ---- campo de busca ---- */
.field{display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;border-radius:999px;background:var(--surface);color:var(--muted);border:1px solid transparent;transition:border-color .2s ease}
.field:focus-within{border-color:var(--accent-ui);box-shadow:0 0 0 3px var(--accent-soft);color:var(--text-2)}
.field input{flex:1 1 auto;min-width:0;background:none;border:0;outline:none;color:var(--text);font:400 14.5px var(--font-body)}
.field input:focus-visible{outline:none}
.field input::placeholder{color:var(--muted)}
.field input::-webkit-search-cancel-button{display:none}
.field-clear{width:32px;height:32px;border-radius:999px;color:var(--text-2);font-size:18px;line-height:1;display:inline-flex;align-items:center;justify-content:center}

/* ---- vazio ---- */
.empty{display:flex;flex-direction:column;gap:8px;align-items:flex-start;background:var(--surface);border-radius:10px;padding:18px}
.empty-title{font:600 14px/1.3 var(--font-display)}
.empty-text{color:var(--text-2);font-size:12.5px;line-height:1.55}
.empty-text--inline{margin-top:-2px}
.btn-ghost--sm{min-height:38px;padding:0 16px;border-radius:999px;background:var(--raised);color:var(--text);font-size:12.5px;font-weight:500;margin-top:4px}

/* ---- perfil ---- */
.profile-head{display:flex;align-items:center;gap:14px}
.profile-mail{font-size:10.5px;letter-spacing:.04em;color:var(--muted);margin-top:6px}
.profile-since{font-size:11.5px;color:var(--text-2);margin-top:3px}
.dm-phone .segmented-opt{min-height:40px;padding:0 18px}

/* ---- detalhe ---- */
.detail-anchor{position:absolute;top:44px;right:0;bottom:0;left:0;z-index:35;display:block}
.detail{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--bg);animation:dm-slide .24s cubic-bezier(.4,0,.2,1)}
@keyframes dm-slide{from{transform:translateY(16px)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.detail{animation:none}}
.detail-top{display:flex;align-items:center;justify-content:space-between;padding:2px 8px;flex:0 0 auto;background:var(--bg)}
.detail-top-label{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.detail-scroll{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
.detail-scroll::-webkit-scrollbar{display:none}
.hero{position:relative;height:142px;overflow:hidden}
.hero-art{position:absolute;inset:-40px;filter:blur(28px) saturate(1.2) brightness(1.3);opacity:1}
.hero-art::after{content:'';position:absolute;inset:0;background:radial-gradient(65% 75% at 76% 6%,rgba(229,216,191,.30),transparent 62%)}
.hero-fade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,17,18,0) 0%,rgba(16,17,18,.35) 52%,var(--bg) 96%)}
.dm-phone[data-theme="light"] .hero-fade{background:linear-gradient(180deg,rgba(244,241,234,0) 0%,rgba(244,241,234,.55) 52%,var(--bg) 96%)}
.detail-body{padding:0 calc(16px * var(--dens)) 30px;margin-top:-38px;display:flex;flex-direction:column;gap:calc(16px * var(--dens));position:relative;z-index:2}
.detail-head{display:flex;align-items:flex-start;gap:14px}
.detail-poster{width:72px;flex:0 0 72px;filter:drop-shadow(0 12px 22px rgba(0,0,0,.45))}
.detail-head-info{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 auto;padding-top:4px}
.detail-flags{display:flex;align-items:center;gap:8px}
.detail-kind{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.detail-title{font:600 24px/1.1 var(--font-display);letter-spacing:-.03em}
.detail-meta{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-2)}
.panel--progress{display:flex;flex-direction:column;gap:10px}
.progress-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.progress-label{font-size:11px;letter-spacing:.04em;color:var(--text-2)}
.progress-pct{font-size:13px;color:var(--accent-ui)}
.btn-primary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font:600 14px var(--font-body);transition:filter .2s ease,transform .15s ease}
.btn-primary:hover{filter:brightness(1.06)}
.btn-primary:active{transform:scale(.98);filter:brightness(.95)}
.detail-block{display:flex;flex-direction:column;gap:8px}
.synopsis{color:var(--text-2);font-size:13px;line-height:1.62}
.facts{display:flex;flex-direction:column;gap:10px}
.facts div{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.facts dt{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.facts dd{font-size:11.5px;color:var(--text);text-align:right}
.seasons{display:flex;flex-direction:column;gap:2px}
.season-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:0 12px;border-radius:8px;background:var(--surface);color:var(--text-2);font-size:12.5px}
.season-row.is-current{background:var(--accent-soft);color:var(--text)}
.season-n{font-weight:500}
.season-eps{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}

/* ---- barra de abas ---- */
.tabbar{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--surface);border-top:1px solid var(--outline);padding:8px 6px calc(8px + env(safe-area-inset-bottom,0px))}
.tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:50px;border-radius:10px;color:var(--muted);font:500 10px/1 var(--font-body);transition:color .2s ease,background .2s ease;position:relative}
.tab span{letter-spacing:.01em}
.tab:active{background:var(--raised)}
.tab.is-active{color:var(--accent-ui)}

/* ---- responsivo do palco ---- */
@media (max-width:1000px){
  .stage-body{grid-template-columns:auto}
  .stage-aside{display:none}
}
.dm-stage--narrow{padding:12px 0 0;gap:10px}
.dm-stage--narrow .stage-head{padding:0 14px}
.dm-stage--narrow .stage-brand{gap:10px}
.dm-stage--narrow .phone-meta{display:none}
.dm-stage--narrow .stage-body{grid-template-columns:1fr;gap:0}
.dm-stage--narrow .phone-holder{max-width:none}
.dm-stage--narrow .dm-phone{border-radius:0;max-width:none}
.dm-stage--narrow .phone-inner{border-radius:0}
@media (max-width:420px){
  .stats--4{grid-template-columns:repeat(2,1fr);row-gap:14px}
  .h-screen{font-size:23px}
}
`;

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

import js from '@eslint/js';
import globals from 'globals';

/**
 * Configuração do ESLint (flat config, ESLint 9).
 *
 * Objetivo principal: `no-undef`. Foi ela que teria pegado os 32
 * ReferenceError que impediam o app de carregar — o bloco de declarações de
 * `src/main.js` cobria só 43 das 106 chaves de `dom.js`, e o resto era usado
 * como variável global sem existir. Nada no fluxo atual (testes, build) pegava
 * isso: só aparecia no console do navegador, em runtime.
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'supabase/functions/**'],
  },

  // Código da aplicação (browser + ES modules)
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Globais fornecidas pelo Supabase no window quando o app sobe
        window: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'error',
      // O código usa `try {} catch {}` de propósito (localStorage pode
      // estourar quota, sessão pode falhar em modo privado). Bloquear isso
      // só geraria ruído e encorajaria o uso de `var x;` inútil.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // `no-unused-vars` acha código morto pré-existente (imports e params
      // sem uso). Fica em warn de propósito: como aviso não quebra o build,
      // a CI nasce verde e o passinho limpo continua visível. Subir para
      // error é um trabalho de limpeza à parte, não um risco de runtime.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Testes (Vitest) — imports são explícitos, mas o ambiente injeta globals
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Scripts de CLI (migrate-data.js roda em Node)
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];

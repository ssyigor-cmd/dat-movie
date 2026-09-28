import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Nenhum teste fala com o Supabase de verdade (callTMDB é mockado), mas
    // `api.js` -> `supabase.js` chama `createClient` no import, e o
    // supabase-js lança "supabaseUrl is required" sem essas chaves.
    // Sem elas, a suíte inteira depende de um .env local existir — e quebra
    // em CI. Valores dummy deixam os testes herméticos.
    env: {
      VITE_SUPABASE_URL: 'https://dummy-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'dummy-anon-key-not-used-by-tests',
    },
  },
});

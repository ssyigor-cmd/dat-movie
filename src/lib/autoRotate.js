/**
 * Rotação automática com um único timer, reiniciável.
 *
 * Existe como módulo separado porque a lógica é temporal e a página do título
 * é difícil de testar (toda a carrossel vive num closure). Aqui dá para
 * testar avanço, pausa e reinício com fake timers, sem DOM nem TMDb.
 *
 * As regras evitam o comportamento irritante de "a imagem troca na minha cara":
 * - `shouldRun` permite pausar (aba em segundo plano);
 * - `restart` zera a contagem, para que quem navega manualmente sempre tenha
 *   o intervalo inteiro pela frente em vez de ver a troca imediata;
 * - `start` é idempotente: chamar de novo nunca deixa dois timers vivos.
 */

/**
 * @param {Object} opts
 * @param {number} opts.intervalMs - Intervalo entre avances.
 * @param {Function} opts.onTick - Chamado a cada intervalo enquanto ativo.
 * @param {Function} [opts.shouldRun] - Retorna false para pular o tique.
 * @returns {{ start: Function, stop: Function, restart: Function, isRunning: Function }}
 */
export function createAutoRotate({ intervalMs, onTick, shouldRun = () => true }) {
  let id = null;

  function stop() {
    if (id !== null) {
      clearInterval(id);
      id = null;
    }
  }

  function start() {
    stop();
    id = setInterval(() => {
      if (!shouldRun()) return;
      onTick();
    }, intervalMs);
  }

  return {
    start,
    stop,
    // Reiniciar e o mesmo que start, mas com nome que documenta a intencao
    // nos call sites.
    restart: start,
    isRunning: () => id !== null,
  };
}

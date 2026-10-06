-- ============================================================================
-- Corrige total_episodios dos itens salvos pela página do título.
--
-- A coluna nunca teve um sentido só: o modal de adicionar grava
-- `number_of_episodes` do TMDb (a série inteira) e a página do título grava a
-- contagem da temporada que o usuário estava vendo (`maxEpByTemp[temporada]`).
-- O cálculo do progresso sempre somou as temporadas anteriores no numerador,
-- então dividir por esse total por temporada estourava e a barra travava em
-- 100% em qualquer título multivinheta. A coluna também nasce com DEFAULT 1,
-- que dá 100% para qualquer episódio assistido.
--
-- season_episodes_map tem a contagem do TMDb temporada a temporada, então é a
-- fonte confiável: a soma dele é o total da série inteira, a mesma unidade que
-- `calcularProgresso` usa no numerador. Os itens sem mapa útil ficam como
-- estão, porque para eles a coluna é a única informação disponível — a página
-- do título passa a consertar esses sozinha na próxima vez que forem abertos.
--
-- Rode a migration inteira de uma vez. A primeira consulta é só o dry-run:
-- mostra o que vai mudar sem escrever nada.
-- ============================================================================

-- [1/3] Dry-run: o que esta migration mudaria.
SELECT
    i.nome,
    i.temporada,
    i.episodio,
    i.total_episodios AS total_antes,
    soma.total AS total_depois
FROM items i
CROSS JOIN LATERAL (
    SELECT COALESCE(SUM((entrada.valor)::int), 0) AS total
    FROM jsonb_each_text(i.season_episodes_map) AS entrada(chave, valor)
    WHERE entrada.valor ~ '^[0-9]+$'
) AS soma
WHERE jsonb_typeof(i.season_episodes_map) = 'object'
  AND soma.total > 0
  AND i.total_episodios IS DISTINCT FROM soma.total
ORDER BY i.nome;

-- [2/3] Aplica o conserto.
UPDATE items i
SET total_episodios = soma.total
FROM (
    SELECT
        alvo.id,
        COALESCE(SUM(temporada.eps), 0) AS total
    FROM items alvo
    LEFT JOIN LATERAL (
        SELECT (entrada.valor)::int AS eps
        FROM jsonb_each_text(alvo.season_episodes_map) AS entrada(chave, valor)
        -- Mesma tolerância do JS: valor não numérico conta como 0 em vez de
        -- derrubar o UPDATE inteiro com erro de cast.
        WHERE entrada.valor ~ '^[0-9]+$'
    ) AS temporada ON TRUE
    WHERE jsonb_typeof(alvo.season_episodes_map) = 'object'
    GROUP BY alvo.id
) AS soma
WHERE i.id = soma.id
  AND soma.total > 0
  AND i.total_episodios IS DISTINCT FROM soma.total;

-- [3/3] Confere o resultado.
SELECT
    'Reparo de total_episodios concluído!' AS status,
    (SELECT COUNT(*) FROM items) AS total_items,
    -- Itens que seguem sem mapa útil: a coluna continua sendo a única fonte.
    (SELECT COUNT(*) FROM items
      WHERE season_episodes_map IS NULL
         OR jsonb_typeof(season_episodes_map) <> 'object'
         OR NOT EXISTS (SELECT 1 FROM jsonb_each_text(season_episodes_map) e
                         WHERE e.valor ~ '^[0-9]+$')) AS itens_sem_mapa;
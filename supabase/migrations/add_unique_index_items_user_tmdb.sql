-- Impede títulos duplicados do mesmo TMDb por usuário.
--
-- STATUS: APLICADA no projeto glgsidiqteygquolgfvu em 2026-09-28.
-- O diagnóstico (passo 1) não retornou nenhuma linha — não havia duplicata.
-- É idempotente, então reaplicar em outro ambiente continua seguro.
--
-- Contexto: a checagem `isDuplicateInCatalog` roda SÓ no cliente, o que não
-- cobre dois dispositivos (ou duas abas) inserindo o mesmo tmdb_id ao mesmo
-- tempo. O índice torna o banco a última linha de defesa.
--
-- ATENÇÃO: rode o passo 1 antes do passo 2. Se já existirem duplicatas, o
-- CREATE UNIQUE INDEX falha e a migration inteira aborta — é intencional,
-- para não apagar dados do usuário silenciosamente.

-- Passo 1 (diagnóstico): lista duplicatas existentes. Não altera nada.
SELECT
    user_id,
    tmdb_id,
    COUNT(*) AS ocorrencias,
    array_agg(nome ORDER BY data_criacao) AS titulos
FROM items
WHERE tmdb_id IS NOT NULL
GROUP BY user_id, tmdb_id
HAVING COUNT(*) > 1
ORDER BY ocorrencias DESC;

-- Passo 2 (aplicar): só rode depois de resolver o resultado do passo 1.
--
-- Índice PARCIAL de propósito: itens criados sem TMDb (tmdb_id IS NULL) não
-- devem colidir entre si — vários itens sem TMDb são legítimos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_user_tmdb_unique
    ON items (user_id, tmdb_id)
    WHERE tmdb_id IS NOT NULL;

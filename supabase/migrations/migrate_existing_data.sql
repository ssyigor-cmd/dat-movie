-- Migração idempotente dos itens existentes para listas customizáveis.
-- Execute depois de create_lists_tables.sql.
-- Não contém emails, dados específicos de usuário ou credenciais.

-- Lista principal e lista de planejados para cada usuário que possui itens.
INSERT INTO user_lists (user_id, nome, is_system, ordem, data_criacao)
SELECT DISTINCT i.user_id, 'Minha Lista', FALSE, 0, NOW()
FROM items i
WHERE i.user_id IS NOT NULL
ON CONFLICT (user_id, nome) DO NOTHING;

INSERT INTO user_lists (user_id, nome, is_system, ordem, data_criacao)
SELECT DISTINCT i.user_id, 'Próximos', TRUE, 99, NOW()
FROM items i
WHERE i.user_id IS NOT NULL
ON CONFLICT (user_id, nome) DO NOTHING;

-- Listas de tipo só são criadas quando o usuário possui itens daquele tipo.
INSERT INTO user_lists (user_id, nome, is_system, ordem, data_criacao)
SELECT DISTINCT
  i.user_id,
  CASE i.tipo
    WHEN 'anime' THEN 'Animes'
    WHEN 'animacao' THEN 'Animações'
    WHEN 'serie' THEN 'Séries'
  END,
  FALSE,
  CASE i.tipo WHEN 'anime' THEN 1 WHEN 'animacao' THEN 2 WHEN 'serie' THEN 3 ELSE 0 END,
  NOW()
FROM items i
WHERE i.user_id IS NOT NULL
  AND i.tipo IN ('anime', 'animacao', 'serie')
ON CONFLICT (user_id, nome) DO NOTHING;

-- Todo item vai para a lista de tipo quando houver tipo conhecido;
-- itens com tipo inesperado vão para Minha Lista.
INSERT INTO item_lists (item_id, list_id, data_adicao)
SELECT
  i.id,
  ul.id,
  COALESCE(i.data_criacao, NOW())
FROM items i
JOIN user_lists ul
  ON ul.user_id = i.user_id
 AND ul.nome = CASE i.tipo
   WHEN 'anime' THEN 'Animes'
   WHEN 'animacao' THEN 'Animações'
   WHEN 'serie' THEN 'Séries'
   ELSE 'Minha Lista'
 END
ON CONFLICT (item_id, list_id) DO NOTHING;

-- Itens planejados também aparecem em Próximos.
INSERT INTO item_lists (item_id, list_id, data_adicao)
SELECT
  i.id,
  ul.id,
  COALESCE(i.data_criacao, NOW())
FROM items i
JOIN user_lists ul
  ON ul.user_id = i.user_id
 AND ul.nome = 'Próximos'
WHERE i.status = 'planejado'
ON CONFLICT (item_id, list_id) DO NOTHING;

SELECT
  'Migração concluída!' AS status,
  (SELECT COUNT(*) FROM user_lists) AS total_lists,
  (SELECT COUNT(*) FROM item_lists) AS total_relationships,
  (SELECT COUNT(*) FROM items) AS total_items;

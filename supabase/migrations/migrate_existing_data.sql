-- ============================================
-- MIGRAÇÃO DE DADOS EXISTENTES
-- ============================================

-- Este script deve ser executado APÓS a criação das novas tabelas
-- Ele migra os dados existentes para o novo sistema de listas customizáveis

-- 1. Criar listas padrão para cada usuário existente
WITH user_items AS (
  SELECT DISTINCT user_id FROM items
),
user_list_creation AS (
  INSERT INTO user_lists (user_id, nome, is_system, ordem, data_criacao)
  SELECT 
    ui.user_id,
    CASE 
      WHEN ui.user_id = (SELECT id FROM auth.users WHERE email = 'ssy.igor@gmail.com' LIMIT 1) 
      THEN 'Animes'
      ELSE 'Minha Lista'
    END,
    FALSE,
    0,
    NOW()
  FROM user_items ui
  ON CONFLICT (user_id, nome) DO NOTHING
  RETURNING id, user_id, nome
)
SELECT * FROM user_list_creation;

-- 2. Para o usuário específico ssy.igor@gmail.com, criar as listas adicionais
INSERT INTO user_lists (user_id, nome, is_system, ordem, data_criacao)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'ssy.igor@gmail.com' LIMIT 1),
  unnest(ARRAY['Animações', 'Séries']),
  FALSE,
  unnest(ARRAY[1, 2]),
  NOW()
WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'ssy.igor@gmail.com')
ON CONFLICT (user_id, nome) DO NOTHING;

-- 3. Criar Lista de Desejos para todos os usuários
INSERT INTO user_lists (user_id, nome, is_system, ordem, data_criacao)
SELECT 
  ui.user_id,
  'Lista de Desejos',
  TRUE,
  99,
  NOW()
FROM user_items ui
ON CONFLICT (user_id, nome) DO NOTHING;

-- 4. Migrar itens existentes para as listas correspondentes
-- Para o usuário ssy.igor@gmail.com, mapear por tipo
-- Para outros usuários, adicionar à "Minha Lista"
INSERT INTO item_lists (item_id, list_id, data_adicao)
SELECT 
  i.id,
  CASE 
    -- Para o usuário específico, mapear por tipo
    WHEN i.user_id = (SELECT id FROM auth.users WHERE email = 'ssy.igor@gmail.com' LIMIT 1) THEN
      CASE i.tipo
        WHEN 'anime' THEN (SELECT id FROM user_lists WHERE user_id = i.user_id AND nome = 'Animes' LIMIT 1)
        WHEN 'animacao' THEN (SELECT id FROM user_lists WHERE user_id = i.user_id AND nome = 'Animações' LIMIT 1)
        WHEN 'serie' THEN (SELECT id FROM user_lists WHERE user_id = i.user_id AND nome = 'Séries' LIMIT 1)
        ELSE (SELECT id FROM user_lists WHERE user_id = i.user_id AND nome = 'Minha Lista' LIMIT 1)
      END
    -- Para outros usuários, adicionar à "Minha Lista"
    ELSE (SELECT id FROM user_lists WHERE user_id = i.user_id AND nome = 'Minha Lista' LIMIT 1)
  END,
  i.data_criacao
FROM items i
WHERE i.tipo IS NOT NULL
ON CONFLICT (item_id, list_id) DO NOTHING;

-- 5. Migrar itens com status 'planejado' para a Lista de Desejos
INSERT INTO item_lists (item_id, list_id, data_adicao)
SELECT 
  i.id,
  (SELECT id FROM user_lists WHERE user_id = i.user_id AND nome = 'Lista de Desejos' LIMIT 1),
  i.data_criacao
FROM items i
WHERE i.status = 'planejado'
ON CONFLICT (item_id, list_id) DO NOTHING;

-- 6. Verificação da migração
SELECT 
  'Migração concluída!' as status,
  (SELECT COUNT(*) FROM user_lists) as total_lists,
  (SELECT COUNT(*) FROM item_lists) as total_relationships,
  (SELECT COUNT(*) FROM items) as total_items;
-- ============================================
-- MIGRAÇÃO: Sistema de Listas Customizáveis
-- ============================================

-- 1. Criar tabela user_lists
CREATE TABLE IF NOT EXISTS user_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    ordem INTEGER DEFAULT 0,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, nome)
);

-- 2. Criar tabela item_lists (relacionamento muitos-para-muitos)
CREATE TABLE IF NOT EXISTS item_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
    data_adicao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(item_id, list_id)
);

-- 3. Modificar constraint CHECK da tabela items para ser mais flexível
-- Primeiro, removemos a constraint existente se ela existir
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'items_tipo_check' 
        AND conrelid = 'items'::regclass
    ) THEN
        ALTER TABLE items DROP CONSTRAINT items_tipo_check;
    END IF;
END $$;

-- Adicionar nova constraint mais flexível (aceita NULL e tipos adicionais)
ALTER TABLE items 
ADD CONSTRAINT items_tipo_check 
CHECK (tipo IS NULL OR tipo IN ('anime', 'animacao', 'serie', 'filme'));

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_lists_user_id ON user_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lists_ordem ON user_lists(user_id, ordem);
CREATE INDEX IF NOT EXISTS idx_item_lists_item_id ON item_lists(item_id);
CREATE INDEX IF NOT EXISTS idx_item_lists_list_id ON item_lists(list_id);

-- 5. Ativar RLS e criar políticas para user_lists
ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas listas" 
    ON user_lists FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar listas" 
    ON user_lists FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar listas" 
    ON user_lists FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar listas (exceto sistema)" 
    ON user_lists FOR DELETE 
    USING (auth.uid() = user_id AND is_system = FALSE);

-- 6. Ativar RLS e criar políticas para item_lists
ALTER TABLE item_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Relacionamentos via user_id" 
    ON item_lists FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_lists 
            WHERE user_lists.id = list_id AND user_lists.user_id = auth.uid()
        )
    );

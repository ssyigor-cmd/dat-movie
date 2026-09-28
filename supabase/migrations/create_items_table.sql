-- Schema da tabela `items`.
--
-- Antes desta migration o DDL de `items` só existia no README, o que fazia o
-- setup do banco depender de prosa. Este arquivo é a fonte da verdade.
--
-- Idempotente: pode ser reaplicado em banco já existente sem efeito colateral.
--
-- NOTA DE ESTADO: o CHECK de `tipo` aqui já é o versão FINAL (permite NULL),
-- igual ao que `create_lists_tables.sql` aplica. Não reintroduza
-- `tipo NOT NULL` — o código em `trendingApi.getNewEpisodes` tolera `tipo` nulo
-- de propósito, e um CHECK estrito rejeitaria esses itens no insert.

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'serie',
    temporada INTEGER DEFAULT 1,
    episodio INTEGER DEFAULT 0,
    total_episodios INTEGER DEFAULT 1,
    season_episodes_map JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'assistindo'
        CHECK (status IN ('assistindo', 'concluido', 'planejado', 'pausado')),
    tier VARCHAR(5) CHECK (tier IN ('S+', 'S', 'A', 'B', 'C', 'D')),
    imagem TEXT,
    tmdb_id INTEGER,
    ano INTEGER,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT items_tipo_check
        CHECK (tipo IS NULL OR tipo IN ('anime', 'animacao', 'serie'))
);

-- Dispara automaticamente em qualquer UPDATE.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
-- Serve a query principal do app: WHERE user_id = ? ORDER BY data_criacao DESC
CREATE INDEX IF NOT EXISTS idx_items_user_data_criacao ON items(user_id, data_criacao DESC);

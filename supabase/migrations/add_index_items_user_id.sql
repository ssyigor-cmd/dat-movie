-- Migration: índice para otimizar busca de itens por usuário
-- Fase 3 - decisão 10

CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);

-- ============================================================
-- Tabela para backup de sessões WhatsApp (Baileys)
-- Permite que sessões sobrevivam a restarts do servidor
-- Executar no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL UNIQUE REFERENCES negocios(id) ON DELETE CASCADE,
  arquivos     JSONB NOT NULL DEFAULT '{}',  -- mapa nome_arquivo → conteúdo JSON
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_negocio ON whatsapp_sessions(negocio_id);

-- RLS: somente service_role (API) acessa — nunca expor via anon key
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions FORCE ROW LEVEL SECURITY;

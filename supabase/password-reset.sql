-- ============================================================
-- Tabela para tokens de redefinição de senha
-- Executar no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_em  TIMESTAMPTZ NOT NULL,
  usado      BOOLEAN NOT NULL DEFAULT false,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca rápida por hash
CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);

-- Limpeza automática: remove tokens expirados diariamente
-- (opcional — pode ser feito por cron job ou trigger)

-- RLS: somente service_role (API) acessa
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
-- Nenhuma policy anon — toda operação via service_role da API

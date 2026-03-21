-- ============================================================
-- Tabela de Clientes por Negócio
-- Executar APÓS evolucao-profiles.sql (depende de negocios)
-- Cada cliente único (por telefone) por negócio é registrado
-- automaticamente no momento do agendamento.
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nome         TEXT        NOT NULL,
  telefone     TEXT        NOT NULL,
  total_agendamentos INTEGER NOT NULL DEFAULT 1,
  ultimo_agendamento TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, telefone)
);

CREATE INDEX IF NOT EXISTS idx_clientes_negocio   ON clientes (negocio_id);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone  ON clientes (negocio_id, telefone);

-- RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select_service_role" ON clientes FOR SELECT USING (true);
CREATE POLICY "clientes_insert_service_role" ON clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "clientes_update_service_role" ON clientes FOR UPDATE USING (true);

-- Trigger de atualizado_em
DROP TRIGGER IF EXISTS trg_clientes_updated ON clientes;
CREATE TRIGGER trg_clientes_updated
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- ============================================================
-- Função: registrar ou atualizar cliente após novo agendamento
-- Incrementa total_agendamentos atomicamente via ON CONFLICT
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_cliente_agendamento(
  p_negocio_id   UUID,
  p_nome         TEXT,
  p_telefone     TEXT,
  p_data_hora    TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO clientes (negocio_id, nome, telefone, total_agendamentos, ultimo_agendamento)
  VALUES (p_negocio_id, p_nome, p_telefone, 1, p_data_hora)
  ON CONFLICT (negocio_id, telefone) DO UPDATE
    SET total_agendamentos = clientes.total_agendamentos + 1,
        ultimo_agendamento  = GREATEST(clientes.ultimo_agendamento, p_data_hora),
        nome                = p_nome,
        atualizado_em       = now();
END;
$$;

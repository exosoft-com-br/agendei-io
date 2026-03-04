-- ============================================================
-- Plataforma de Agendamentos via WhatsApp
-- Schema PostgreSQL para Supabase
-- ============================================================

-- 1. NICHOS
CREATE TABLE nichos (
  id TEXT PRIMARY KEY,
  nome_publico TEXT NOT NULL,
  tipo_cliente TEXT NOT NULL DEFAULT 'cliente',
  saudacao_inicial TEXT NOT NULL,
  texto_confirmacao TEXT NOT NULL,
  termos JSONB NOT NULL DEFAULT '{"servico": "serviço", "prestador": "profissional"}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PRESTADORES
CREATE TABLE prestadores (
  id TEXT PRIMARY KEY,
  nicho_id TEXT NOT NULL REFERENCES nichos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  horario_inicio TEXT NOT NULL DEFAULT '08:00',
  horario_fim TEXT NOT NULL DEFAULT '18:00',
  dias_semana INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  whatsapp_numero TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SERVICOS
CREATE TABLE servicos (
  id TEXT PRIMARY KEY,
  nicho_id TEXT NOT NULL REFERENCES nichos(id) ON DELETE CASCADE,
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 30,
  preco NUMERIC(10,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. AGENDAMENTOS
CREATE TABLE agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho_id TEXT NOT NULL REFERENCES nichos(id),
  prestador_id TEXT NOT NULL REFERENCES prestadores(id),
  servico_id TEXT NOT NULL REFERENCES servicos(id),
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado','cancelado','concluido')),
  protocolo TEXT UNIQUE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_agendamentos_prestador_status_data
  ON agendamentos (prestador_id, status, data_hora);

CREATE INDEX idx_agendamentos_protocolo
  ON agendamentos (protocolo);

CREATE INDEX idx_prestadores_nicho
  ON prestadores (nicho_id, ativo);

CREATE INDEX idx_servicos_nicho
  ON servicos (nicho_id, ativo);

-- RLS (Row Level Security)
ALTER TABLE nichos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas: leitura pública para config
CREATE POLICY "Nichos são públicos" ON nichos FOR SELECT USING (true);
CREATE POLICY "Prestadores são públicos" ON prestadores FOR SELECT USING (true);
CREATE POLICY "Serviços são públicos" ON servicos FOR SELECT USING (true);

-- Agendamentos: leitura/escrita via API (service_role) ou anon com restrições
CREATE POLICY "Agendamentos leitura via API" ON agendamentos FOR SELECT USING (true);
CREATE POLICY "Agendamentos inserção via API" ON agendamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Agendamentos atualização via API" ON agendamentos FOR UPDATE USING (true);

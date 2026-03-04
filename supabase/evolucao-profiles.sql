-- ============================================================
-- Evolução: Perfis de Negócio + Personalização + Calendário
-- Executar no SQL Editor do Supabase APÓS schema.sql
-- NOTA: Usa profiles_atendimentos para não conflitar com profiles do Auth
-- ============================================================

-- ==============================
-- 1. PROFILES_ATENDIMENTOS — donos de negócio (vinculados ao Supabase Auth)
-- ==============================
CREATE TABLE IF NOT EXISTS profiles_atendimentos (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','staff')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_atend_email ON profiles_atendimentos (email);

-- ==============================
-- 2. NEGÓCIOS — cada profile pode ter múltiplos negócios (1 por nicho)
-- ==============================
CREATE TABLE IF NOT EXISTS negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles_atendimentos(id) ON DELETE CASCADE,
  nicho_id TEXT NOT NULL REFERENCES nichos(id) ON DELETE CASCADE,
  nome_fantasia TEXT NOT NULL,
  descricao TEXT,
  telefone_comercial TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT DEFAULT 'SP',
  cnpj_cpf TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, nicho_id)
);

CREATE INDEX IF NOT EXISTS idx_negocios_owner ON negocios (owner_id);
CREATE INDEX IF NOT EXISTS idx_negocios_nicho ON negocios (nicho_id);

-- ==============================
-- 3. PERSONALIZAÇÕES VISUAIS — cores, logo, branding do negócio
-- ==============================
CREATE TABLE IF NOT EXISTS personalizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,                                   -- URL do logo no Supabase Storage
  favicon_url TEXT,                                -- URL do favicon
  cor_primaria TEXT NOT NULL DEFAULT '#667eea',     -- cor principal (hex)
  cor_secundaria TEXT NOT NULL DEFAULT '#764ba2',   -- cor gradiente (hex)
  cor_texto TEXT NOT NULL DEFAULT '#ffffff',        -- cor do texto sobre primária
  cor_fundo TEXT NOT NULL DEFAULT '#f5f5f5',        -- cor de fundo geral
  cor_botao TEXT NOT NULL DEFAULT '#667eea',        -- cor dos botões
  cor_botao_texto TEXT NOT NULL DEFAULT '#ffffff',  -- cor do texto dos botões
  fonte_titulo TEXT NOT NULL DEFAULT 'Segoe UI',   -- fonte dos títulos
  fonte_corpo TEXT NOT NULL DEFAULT 'Segoe UI',    -- fonte do corpo
  banner_url TEXT,                                  -- banner opcional
  css_customizado TEXT,                             -- CSS extra (avançado)
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personalizacoes_negocio ON personalizacoes (negocio_id);

-- ==============================
-- 4. INTEGRACOES_EMAIL — sincronização de calendário
-- ==============================
CREATE TABLE IF NOT EXISTS integracoes_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  prestador_id TEXT NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  provedor TEXT NOT NULL CHECK (provedor IN ('google','outlook','apple','ical','smtp')),
  email_calendario TEXT NOT NULL,               -- email do calendário a sincronizar
  -- Tokens OAuth (criptografados no futuro)
  access_token TEXT,
  refresh_token TEXT,
  token_expira_em TIMESTAMPTZ,
  -- Configurações de notificação por email
  enviar_confirmacao BOOLEAN NOT NULL DEFAULT true,
  enviar_cancelamento BOOLEAN NOT NULL DEFAULT true,
  enviar_lembrete BOOLEAN NOT NULL DEFAULT true,
  lembrete_horas_antes INTEGER NOT NULL DEFAULT 24,
  -- Status
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','erro','desconectado')),
  ultimo_sync TIMESTAMPTZ,
  erro_mensagem TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, prestador_id, provedor)
);

CREATE INDEX IF NOT EXISTS idx_integracoes_negocio ON integracoes_email (negocio_id);
CREATE INDEX IF NOT EXISTS idx_integracoes_prestador ON integracoes_email (prestador_id);

-- ==============================
-- 5. VINCULAR prestadores ao negócio (dono)
-- ==============================
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS negocio_id UUID REFERENCES negocios(id) ON DELETE SET NULL;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_prestadores_negocio ON prestadores (negocio_id);

-- ==============================
-- 6. VINCULAR nichos ao dono (quem criou)
-- ==============================
ALTER TABLE nichos ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles_atendimentos(id) ON DELETE SET NULL;
ALTER TABLE nichos ADD COLUMN IF NOT EXISTS slug TEXT;

-- ==============================
-- 7. STORAGE — bucket para logos e imagens
-- ==============================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,  -- 2MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  5242880,  -- 5MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ==============================
-- 8. RLS — Políticas de segurança (DROP antes de CREATE para idempotência)
-- ==============================

-- PROFILES_ATENDIMENTOS: usuário só lê/atualiza o próprio
ALTER TABLE profiles_atendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profatend_select_own" ON profiles_atendimentos;
CREATE POLICY "profatend_select_own"
  ON profiles_atendimentos FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profatend_insert_own" ON profiles_atendimentos;
CREATE POLICY "profatend_insert_own"
  ON profiles_atendimentos FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profatend_update_own" ON profiles_atendimentos;
CREATE POLICY "profatend_update_own"
  ON profiles_atendimentos FOR UPDATE
  USING (auth.uid() = id);

-- NEGOCIOS: dono lê/atualiza os próprios
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "negocios_select_own" ON negocios;
CREATE POLICY "negocios_select_own"
  ON negocios FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "negocios_select_public_active" ON negocios;
CREATE POLICY "negocios_select_public_active"
  ON negocios FOR SELECT
  USING (ativo = true);

DROP POLICY IF EXISTS "negocios_insert_own" ON negocios;
CREATE POLICY "negocios_insert_own"
  ON negocios FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "negocios_update_own" ON negocios;
CREATE POLICY "negocios_update_own"
  ON negocios FOR UPDATE
  USING (owner_id = auth.uid());

-- PERSONALIZACOES: dono do negócio pode ler/atualizar
ALTER TABLE personalizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personalizacoes_select_public" ON personalizacoes;
CREATE POLICY "personalizacoes_select_public"
  ON personalizacoes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "personalizacoes_insert_own" ON personalizacoes;
CREATE POLICY "personalizacoes_insert_own"
  ON personalizacoes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM negocios WHERE negocios.id = negocio_id AND negocios.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "personalizacoes_update_own" ON personalizacoes;
CREATE POLICY "personalizacoes_update_own"
  ON personalizacoes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM negocios WHERE negocios.id = negocio_id AND negocios.owner_id = auth.uid())
  );

-- INTEGRACOES_EMAIL: dono do negócio
ALTER TABLE integracoes_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integracoes_select_own" ON integracoes_email;
CREATE POLICY "integracoes_select_own"
  ON integracoes_email FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM negocios WHERE negocios.id = negocio_id AND negocios.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "integracoes_insert_own" ON integracoes_email;
CREATE POLICY "integracoes_insert_own"
  ON integracoes_email FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM negocios WHERE negocios.id = negocio_id AND negocios.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "integracoes_update_own" ON integracoes_email;
CREATE POLICY "integracoes_update_own"
  ON integracoes_email FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM negocios WHERE negocios.id = negocio_id AND negocios.owner_id = auth.uid())
  );

-- STORAGE: qualquer um lê logos (público), só autenticado faz upload
DROP POLICY IF EXISTS "logos_select_public" ON storage.objects;
CREATE POLICY "logos_select_public" ON storage.objects
  FOR SELECT USING (bucket_id IN ('logos', 'banners'));

DROP POLICY IF EXISTS "logos_insert_auth" ON storage.objects;
CREATE POLICY "logos_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('logos', 'banners')
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "logos_update_auth" ON storage.objects;
CREATE POLICY "logos_update_auth" ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('logos', 'banners')
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "logos_delete_auth" ON storage.objects;
CREATE POLICY "logos_delete_auth" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('logos', 'banners')
    AND auth.role() = 'authenticated'
  );

-- ==============================
-- 9. TRIGGER — auto-criar profile_atendimento ao registrar no Auth
-- ==============================
CREATE OR REPLACE FUNCTION public.handle_new_user_atendimentos()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles_atendimentos (id, email, nome_completo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_atendimentos ON auth.users;
CREATE TRIGGER on_auth_user_created_atendimentos
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_atendimentos();

-- ==============================
-- 10. FUNCTION — atualizar timestamp automaticamente
-- ==============================
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profatend_updated ON profiles_atendimentos;
CREATE TRIGGER trg_profatend_updated
  BEFORE UPDATE ON profiles_atendimentos FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
DROP TRIGGER IF EXISTS trg_negocios_updated ON negocios;
CREATE TRIGGER trg_negocios_updated
  BEFORE UPDATE ON negocios FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
DROP TRIGGER IF EXISTS trg_personalizacoes_updated ON personalizacoes;
CREATE TRIGGER trg_personalizacoes_updated
  BEFORE UPDATE ON personalizacoes FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
DROP TRIGGER IF EXISTS trg_integracoes_updated ON integracoes_email;
CREATE TRIGGER trg_integracoes_updated
  BEFORE UPDATE ON integracoes_email FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
DROP TRIGGER IF EXISTS trg_nichos_updated ON nichos;
CREATE TRIGGER trg_nichos_updated
  BEFORE UPDATE ON nichos FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

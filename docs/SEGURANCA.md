# 🔒 Segurança — Plataforma de Agendamentos

## Camadas de Proteção Implementadas

### 1. Supabase RLS (Row Level Security)
- **Tabelas de configuração** (`nichos`, `prestadores`, `servicos`): somente leitura (SELECT) para `anon`
- **Tabela `agendamentos`**: **sem acesso** via `anon` key — todas as operações passam pelo servidor usando `service_role`
- **FORCE ROW LEVEL SECURITY** habilitado na tabela `agendamentos`
- Arquivo: `supabase/rls-policies.sql`

### 2. Headers de Segurança (Helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` restritiva
- `X-Powered-By` removido

### 3. CORS Restritivo
Origens permitidas:
- `https://exosoft-com-br.github.io` (frontend GitHub Pages)
- `http://localhost:3000` / `http://localhost:5173` (desenvolvimento)
- Origens adicionais via `ALLOWED_ORIGINS` env var

### 4. Rate Limiting (4 camadas)
| Endpoint | Limite | Janela |
|----------|--------|--------|
| Geral (todos) | 500 req | 15 min |
| `/api/auth/*` | 30 req | 5 min |
| `/api/booking` | 10 req | 15 min |
| `/api/whatsapp/webhook` | 200 req | 1 min |

### 5. Sanitização de Input
- **`sanitizar()`**: Remove tags HTML/JavaScript de strings de texto
- **`sanitizarId()`**: Permite apenas `[a-zA-Z0-9_-]` em IDs
- **`validarTelefone()`**: Valida formato numérico com 12-13 dígitos
- **`validarDataHora()`**: Valida formato ISO 8601
- Aplicado em **todas** as rotas (booking, availability, nichoConfig)

### 6. Autenticação JWT + OAuth
- **JWT** com tokens de 24h, assinados com `JWT_SECRET`
- **bcrypt** com 12 rounds para hash de senhas
- **Roles**: `admin` (acesso total) e `usuario` (acesso restrito)
- Primeiro usuário registrado recebe automaticamente role `admin`
- **Google OAuth**: Verificação de ID token via `google-auth-library`
- **Facebook OAuth**: Verificação via Graph API (`debug_token` + `/me`)

### 7. Proteções Adicionais
- Body size limitado a **10KB** (`express.json({ limit: "10kb" })`)
- **Trust proxy** habilitado para IP correto atrás do Render
- **404 handler** para rotas não encontradas
- Variáveis sensíveis apenas via **environment variables** (nunca hardcoded)
- `.env` no `.gitignore`

## Variáveis de Ambiente (Produção)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Chave secreta (bypass RLS) |
| `SUPABASE_ANON_KEY` | ⚠️ | Fallback — prefira service_role |
| `JWT_SECRET` | ✅ | Chave secreta para assinar tokens JWT |
| `PORT` | ❌ | Porta do servidor (default: 3000) |
| `ALLOWED_ORIGINS` | ❌ | Origens CORS extras (vírgula-separado) |
| `GOOGLE_CLIENT_ID` | ❌ | Client ID para login com Google |
| `FACEBOOK_APP_ID` | ❌ | App ID para login com Facebook |
| `FACEBOOK_APP_SECRET` | ❌ | App Secret para login com Facebook |
| `SMTP_HOST` | ❌ | Servidor SMTP para convites de calendário |
| `SMTP_PORT` | ❌ | Porta SMTP (default: 587) |
| `SMTP_USER` | ❌ | Usuário SMTP |
| `SMTP_PASS` | ❌ | Senha SMTP |
| `SMTP_FROM` | ❌ | E-mail remetente |
| `WEBHOOK_AUTH_TOKEN` | ❌ | Token de autenticação para webhooks |

## Deploy Seguro no Render

1. **Nunca** commitar `.env` no Git
2. Configurar variáveis de ambiente no **Dashboard do Render** → Environment
3. A `SUPABASE_SERVICE_ROLE_KEY` deve ser marcada como **secret**
4. Após deploy, testar que a anon key não acessa `agendamentos` diretamente

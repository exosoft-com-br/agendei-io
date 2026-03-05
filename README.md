# Plataforma de Agendamentos via WhatsApp

> Plataforma genérica de agendamentos via WhatsApp, multi-nicho.
> Backend em Express.js + Supabase (PostgreSQL), deploy no Render.

---

## O que faz?

Permite que qualquer negócio (barbearia, clínica, consultoria, pet shop, etc.)
ofereça **agendamento automatizado via WhatsApp**, sem precisar de app ou site.

O cliente envia uma mensagem no WhatsApp → o bot guia pelo fluxo →
o agendamento é criado automaticamente.

**Mudar de nicho = mudar dados no banco, não código.**

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Backend | Express.js (TypeScript) |
| Banco de Dados | Supabase (PostgreSQL + RLS) |
| Hosting Frontend | GitHub Pages |
| API Deploy | Render (Node.js) |
| Bot | Typebot (low-code conversacional) |
| WhatsApp | Evolution API (open source) |
| Auth | JWT + bcrypt (roles: admin/usuario) |
| Segurança | Helmet, CORS whitelist, Rate Limiting |

---

## Estrutura do Projeto

```
plataforma-agendamentos/
├── server/                         # Backend Express.js
│   ├── src/
│   │   ├── index.ts                # Entry point — configura Express, rotas, segurança
│   │   ├── supabaseClient.ts       # Cliente Supabase (service_role)
│   │   ├── middleware/
│   │   │   └── auth.ts             # JWT auth middleware (autenticar, apenasAdmin)
│   │   ├── routes/
│   │   │   ├── auth.ts             # Login, registro, OAuth Google/Facebook
│   │   │   ├── availability.ts     # GET /api/availability
│   │   │   ├── booking.ts          # POST /api/booking, /api/booking/cancel
│   │   │   ├── calendario.ts       # CRUD /api/integracoes/email
│   │   │   ├── negocio.ts          # CRUD /api/negocios
│   │   │   ├── nichoConfig.ts      # GET /api/nicho
│   │   │   ├── profile.ts          # GET/PUT /api/profile
│   │   │   └── webhook.ts          # POST /api/whatsapp/webhook
│   │   └── utils/
│   │       ├── calendario.ts       # Geração de slots de horário
│   │       ├── gerarProtocolo.ts   # Protocolo único AGD-YYYY-XXXX
│   │       ├── notificacao.ts      # Envio de emails
│   │       ├── sanitizar.ts        # Sanitização de inputs
│   │       ├── validarHorario.ts   # Validação de conflitos
│   │       └── whatsappAdapter.ts  # Adaptador Evolution API
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                        # Variáveis de ambiente (não commitado)
│
├── docs/                           # Frontend (GitHub Pages)
│   ├── index.html                  # Página pública do negócio
│   └── admin.html                  # Painel administrativo (SPA)
│
├── supabase/                       # Schemas e migrations SQL
│   ├── schema.sql                  # Schema principal
│   ├── evolucao-profiles.sql       # Negócios, personalização, integrações
│   ├── usuarios.sql                # Tabela de autenticação
│   ├── fix-fk-usuarios.sql         # Correção de FKs
│   ├── add-cep-bairro.sql          # Campo bairro
│   ├── rls-policies.sql            # Políticas RLS
│   └── seed.sql                    # Dados de exemplo
│
├── bots/                           # Documentação do Typebot
│   ├── typebot-fluxo-agendamento.md
│   └── typebot-cloud-setup.md
│
├── render.yaml                     # Config de deploy no Render
├── .gitignore
└── README.md
```

---

## Setup Rápido

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (gratuito)
- Conta no [Render](https://render.com) (gratuito)

### 1. Clonar e instalar

```bash
git clone https://github.com/exosoft-com-br/plataforma-agendamentos.git
cd plataforma-agendamentos/server
npm install
```

### 2. Configurar Supabase

1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. No SQL Editor, execute na ordem:
   - `supabase/schema.sql`
   - `supabase/evolucao-profiles.sql`
   - `supabase/usuarios.sql`
   - `supabase/fix-fk-usuarios.sql`
   - `supabase/add-cep-bairro.sql`
   - `supabase/rls-policies.sql`
   - `supabase/seed.sql` (opcional — dados de exemplo)

### 3. Configurar variáveis de ambiente

```bash
cd server
cp .env.example .env
# Editar .env com suas chaves do Supabase
```

Variáveis necessárias:
```
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
JWT_SECRET=sua-chave-secreta-jwt
ALLOWED_ORIGINS=http://localhost:3000,https://seu-dominio.com
```

### 4. Rodar localmente

```bash
cd server
npm run build
npm start
```

O servidor inicia em http://localhost:3000

### 5. Deploy no Render

1. Conecte o repositório GitHub no [Render Dashboard](https://dashboard.render.com)
2. O `render.yaml` configura tudo automaticamente
3. Adicione as variáveis de ambiente no Render Dashboard
4. Push no branch `master` dispara auto-deploy

---

## API — Endpoints

Base URL: `https://plataforma-agendamentos-api.onrender.com`

### Auth

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Criar conta (primeiro = admin) |
| POST | `/api/auth/login` | Login email/senha |
| POST | `/api/auth/google` | Login via Google OAuth |
| POST | `/api/auth/facebook` | Login via Facebook OAuth |
| GET | `/api/auth/me` | Dados do usuário logado |
| GET | `/api/auth/usuarios` | Listar usuários (admin) |
| POST | `/api/auth/usuarios` | Criar usuário (admin) |
| DELETE | `/api/auth/usuarios/:id` | Remover usuário (admin) |

### Negócios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/negocios` | Criar negócio |
| GET | `/api/negocios/:ownerId` | Listar negócios do dono |
| PUT | `/api/negocios/:id` | Atualizar negócio |
| DELETE | `/api/negocios/:id` | Excluir negócio (cascade) |

### Agendamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/availability` | Horários disponíveis |
| POST | `/api/booking` | Criar agendamento |
| POST | `/api/booking/cancel` | Cancelar agendamento |
| GET | `/api/nicho` | Config do nicho |

### Personalização e Integrações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/PUT | `/api/negocios/:id/personalizacao` | Visual do negócio |
| GET/PUT | `/api/profile/:userId` | Perfil do usuário |
| GET/POST/PUT/DELETE | `/api/integracoes/email` | Integrações de email |

---

## Painel Admin

Acesse: https://exosoft-com-br.github.io/plataforma-agendamentos/admin.html

Funcionalidades:
- Login com email/senha (Google e Facebook opcionais)
- Gerenciamento de negócios (criar, editar, excluir)
- Personalização visual (cores, fontes, logo)
- Gerenciamento de serviços e agendamentos
- Integrações de email/calendário
- Controle de acesso por roles (admin/usuario)

---

## Roadmap

- [x] Backend Express.js + Supabase
- [x] Sistema de autenticação JWT
- [x] Painel administrativo
- [x] Personalização visual por negócio
- [x] Busca de CEP via ViaCEP
- [x] Deploy no Render + GitHub Pages
- [x] Rate limiting e segurança
- [ ] Notificações de lembrete (24h antes)
- [ ] Relatórios e dashboard
- [ ] Integração WhatsApp (Evolution API)
- [ ] Pagamento online integrado

---

## Licença

Projeto privado — uso interno.

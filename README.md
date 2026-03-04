# 🗓️ Plataforma de Agendamentos via WhatsApp

> Plataforma genérica de agendamentos via WhatsApp, multi-nicho, serverless,
> rodando 100% no ecossistema Google/Firebase.

---

## 🎯 O que faz?

Permite que qualquer negócio (barbearia, clínica, consultoria, pet shop, etc.)
ofereça **agendamento automatizado via WhatsApp**, sem precisar de app ou site.

O cliente envia uma mensagem no WhatsApp → o bot guia pelo fluxo →
o agendamento é criado automaticamente.

**Mudar de nicho = mudar dados no Firestore, não código.**

---

## 🏗️ Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Backend | Firebase Cloud Functions (TypeScript) |
| Banco de Dados | Cloud Firestore (NoSQL) |
| Hosting | Firebase Hosting |
| Bot | Typebot (low-code conversacional) |
| WhatsApp | Evolution API (open source) |
| Segredos | Google Cloud Secret Manager |
| Infra | Google Cloud Platform |

---

## 📁 Estrutura do Projeto

```
plataforma-agendamentos/
│
├── backend/
│   └── functions/
│       ├── src/
│       │   ├── index.ts              # Entry point — exporta todas as functions
│       │   ├── availability.ts       # getAvailableSlots
│       │   ├── booking.ts            # createBooking, cancelBooking
│       │   ├── nichoConfig.ts        # getNichoConfig
│       │   ├── whatsappWebhook.ts    # Webhook do WhatsApp
│       │   ├── models/
│       │   │   ├── Agendamento.ts
│       │   │   ├── Nicho.ts
│       │   │   ├── Prestador.ts
│       │   │   └── Servico.ts
│       │   └── utils/
│       │       ├── gerarProtocolo.ts
│       │       ├── validarHorario.ts
│       │       └── whatsappAdapter.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
│
├── firestore/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── seeds/                        # Dados de exemplo por nicho
│
├── bots/
│   └── typebot-fluxo-agendamento.md  # Fluxo detalhado do bot
│
├── config/
│   └── nichos/                       # Configurações JSON por nicho
│
├── infra/
│   ├── gcp-setup.md                  # Setup GCP + Firebase
│   ├── arquitetura.md                # Diagrama de arquitetura
│   └── secrets.md                    # Gerenciamento de segredos
│
├── public/
│   └── index.html                    # Página do Firebase Hosting
│
├── firebase.json
├── .firebaserc
├── .gitignore
└── README.md
```

---

## 🚀 Setup Rápido

### Pré-requisitos

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Conta Google Cloud com faturamento habilitado
- Projeto Firebase criado

### 1. Clonar e instalar dependências

```bash
git clone <seu-repo>
cd plataforma-agendamentos
cd backend/functions
npm install
```

### 2. Configurar o projeto Firebase

```bash
firebase login
firebase use agendamentos-poc
```

### 3. Configurar variáveis de ambiente (desenvolvimento)

```bash
cd backend/functions
cp .env.example .env
# Editar .env com seus valores reais
```

### 4. Rodar localmente com emuladores

```bash
# Na raiz do projeto
firebase emulators:start
```

Acesse:
- **Emulator UI:** http://localhost:4000
- **Functions:** http://localhost:5001
- **Firestore:** http://localhost:8080
- **Hosting:** http://localhost:5000

### 5. Carregar dados de exemplo

No painel do Emulator UI (http://localhost:4000/firestore), importe
os arquivos de `firestore/seeds/` para popular o banco com dados de teste.

### 6. Deploy em produção

```bash
# Configurar segredos no Secret Manager (ver infra/secrets.md)

# Deploy completo
firebase deploy

# Ou deploy seletivo
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

---

## 📡 API — Endpoints

Todos os endpoints estão na região `southamerica-east1`.

### GET `/getAvailableSlots`

Consulta horários disponíveis.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `prestadorId` | string | Sim | ID do prestador |
| `servicoId` | string | Sim | ID do serviço |
| `data` | string | Não | Data YYYY-MM-DD (padrão: hoje) |

```bash
curl "https://REGION-PROJECT.cloudfunctions.net/getAvailableSlots?prestadorId=barbeiro-pedro&servicoId=corte-simples"
```

### POST `/createBooking`

Cria um agendamento.

```bash
curl -X POST "https://REGION-PROJECT.cloudfunctions.net/createBooking" \
  -H "Content-Type: application/json" \
  -d '{
    "nichoId": "barbearia",
    "prestadorId": "barbeiro-pedro",
    "servicoId": "corte-simples",
    "clienteNome": "José Silva",
    "clienteTelefone": "5511999999999",
    "dataHora": "2026-03-04T09:00:00"
  }'
```

### POST `/cancelBooking`

Cancela um agendamento.

```bash
curl -X POST "https://REGION-PROJECT.cloudfunctions.net/cancelBooking" \
  -H "Content-Type: application/json" \
  -d '{
    "protocolo": "AGD-2026-A3F7",
    "clienteTelefone": "5511999999999"
  }'
```

### GET `/getNichoConfig`

Retorna configuração completa do nicho.

```bash
curl "https://REGION-PROJECT.cloudfunctions.net/getNichoConfig?nichoId=barbearia"
```

### POST `/whatsappWebhook`

Recebe mensagens do WhatsApp (usado pela Evolution API).

---

## 🧪 Testando

### Com emuladores

```bash
firebase emulators:start
```

### Testar endpoints manualmente

```bash
# Disponibilidade
curl "http://localhost:5001/agendamentos-poc/southamerica-east1/getAvailableSlots?prestadorId=barbeiro-pedro&servicoId=corte-simples&data=2026-03-04"

# Criar agendamento
curl -X POST "http://localhost:5001/agendamentos-poc/southamerica-east1/createBooking" \
  -H "Content-Type: application/json" \
  -d '{"nichoId":"barbearia","prestadorId":"barbeiro-pedro","servicoId":"corte-simples","clienteNome":"Teste","clienteTelefone":"5511999999999","dataHora":"2026-03-04T09:00:00"}'
```

---

## 📚 Documentação Adicional

- [Setup GCP + Firebase](infra/gcp-setup.md)
- [Arquitetura](infra/arquitetura.md)
- [Gerenciamento de Segredos](infra/secrets.md)
- [Fluxo do Bot Typebot](bots/typebot-fluxo-agendamento.md)

---

## 🗺️ Roadmap

- [x] Backend com Cloud Functions
- [x] Modelo de dados Firestore
- [x] Integração WhatsApp (Evolution API)
- [x] Fluxo conversacional (Typebot)
- [ ] Painel admin (Firebase Auth + Hosting)
- [ ] Notificações de lembrete (24h antes)
- [ ] Relatórios e dashboard
- [ ] Migração para Meta Business API
- [ ] Pagamento online integrado

---

## 📄 Licença

Projeto privado — uso interno.

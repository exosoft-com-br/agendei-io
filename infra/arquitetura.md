# 🏗️ Arquitetura da Plataforma de Agendamentos

> Visão geral da arquitetura, componentes e fluxo de dados.

---

## 📐 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ECOSSISTEMA GOOGLE / FIREBASE                     │
│                                                                          │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────────────┐   │
│  │ Firebase │    │  Cloud Functions │    │       Firestore          │   │
│  │ Hosting  │    │  (Serverless)    │    │    (Banco de Dados)      │   │
│  │          │    │                  │    │                          │   │
│  │ - SPA    │    │ - getAvailable   │    │ - nichos/               │   │
│  │ - Painel │    │   Slots          │◄──►│ - prestadores/          │   │
│  │   Admin  │    │ - createBooking  │    │ - servicos/             │   │
│  │  (futuro)│    │ - cancelBooking  │    │ - agendamentos/         │   │
│  │          │    │ - getNichoConfig │    │                          │   │
│  │          │    │ - whatsappWebhook│    │                          │   │
│  └──────────┘    └────────┬─────────┘    └──────────────────────────┘   │
│                           │                                              │
│                           │                                              │
│  ┌────────────────────────┤                                              │
│  │                        │                                              │
│  │  ┌────────────┐   ┌────┴───────────┐    ┌─────────────────────┐     │
│  │  │  Secret     │   │   Cloud Run    │    │   Firebase Auth     │     │
│  │  │  Manager    │   │  (opcional)    │    │   (futuro - admin)  │     │
│  │  │            │   │                │    │                     │     │
│  │  │ - Tokens   │   │ - Evolution    │    │ - Login admin       │     │
│  │  │ - API Keys │   │   API          │    │ - Custom claims     │     │
│  │  │            │   │ - Typebot      │    │                     │     │
│  │  └────────────┘   └────────────────┘    └─────────────────────┘     │
│  │                                                                      │
│  └──────────────────────────────────────────────────────────────────────│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
     ┌────────────────┐     ┌──────────────────┐
     │  Evolution API │     │     Typebot       │
     │  (WhatsApp)    │     │  (Fluxo do Bot)   │
     │                │     │                   │
     │ - Recebe msgs  │     │ - Fluxo visual    │
     │ - Envia msgs   │     │ - Coleta dados    │
     │ - Webhook      │     │ - Chama APIs      │
     └───────┬────────┘     └──────────────────-┘
             │
             ▼
     ┌────────────────┐
     │   WhatsApp      │
     │   (Cliente)     │
     │                 │
     │ 📱 Usuário     │
     │    Final        │
     └────────────────-┘
```

---

## 🔄 Fluxo de Dados — Agendamento Completo

```
1. Cliente envia mensagem no WhatsApp
   │
   ▼
2. Evolution API recebe e faz POST no webhook
   │
   ▼
3. Cloud Function (whatsappWebhook) processa
   │  - Valida autenticação
   │  - Extrai mensagem
   │  - Encaminha para Typebot
   │
   ▼
4. Typebot executa fluxo conversacional
   │  - Coleta nome do cliente
   │  - Mostra serviços (via getNichoConfig)
   │  - Mostra horários (via getAvailableSlots)
   │  - Confirma dados
   │
   ▼
5. Typebot chama Cloud Function (createBooking)
   │  - Valida disponibilidade (transação Firestore)
   │  - Cria agendamento
   │  - Gera protocolo
   │  - Retorna mensagem de confirmação
   │
   ▼
6. Typebot envia resposta via Evolution API
   │
   ▼
7. Cliente recebe confirmação no WhatsApp ✅
```

---

## 📊 Componentes e Responsabilidades

| Componente | Tecnologia | Responsabilidade |
|------------|------------|------------------|
| **Frontend** | Firebase Hosting | Página estática + futuro painel admin |
| **Backend** | Cloud Functions (TypeScript) | Lógica de negócio, APIs REST |
| **Banco de Dados** | Firestore | Persistência de dados (NoSQL) |
| **Bot** | Typebot | Fluxo conversacional visual |
| **WhatsApp** | Evolution API | Envio/recebimento de mensagens |
| **Segredos** | Secret Manager | Armazenamento seguro de tokens |
| **Autenticação** | Firebase Auth (futuro) | Login do painel admin |

---

## 🏢 Modelo Multi-Tenant (Multi-Nicho)

A plataforma suporta múltiplos nichos com a mesma base de código:

```
                    ┌──────────────┐
                    │  CÓDIGO BASE │
                    │  (ÚNICO)     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ Barbearia│ │ Clínica  │ │ Consultoria  │
        │          │ │          │ │              │
        │ Dados no │ │ Dados no │ │ Dados no     │
        │ Firestore│ │ Firestore│ │ Firestore    │
        └──────────┘ └──────────┘ └──────────────┘
```

**Mudar de nicho = mudar dados, não código.**

---

## 💰 Custos e Free Tier

| Serviço | Limite Gratuito | Uso Estimado (PoC) |
|---------|-----------------|---------------------|
| Firestore | 50K leituras/dia | ~500/dia |
| Cloud Functions | 2M invocações/mês | ~5K/mês |
| Hosting | 10GB storage | ~10MB |
| Secret Manager | 6 versões ativas | 5 segredos |
| Cloud Run | 2M requests/mês | ~2K/mês |

**Custo estimado: R$ 0,00/mês** (dentro do free tier)

---

## 🔒 Segurança

1. **Firestore Rules:** Escrita apenas via Admin SDK (nunca pelo client)
2. **Secret Manager:** Tokens nunca no código-fonte
3. **Webhook Auth:** Token de validação para chamadas externas
4. **CORS:** Configurado nas Cloud Functions
5. **IAM:** Menor privilégio para service accounts
6. **Transações:** Firestore transactions para evitar race conditions

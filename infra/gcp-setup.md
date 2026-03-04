# 🏗️ Setup da Infraestrutura — GCP + Firebase

> Guia passo a passo para criar e configurar toda a infraestrutura necessária
> para a Plataforma de Agendamentos via WhatsApp.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:

- **Conta Google** (Gmail serve)
- **Node.js** versão 18 ou superior instalado ([download](https://nodejs.org/))
- **npm** (vem com o Node.js)
- **Git** instalado ([download](https://git-scm.com/))
- **Conta no Google Cloud** com faturamento habilitado (necessário para Functions, mas o free tier cobre a PoC)

### Verificar versões instaladas

```bash
node --version    # Deve ser >= 18.x
npm --version     # Deve ser >= 9.x
git --version     # Qualquer versão recente
```

---

## ETAPA 1 — Criar Projeto no Google Cloud Platform

### 1.1 Via Console Web (recomendado para primeira vez)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/)
2. Clique em **"Selecionar projeto"** no topo da página
3. Clique em **"Novo Projeto"**
4. Configure:
   - **Nome do projeto:** `agendamentos-poc`
   - **ID do projeto:** `agendamentos-poc` (ou aceite o sugerido pelo Google)
   - **Organização:** Deixe "Sem organização" se for conta pessoal
5. Clique em **"Criar"**

### 1.2 Via linha de comando (alternativa)

```bash
# Instalar Google Cloud CLI (se ainda não tiver)
# Windows: baixe em https://cloud.google.com/sdk/docs/install
# Ou via winget:
winget install Google.CloudSDK

# Fazer login na conta Google
gcloud auth login

# Criar o projeto
gcloud projects create agendamentos-poc --name="Agendamentos PoC"

# Definir como projeto ativo
gcloud config set project agendamentos-poc
```

### 1.3 Habilitar faturamento

> ⚠️ **IMPORTANTE:** O Cloud Functions exige faturamento habilitado, mas o free tier
> cobre toda a PoC sem gerar custos. Sem faturamento, o deploy das Functions falhará.

1. Acesse [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
2. Crie uma conta de faturamento (se não tiver)
3. Vincule ao projeto `agendamentos-poc`

```bash
# Via CLI (se já tiver conta de faturamento):
gcloud billing accounts list
gcloud billing projects link agendamentos-poc --billing-account=XXXXXX-XXXXXX-XXXXXX
```

---

## ETAPA 2 — Habilitar Firebase no Projeto

### 2.1 Via Console Firebase (recomendado)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/)
2. Clique em **"Adicionar projeto"**
3. Selecione o projeto GCP existente: **agendamentos-poc**
4. Configure:
   - Google Analytics: **Desabilitar** (não é necessário para a PoC)
5. Clique em **"Continuar"** e depois **"Criar projeto"**

### 2.2 Via CLI (alternativa)

```bash
# O Firebase CLI pode habilitar Firebase em um projeto GCP existente
firebase projects:addfirebase agendamentos-poc
```

---

## ETAPA 3 — Instalar e Configurar Firebase CLI

### 3.1 Instalar globalmente

```bash
npm install -g firebase-tools
```

### 3.2 Verificar instalação

```bash
firebase --version  # Deve exibir >= 13.x
```

### 3.3 Fazer login

```bash
firebase login
```

> Isso abrirá o navegador para autenticação. Faça login com a mesma
> conta Google usada para criar o projeto GCP.

### 3.4 Verificar projetos disponíveis

```bash
firebase projects:list
```

> Você deve ver `agendamentos-poc` na lista.

---

## ETAPA 4 — Inicializar o Projeto Firebase

### 4.1 Navegar até a pasta do projeto

```bash
cd d:\Projetos\plataforma-agendamentos
```

### 4.2 Inicializar Firebase

```bash
firebase init
```

> Responda às perguntas interativas conforme abaixo:

#### Seleção de recursos (use espaço para marcar):

```
◉ Firestore: Configure security rules and indexes files for Firestore
◉ Functions: Configure a Cloud Functions directory and its files
◉ Hosting: Configure files for Firebase Hosting and (optionally) set up GitHub Action deploys
◯ Storage (não necessário)
◯ Emulators (configurar depois)
```

#### Configuração do Firestore:

```
? What file should be used for Firestore Rules? firestore/firestore.rules
? What file should be used for Firestore indexes? firestore/firestore.indexes.json
```

#### Configuração do Functions:

```
? What language would you like to use to write Cloud Functions? TypeScript
? Do you want to use ESLint to catch probable bugs and enforce style? Yes
? Do you want to install dependencies with npm now? Yes

# IMPORTANTE: O Firebase vai criar uma pasta "functions/" na raiz.
# Vamos reorganizar para backend/functions/ depois.
```

#### Configuração do Hosting:

```
? What do you want to use as your public directory? public
? Configure as a single-page app (rewrite all urls to /index.html)? No
? Set up automatic builds and deploys with GitHub? No
```

#### Selecionar projeto:

```
? Please select an option: Use an existing project
? Select a default Firebase project: agendamentos-poc
```

### 4.3 Reorganizar estrutura do Functions

> O Firebase cria `functions/` na raiz. Vamos mover para `backend/functions/`.

```bash
# Windows (PowerShell)
New-Item -ItemType Directory -Path "backend" -Force
Move-Item -Path "functions" -Destination "backend\functions"

# Linux/macOS
# mkdir -p backend
# mv functions backend/functions
```

> Depois, atualize o `firebase.json` para apontar para `backend/functions`
> (o arquivo correto será gerado na FASE 2).

---

## ETAPA 5 — Configurar Firestore

### 5.1 Criar banco Firestore

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/)
2. Selecione o projeto **agendamentos-poc**
3. Menu lateral → **Firestore Database**
4. Clique em **"Criar banco de dados"**
5. Configure:
   - **Modo:** Modo de produção (as regras de segurança serão configuradas na FASE 5)
   - **Localização:** `southamerica-east1` (São Paulo — menor latência para Brasil)

> ⚠️ **ATENÇÃO:** A localização do Firestore **NÃO pode ser alterada depois**.
> Escolha `southamerica-east1` para melhor performance no Brasil.

```bash
# Via CLI (alternativa):
firebase firestore:databases:create --location=southamerica-east1
```

### 5.2 Habilitar APIs necessárias no GCP

```bash
# Habilitar Firestore API
gcloud services enable firestore.googleapis.com --project=agendamentos-poc

# Habilitar Cloud Functions API
gcloud services enable cloudfunctions.googleapis.com --project=agendamentos-poc

# Habilitar Cloud Build API (necessário para deploy de Functions)
gcloud services enable cloudbuild.googleapis.com --project=agendamentos-poc

# Habilitar Secret Manager API (para segredos)
gcloud services enable secretmanager.googleapis.com --project=agendamentos-poc

# Habilitar Artifact Registry (necessário para Cloud Functions v2)
gcloud services enable artifactregistry.googleapis.com --project=agendamentos-poc

# Habilitar Cloud Run (necessário para Functions v2 e Evolution API)
gcloud services enable run.googleapis.com --project=agendamentos-poc
```

---

## ETAPA 6 — Configurar Secret Manager

> **Nunca coloque tokens, chaves de API ou senhas no código-fonte.**
> Use o Secret Manager do GCP para armazenar segredos com segurança.

### 6.1 Criar segredos

```bash
# Token da Evolution API (WhatsApp)
echo -n "SEU_TOKEN_EVOLUTION_API" | gcloud secrets create WHATSAPP_API_TOKEN \
  --data-file=- \
  --project=agendamentos-poc

# URL da Evolution API
echo -n "https://sua-evolution-api.com" | gcloud secrets create WHATSAPP_API_URL \
  --data-file=- \
  --project=agendamentos-poc

# Chave do Typebot
echo -n "SUA_CHAVE_TYPEBOT" | gcloud secrets create TYPEBOT_API_KEY \
  --data-file=- \
  --project=agendamentos-poc

# URL do Typebot
echo -n "https://seu-typebot.com/api/v1/sendMessage" | gcloud secrets create TYPEBOT_WEBHOOK_URL \
  --data-file=- \
  --project=agendamentos-poc

# Token de autenticação do Webhook (para validar chamadas recebidas)
echo -n "SEU_TOKEN_WEBHOOK_SECRETO" | gcloud secrets create WEBHOOK_AUTH_TOKEN \
  --data-file=- \
  --project=agendamentos-poc
```

### 6.2 Dar permissão ao Cloud Functions para ler os segredos

```bash
# Descobrir a service account do Cloud Functions
# Formato padrão: agendamentos-poc@appspot.gserviceaccount.com

# Dar acesso de leitura aos segredos
gcloud secrets add-iam-policy-binding WHATSAPP_API_TOKEN \
  --member="serviceAccount:agendamentos-poc@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=agendamentos-poc

gcloud secrets add-iam-policy-binding WHATSAPP_API_URL \
  --member="serviceAccount:agendamentos-poc@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=agendamentos-poc

gcloud secrets add-iam-policy-binding TYPEBOT_API_KEY \
  --member="serviceAccount:agendamentos-poc@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=agendamentos-poc

gcloud secrets add-iam-policy-binding TYPEBOT_WEBHOOK_URL \
  --member="serviceAccount:agendamentos-poc@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=agendamentos-poc

gcloud secrets add-iam-policy-binding WEBHOOK_AUTH_TOKEN \
  --member="serviceAccount:agendamentos-poc@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=agendamentos-poc
```

### 6.3 Acessar segredos nas Cloud Functions

> Na FASE 4, usaremos o SDK do Secret Manager nas Functions:

```typescript
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const client = new SecretManagerServiceClient();

async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/agendamentos-poc/secrets/${name}/versions/latest`,
  });
  return version.payload?.data?.toString() || "";
}
```

---

## ETAPA 7 — Configurar Emuladores Firebase (Desenvolvimento Local)

> Os emuladores permitem testar tudo localmente sem consumir free tier.

### 7.1 Inicializar emuladores

```bash
firebase init emulators
```

#### Selecione os emuladores:

```
◉ Functions Emulator
◉ Firestore Emulator
◉ Hosting Emulator
```

#### Portas (aceite os padrões ou customize):

```
Functions: 5001
Firestore: 8080
Hosting: 5000
Emulator UI: 4000
```

### 7.2 Rodar emuladores

```bash
firebase emulators:start
```

> Acesse o painel do emulador em: http://localhost:4000

### 7.3 Rodar emuladores com dados seed

```bash
# Importar dados de exemplo ao iniciar
firebase emulators:start --import=./firestore/seeds
```

---

## ETAPA 8 — Verificação Final da Infraestrutura

Execute os comandos abaixo para verificar se tudo está configurado:

```bash
# 1. Verificar projeto ativo
firebase projects:list

# 2. Verificar que o Firestore está criado
gcloud firestore databases list --project=agendamentos-poc

# 3. Verificar APIs habilitadas
gcloud services list --enabled --project=agendamentos-poc | grep -E "firestore|functions|cloudbuild|secretmanager|run|artifactregistry"

# 4. Verificar segredos criados
gcloud secrets list --project=agendamentos-poc

# 5. Verificar emuladores
firebase emulators:start --only firestore
# (deve iniciar sem erros — Ctrl+C para parar)
```

### Checklist de verificação:

- [ ] Projeto GCP `agendamentos-poc` criado
- [ ] Faturamento habilitado no projeto
- [ ] Firebase habilitado no projeto
- [ ] Firebase CLI instalado e autenticado
- [ ] Projeto inicializado com `firebase init`
- [ ] Firestore criado em `southamerica-east1`
- [ ] APIs necessárias habilitadas (6 APIs)
- [ ] Secret Manager configurado com 5 segredos
- [ ] Permissões de leitura dos segredos concedidas
- [ ] Emuladores configurados e funcionando

---

## 📊 Custos Esperados (Free Tier)

| Serviço | Free Tier | Uso Estimado na PoC |
|---------|-----------|---------------------|
| **Firestore** | 50K leituras/dia, 20K escritas/dia | < 1K/dia |
| **Cloud Functions** | 2M invocações/mês, 400K GB-s | < 10K/mês |
| **Cloud Run** | 2M requests/mês | < 5K/mês |
| **Hosting** | 10GB armazenamento, 360MB/dia transferência | < 100MB |
| **Secret Manager** | 6 versões de segredos ativas | 5 segredos |
| **Cloud Build** | 120 min/dia de build | < 10 min/dia |

> **Custo estimado mensal: R$ 0,00** (dentro do free tier para PoC)

---

## ⚠️ Erros Comuns e Soluções

### Erro: "Billing account not found"
**Causa:** Faturamento não habilitado no projeto.
**Solução:** Acesse console.cloud.google.com/billing e vincule uma conta de faturamento.

### Erro: "Permission denied on resource project"
**Causa:** Conta sem permissão de owner ou editor.
**Solução:** Verifique se está logado com a conta correta: `gcloud auth list`

### Erro: "Firestore database already exists"
**Causa:** Tentou criar o Firestore novamente.
**Solução:** Isso é normal — significa que o Firestore já foi criado. Pode seguir em frente.

### Erro: "Cloud Functions require billing"
**Causa:** Faturamento obrigatório para Functions, mesmo usando free tier.
**Solução:** Habilite o faturamento (Etapa 1.3). Não será cobrado dentro do free tier.

### Erro: "Firebase CLI not found"
**Causa:** Firebase CLI não instalado ou não no PATH.
**Solução:** Reinstale com `npm install -g firebase-tools` e reinicie o terminal.

### Erro: "Could not find or access project"
**Causa:** Projeto não vinculado no `.firebaserc` ou login incorreto.
**Solução:** Execute `firebase use agendamentos-poc` ou `firebase login --reauth`

### Erro: "Emulators failed to start — port already in use"
**Causa:** Outra aplicação usando a mesma porta.
**Solução:** Mude as portas no `firebase.json` ou encerre o processo na porta em conflito.

---

## 🔜 Próximos Passos

Após concluir toda a configuração acima, você está pronto para a **FASE 2**:

- Criação dos arquivos de configuração do projeto (`package.json`, `tsconfig.json`, etc.)
- Configuração do `firebase.json` apontando para a estrutura correta
- Setup do `.firebaserc` e `.gitignore`

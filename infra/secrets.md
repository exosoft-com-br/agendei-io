# 🔐 Gerenciamento de Segredos — Boas Práticas

> Como armazenar e acessar tokens, chaves de API e senhas com segurança
> na Plataforma de Agendamentos.

---

## ❌ O que NUNCA fazer

1. **Nunca commitar arquivos `.env`** no repositório Git
2. **Nunca hardcodar** tokens, senhas ou chaves no código-fonte
3. **Nunca logar** segredos no console (ex: `console.log(token)`)
4. **Nunca expor** segredos em erros retornados ao cliente
5. **Nunca compartilhar** segredos por chat, e-mail ou documentos

---

## ✅ Estratégia de Segredos adotada

### Desenvolvimento Local
- Usar arquivo `.env` local (incluído no `.gitignore`)
- Copiar de `.env.example` e preencher com valores reais
- Os emuladores do Firebase leem de `.env` automaticamente

### Produção
- Usar **Google Cloud Secret Manager**
- Cloud Functions acessam os segredos via SDK em runtime
- Permissões controladas via IAM (menor privilégio)

---

## 📦 Segredos configurados

| Segredo | Descrição | Usado por |
|---------|-----------|-----------|
| `WHATSAPP_API_URL` | URL da Evolution API | `whatsappWebhook`, `whatsappAdapter` |
| `WHATSAPP_API_TOKEN` | Token de autenticação da Evolution API | `whatsappAdapter` |
| `TYPEBOT_WEBHOOK_URL` | URL do webhook do Typebot | `whatsappWebhook` |
| `TYPEBOT_API_KEY` | Chave de API do Typebot | `whatsappWebhook` |
| `WEBHOOK_AUTH_TOKEN` | Token para validar chamadas recebidas no webhook | `whatsappWebhook` |

---

## 🔧 Como configurar

### 1. Criar segredos no Secret Manager

```bash
# Substituir os valores abaixo pelos reais
echo -n "https://sua-evolution-api.com" | \
  gcloud secrets create WHATSAPP_API_URL --data-file=- --project=agendamentos-poc

echo -n "seu-token-aqui" | \
  gcloud secrets create WHATSAPP_API_TOKEN --data-file=- --project=agendamentos-poc
```

### 2. Atualizar um segredo existente

```bash
echo -n "novo-valor" | \
  gcloud secrets versions add WHATSAPP_API_TOKEN --data-file=- --project=agendamentos-poc
```

### 3. Listar segredos

```bash
gcloud secrets list --project=agendamentos-poc
```

### 4. Ver valor de um segredo (apenas quando necessário)

```bash
gcloud secrets versions access latest --secret=WHATSAPP_API_URL --project=agendamentos-poc
```

---

## 🔑 Acessar segredos nas Cloud Functions

```typescript
import { defineSecret } from "firebase-functions/params";

// Definir segredos (lidos do Secret Manager automaticamente)
const whatsappApiToken = defineSecret("WHATSAPP_API_TOKEN");

// Na function, declarar quais segredos são necessários
export const minhaFunction = onRequest(
  { secrets: [whatsappApiToken] },
  async (req, res) => {
    const token = whatsappApiToken.value(); // Valor disponível em runtime
  }
);
```

---

## 🛡️ Permissões IAM

A service account do Cloud Functions precisa do papel `Secret Manager Secret Accessor`:

```bash
gcloud secrets add-iam-policy-binding NOME_DO_SEGREDO \
  --member="serviceAccount:agendamentos-poc@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=agendamentos-poc
```

---

## 🔄 Rotação de Segredos

Recomendação: rotacionar tokens a cada 90 dias.

```bash
# 1. Gerar novo token no provedor (Evolution API, Typebot, etc.)
# 2. Atualizar no Secret Manager
echo -n "novo-token" | gcloud secrets versions add WHATSAPP_API_TOKEN --data-file=-

# 3. O Cloud Functions usa automaticamente a versão "latest"
# 4. Desativar versão antiga (opcional)
gcloud secrets versions disable VERSAO_ANTIGA --secret=WHATSAPP_API_TOKEN
```

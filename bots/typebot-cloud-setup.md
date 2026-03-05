# Guia Rápido — Typebot Cloud Setup

> Passo a passo para configurar o fluxo no **Typebot Cloud** (app.typebot.io)

---

## 1. Criar conta e bot

1. Acesse [app.typebot.io](https://app.typebot.io) e faça login
2. Clique em **"Create a typebot"**
3. Nomeie: `Agendamento WhatsApp`
4. Escolha template em branco

---

## 2. Variáveis obrigatórias

Vá em **Settings → Variables** e crie:

| Variável | Valor padrão |
|----------|-------------|
| `nichoId` | `barbearia` |
| `API_URL` | `https://plataforma-agendamentos-api.onrender.com` |
| `clienteNome` | *(vazio)* |
| `clienteTelefone` | *(vazio — será preenchido automaticamente pela integração WhatsApp)* |
| `nichoConfig` | *(vazio)* |
| `servicoId` | *(vazio)* |
| `servicoNome` | *(vazio)* |
| `prestadorId` | *(vazio)* |
| `prestadorNome` | *(vazio)* |
| `dataConsulta` | *(vazio)* |
| `slotsDisponiveis` | *(vazio)* |
| `dataHoraEscolhida` | *(vazio)* |
| `protocolo` | *(vazio)* |

---

## 3. Montar o fluxo (blocos)

### Bloco 1 — Início + Carregar Config
- **Tipo:** HTTP Request (GET)
- **URL:** `{{API_URL}}/api/nicho?nichoId={{nichoId}}`
- **Salvar resposta em:** `nichoConfig`

### Bloco 2 — Saudação
- **Tipo:** Text bubble
- **Conteúdo:** `{{nichoConfig.nicho.saudacaoInicial}}`

### Bloco 3 — Coletar Nome
- **Tipo:** Text input
- **Pergunta:** `Como posso te chamar?`
- **Salvar em:** `clienteNome`

### Bloco 4 — Escolher Serviço
- **Tipo:** Buttons
- **Mensagem:** `Ótimo, {{clienteNome}}! Qual serviço deseja?`
- **Botões dinâmicos** a partir de `{{nichoConfig.servicos}}`
  - Label: `{{item.nome}} - R$ {{item.preco}}`
  - Valor → salvar em `servicoId`

### Bloco 5 — Escolher Prestador
- **Tipo:** Buttons
- **Mensagem:** `Com qual profissional prefere?`
- **Botões dinâmicos** a partir de `{{nichoConfig.prestadores}}`
  - Label: `{{item.nome}}`
  - Valor → salvar em `prestadorId`

### Bloco 6 — Escolher Data
- **Tipo:** Date input
- **Pergunta:** `Para qual dia deseja agendar?`
- **Salvar em:** `dataConsulta` (formato YYYY-MM-DD)

### Bloco 7 — Buscar Horários
- **Tipo:** HTTP Request (GET)
- **URL:** `{{API_URL}}/api/availability?prestadorId={{prestadorId}}&servicoId={{servicoId}}&data={{dataConsulta}}`
- **Salvar resposta em:** `slotsDisponiveis`

### Bloco 8 — Escolher Horário
- **Tipo:** Buttons
- **Mensagem:** `Horários disponíveis para {{dataConsulta}}:`
- **Botões dinâmicos** filtrados por `disponivel == true` em `{{slotsDisponiveis.slots}}`
  - Label: horário no formato `HH:mm` (extrair de `item.inicio`)
  - Valor → salvar em `dataHoraEscolhida`

### Bloco 9 — Confirmar Agendamento
- **Tipo:** HTTP Request (POST)
- **URL:** `{{API_URL}}/api/booking`
- **Body (JSON):**
```json
{
  "nichoId": "{{nichoId}}",
  "prestadorId": "{{prestadorId}}",
  "servicoId": "{{servicoId}}",
  "clienteNome": "{{clienteNome}}",
  "clienteTelefone": "{{clienteTelefone}}",
  "dataHora": "{{dataHoraEscolhida}}"
}
```
- **Salvar `protocolo`** da resposta em variável `protocolo`

### Bloco 10 — Mensagem Final
- **Tipo:** Text bubble
- **Conteúdo:**
```
✅ Agendamento confirmado!

📋 Protocolo: {{protocolo}}
📅 Data: {{dataConsulta}}
⏰ Horário: {{dataHoraEscolhida}}

Para cancelar, envie: cancelar {{protocolo}}
```

---

## 4. Integração com WhatsApp

### Opção A — Via Evolution API (recomendada para PoC)

1. No Typebot, vá em **Share → Integrations → WhatsApp**
2. Configure o webhook URL da sua Evolution API apontando para:
   ```
   https://plataforma-agendamentos-api.onrender.com/api/whatsapp/webhook
   ```
3. Na Evolution API, configure o webhook de mensagens recebidas para apontar para o Typebot

### Opção B — Via Typebot Webhook direto

1. No Typebot, ative **"Start from a webhook"** nas configurações
2. Copie a URL do webhook gerada (ex: `https://typebot.io/api/v1/typebots/xxx/startChat`)
3. Configure essa URL como variável de ambiente `TYPEBOT_WEBHOOK_URL` no Render Dashboard

---

## 5. Testar

1. No Typebot, clique em **"Preview"** para testar o fluxo completo no navegador
2. Verifique se todos os HTTP Requests retornam dados corretos
3. Depois conecte via WhatsApp para teste real

---

## 6. Fluxo de Cancelamento (opcional)

Crie um segundo Typebot ou adicione uma condição no início:

- **Condição:** Se a mensagem começa com "cancelar"
  - Extrair protocolo da mensagem
  - HTTP POST para `{{API_URL}}/api/booking/cancel`
  - Body: `{ "protocolo": "{{protocolo}}", "clienteTelefone": "{{clienteTelefone}}" }`
  - Responder: "Agendamento cancelado com sucesso!"
- **Senão:** Seguir fluxo normal de agendamento

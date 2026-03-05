# 🤖 Fluxo de Agendamento — Typebot

> Documentação completa do fluxo conversacional para montar no Typebot.
> Este fluxo é genérico e funciona para qualquer nicho (barbearia, clínica, consultoria, etc.)

---

## 📋 Visão Geral do Fluxo

```
[Boas-vindas] → [Coleta Nome] → [Listar Serviços] → [Escolha Serviço]
      → [Escolha Prestador] → [Consultar Disponibilidade] → [Escolha Horário]
      → [Confirmação] → [Criar Agendamento] → [Mensagem Final]
```

---

## 🔧 Variáveis Globais do Typebot

Configure estas variáveis no painel do Typebot antes de montar o fluxo:

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `nichoId` | String | ID do nicho ativo (ex: "barbearia") — configurar como valor fixo |
| `API_URL` | String | URL base da API no Render (ex: `https://plataforma-agendamentos-api.onrender.com`) |
| `clienteNome` | String | Nome do cliente (preenchido no fluxo) |
| `clienteTelefone` | String | Telefone do cliente (capturado automaticamente pelo WhatsApp) |
| `nichoConfig` | Object | Config completa do nicho (retornada pela API) |
| `servicoId` | String | ID do serviço escolhido |
| `servicoNome` | String | Nome do serviço escolhido |
| `prestadorId` | String | ID do prestador escolhido |
| `prestadorNome` | String | Nome do prestador escolhido |
| `slotsDisponiveis` | Array | Lista de horários disponíveis |
| `dataHoraEscolhida` | String | Data/hora selecionada (ISO 8601) |
| `protocolo` | String | Protocolo do agendamento criado |
| `mensagemFinal` | String | Mensagem de confirmação personalizada |

---

## 📦 Bloco a Bloco — Detalhamento Completo

---

### BLOCO 1: Boas-vindas

**Tipo:** Mensagem de texto
**Posição no fluxo:** Início (primeiro bloco)

**Configuração:**
- **Trigger:** Quando a conversa é iniciada (primeira mensagem do cliente)
- **Conteúdo da mensagem:**

```
{{nichoConfig.nicho.saudacaoInicial}}
```

> **Nota:** Como este bloco depende dos dados do nicho, na prática o Bloco 1 faz
> primeiro a chamada HTTP (Bloco 2A) e depois exibe a saudação.

**Alternativa simplificada (sem chamada HTTP antes):**

```
Olá! 👋 Bem-vindo ao nosso sistema de agendamento!
Vou te ajudar a encontrar o melhor horário.
```

**Próximo bloco → Bloco 2A (Carregar Config do Nicho)**

---

### BLOCO 2A: Carregar Configuração do Nicho

**Tipo:** HTTP Request (GET)
**Posição no fluxo:** Logo após boas-vindas, antes de qualquer interação

**Configuração HTTP Request:**

| Campo | Valor |
|-------|-------|
| Método | `GET` |
| URL | `{{API_URL}}/api/nicho?nichoId={{nichoId}}` |
| Headers | `Content-Type: application/json` |
| Salvar resposta em | `nichoConfig` |

**Corpo da resposta esperada:**
```json
{
  "nicho": {
    "id": "barbearia",
    "nomePublico": "Barbearia do João",
    "saudacaoInicial": "✂️ Olá! ...",
    "textoConfirmacao": "✅ Agendamento confirmado! ...",
    "termos": { "servico": "serviço", "prestador": "barbeiro" }
  },
  "prestadores": [...],
  "servicos": [...]
}
```

**Mapeamento de variáveis após resposta:**
- `nichoConfig` ← resposta completa (objeto inteiro)

**Próximo bloco → Bloco 2B (Saudação com dados do nicho)**

---

### BLOCO 2B: Saudação Personalizada

**Tipo:** Mensagem de texto
**Posição no fluxo:** Após carregar config

**Conteúdo:**
```
{{nichoConfig.nicho.saudacaoInicial}}
```

**Próximo bloco → Bloco 3 (Coleta de Nome)**

---

### BLOCO 3: Coleta de Nome

**Tipo:** Input de texto
**Posição no fluxo:** Após saudação

**Configuração:**

| Campo | Valor |
|-------|-------|
| Pergunta | `Como posso te chamar?` |
| Placeholder | `Digite seu nome` |
| Salvar em | `clienteNome` |
| Validação | Mínimo 3 caracteres |
| Mensagem de erro | `Por favor, digite um nome com pelo menos 3 caracteres.` |

**Próximo bloco → Bloco 4 (Escolha de Serviço)**

---

### BLOCO 4: Escolha de Serviço

**Tipo:** Botões dinâmicos
**Posição no fluxo:** Após coleta do nome

**Configuração:**

| Campo | Valor |
|-------|-------|
| Mensagem | `Ótimo, {{clienteNome}}! 😊 Qual {{nichoConfig.nicho.termos.servico}} você deseja agendar?` |
| Fonte dos botões | `{{nichoConfig.servicos}}` |
| Label do botão | `{{item.nome}}` (+ preço se disponível: `{{item.nome}} - R$ {{item.preco}}`) |
| Valor do botão | `{{item.id}}` |
| Salvar ID em | `servicoId` |
| Salvar nome em | `servicoNome` |

**Dica Typebot:** Use o bloco "Buttons" com a opção "Dynamic" ativada.
Para cada serviço no array `nichoConfig.servicos`, crie um botão.

**Exemplo visual dos botões (nicho barbearia):**
```
Qual serviço você deseja agendar?

[Corte Simples - R$ 35]
[Corte + Barba - R$ 55]
[Barba Completa - R$ 30]
[Corte Degradê - R$ 45]
```

**Próximo bloco → Bloco 5 (Escolha de Prestador)**

---

### BLOCO 5: Escolha de Prestador

**Tipo:** Condição + Botões dinâmicos
**Posição no fluxo:** Após escolha do serviço

**Lógica condicional:**
1. Filtrar prestadores que oferecem o serviço escolhido
2. Se apenas 1 prestador: pular automaticamente e salvar o ID dele
3. Se mais de 1 prestador: mostrar botões para escolha

**Configuração (quando há escolha):**

| Campo | Valor |
|-------|-------|
| Mensagem | `Com qual {{nichoConfig.nicho.termos.prestador}} você prefere agendar?` |
| Fonte dos botões | Prestadores filtrados pelo serviço |
| Label do botão | `{{item.nome}} ({{item.categoria}})` |
| Valor do botão | `{{item.id}}` |
| Salvar ID em | `prestadorId` |
| Salvar nome em | `prestadorNome` |

**Exemplo visual dos botões (nicho clínica):**
```
Com qual médico você prefere agendar?

[Dr. João Silva (Clínico Geral)]
[Dra. Maria Santos (Cardiologista)]
```

**Se apenas 1 prestador (auto-seleção):**
```
Seu atendimento será com {{prestadorNome}}! 👨‍⚕️
```

**Próximo bloco → Bloco 6 (Consultar Disponibilidade)**

---

### BLOCO 6: Consultar Disponibilidade

**Tipo:** HTTP Request (GET)
**Posição no fluxo:** Após escolha do prestador

**Configuração HTTP Request:**

| Campo | Valor |
|-------|-------|
| Método | `GET` |
| URL | `{{API_URL}}/api/availability?prestadorId={{prestadorId}}&servicoId={{servicoId}}` |
| Headers | `Content-Type: application/json` |
| Salvar resposta em | `slotsDisponiveis` |

> **Nota:** Se não passar o parâmetro `data`, a API retorna slots do dia atual.
> Para mostrar slots de amanhã, adicione: `&data=2026-03-04`

**Corpo da resposta esperada:**
```json
{
  "slots": [
    { "inicio": "2026-03-03T09:00:00", "fim": "2026-03-03T09:30:00", "disponivel": true },
    { "inicio": "2026-03-03T09:30:00", "fim": "2026-03-03T10:00:00", "disponivel": false },
    { "inicio": "2026-03-03T10:00:00", "fim": "2026-03-03T10:30:00", "disponivel": true }
  ]
}
```

**Tratamento de erro:**
- Se `slots` estiver vazio: mostrar mensagem "Não há horários disponíveis para hoje. Deseja ver outro dia?"
- Oferecer botões: `[Amanhã]` `[Outro dia]`

**Próximo bloco → Bloco 7 (Escolha de Horário)**

---

### BLOCO 7: Escolha de Horário

**Tipo:** Botões dinâmicos
**Posição no fluxo:** Após consulta de disponibilidade

**Configuração:**

| Campo | Valor |
|-------|-------|
| Mensagem | `📅 Horários disponíveis para {{servicoNome}} com {{prestadorNome}}:` |
| Fonte dos botões | `{{slotsDisponiveis.slots}}` (filtrar apenas `disponivel: true`) |
| Label do botão | Horário formatado: `Hoje 09:00`, `Hoje 10:00`, etc. |
| Valor do botão | `{{item.inicio}}` (ISO 8601 completo) |
| Salvar em | `dataHoraEscolhida` |

**Formatação dos labels:**
- Extrair apenas a hora do ISO 8601: `09:00`, `10:30`, etc.
- Adicionar prefixo "Hoje" ou "Amanhã" conforme a data

**Exemplo visual:**
```
📅 Horários disponíveis para Corte + Barba com Barbeiro Pedro:

[Hoje 09:00]
[Hoje 10:00]
[Hoje 10:30]
[Hoje 14:00]
[Hoje 15:30]
```

**Próximo bloco → Bloco 8 (Confirmação)**

---

### BLOCO 8: Confirmação

**Tipo:** Mensagem + Botões (Sim / Não)
**Posição no fluxo:** Após escolha do horário

**Configuração:**

| Campo | Valor |
|-------|-------|
| Mensagem | Resumo do agendamento (ver abaixo) |
| Botão 1 | `✅ Confirmar` → vai para Bloco 9 |
| Botão 2 | `🔄 Trocar horário` → volta para Bloco 6 |
| Botão 3 | `❌ Cancelar` → vai para Bloco Final (cancelamento) |

**Mensagem de resumo:**
```
📋 *Resumo do agendamento:*

👤 Nome: {{clienteNome}}
💼 Serviço: {{servicoNome}}
🧑‍💼 Profissional: {{prestadorNome}}
📅 Data/Hora: {{dataHoraEscolhida_formatada}}

Está tudo certo?
```

**Próximo bloco (se Sim) → Bloco 9 (Criar Agendamento)**
**Próximo bloco (se Trocar) → Bloco 6 (Consultar Disponibilidade)**

---

### BLOCO 9: Criar Agendamento

**Tipo:** HTTP Request (POST)
**Posição no fluxo:** Após confirmação

**Configuração HTTP Request:**

| Campo | Valor |
|-------|-------|
| Método | `POST` |
| URL | `{{API_URL}}/api/booking` |
| Headers | `Content-Type: application/json` |
| Body | Ver abaixo |
| Salvar resposta em | `resultadoAgendamento` |

**Body da requisição:**
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

**Resposta esperada (sucesso):**
```json
{
  "sucesso": true,
  "protocolo": "AGD-2026-A3F7",
  "mensagemConfirmacao": "✅ Agendamento confirmado! Seu protocolo é AGD-2026-A3F7. Te esperamos em 03/03/2026 às 09:00!",
  "detalhes": {
    "servico": "Corte + Barba",
    "prestador": "Barbeiro Pedro",
    "nicho": "Barbearia do João"
  }
}
```

**Mapeamento de variáveis após resposta:**
- `protocolo` ← `{{resultadoAgendamento.protocolo}}`
- `mensagemFinal` ← `{{resultadoAgendamento.mensagemConfirmacao}}`

**Tratamento de erro (status 409 — horário indisponível):**
```
😔 Ops! Este horário acabou de ser ocupado por outra pessoa.
Vamos ver outros horários disponíveis?
```
→ Voltar para Bloco 6

**Próximo bloco → Bloco 10 (Mensagem Final)**

---

### BLOCO 10: Mensagem Final

**Tipo:** Mensagem de texto
**Posição no fluxo:** Final do fluxo (último bloco)

**Conteúdo:**
```
{{mensagemFinal}}

📌 Guarde seu protocolo: *{{protocolo}}*

Se precisar cancelar, envie a palavra *CANCELAR* seguida do protocolo.

Obrigado por agendar conosco! 😊
```

**Fim do fluxo.**

---

## 🔄 Fluxo de Cancelamento (Opcional)

### Trigger: Mensagem contendo "CANCELAR"

**Tipo:** Condição no início do fluxo
**Condição:** Se a mensagem contém "CANCELAR"

**Sub-fluxo:**

1. **Extrair protocolo da mensagem** (regex: `AGD-\d{4}-[A-Z0-9]{4}`)
2. **Pedir confirmação:**
   ```
   Você deseja cancelar o agendamento {{protocolo}}?
   [Sim, cancelar] [Não, manter]
   ```
3. **Se sim — HTTP Request (POST):**

| Campo | Valor |
|-------|-------|
| Método | `POST` |
| URL | `{{API_URL}}/api/booking/cancel` |
| Body | `{ "protocolo": "{{protocolo}}", "clienteTelefone": "{{clienteTelefone}}" }` |

4. **Mensagem de confirmação:**
   ```
   ✅ Agendamento {{protocolo}} cancelado com sucesso.
   Se quiser agendar novamente, é só enviar uma mensagem!
   ```

---

## 🛠️ Dicas para Montar no Typebot

### 1. Configuração Inicial
- Crie um novo fluxo no Typebot
- Defina as variáveis globais listadas no início deste documento
- Configure `nichoId` como variável fixa (ex: "barbearia")
- Configure `API_URL` com a URL base da sua API no Render

### 2. Blocos HTTP Request
- No Typebot, use o bloco **"HTTP Request"** da seção "Integrations"
- Configure método, URL, headers e body conforme documentado
- Use **"Set variable"** para mapear a resposta em variáveis

### 3. Botões Dinâmicos
- Use o bloco **"Buttons"** do Typebot
- Ative a opção **"Dynamic"** para carregar botões de uma variável
- Mapeie `label` e `value` para os campos corretos do array

### 4. Condições
- Use o bloco **"Condition"** para lógica de decisão
- Ex: Se `prestadores.length == 1`, pular escolha de prestador

### 5. Captura do Telefone
- Na integração com WhatsApp, o número do cliente é capturado automaticamente
- Salve como variável `clienteTelefone` no início do fluxo
- Formato esperado: `5511999999999` (DDI + DDD + número)

### 6. Formatação de Data/Hora
- As datas vêm da API em ISO 8601 (ex: `2026-03-03T09:00:00`)
- Para exibir no chat, converta para formato amigável: `03/03/2026 às 09:00`
- Use o bloco **"Set variable"** com JavaScript para formatar:

```javascript
// Formatar data ISO para exibição
const data = new Date("{{dataHoraEscolhida}}");
const formatada = data.toLocaleString("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
return formatada;
```

### 7. Integração com WhatsApp
- Configure o webhook do Typebot para receber mensagens da Cloud Function `whatsappWebhook`
- Configure o webhook de resposta do Typebot para enviar mensagens de volta pela Evolution API
- Fluxo: WhatsApp → Evolution API → Cloud Function → Typebot → Cloud Function → Evolution API → WhatsApp

### 8. Teste Local
- Use o modo "Test" do Typebot para simular o fluxo
- Configure as URLs das Functions para apontar para o emulador local durante testes:
  - `http://localhost:5001/agendamentos-poc/southamerica-east1/getNichoConfig`
  - `http://localhost:5001/agendamentos-poc/southamerica-east1/getAvailableSlots`
  - `http://localhost:5001/agendamentos-poc/southamerica-east1/createBooking`

---

## 📊 Diagrama Visual do Fluxo

```
┌──────────────┐
│  INÍCIO      │
│  (Mensagem   │
│  recebida)   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ HTTP GET     │ → getNichoConfig?nichoId=barbearia
│ Carregar     │
│ Config Nicho │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Saudação     │ → "✂️ Olá! Bem-vindo à Barbearia do João!"
│ Personalizada│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Input Texto  │ → "Como posso te chamar?"
│ Coleta Nome  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Botões       │ → [Corte Simples] [Corte + Barba] [Barba] [Degradê]
│ Dinâmicos    │
│ Serviços     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Condição:    │──→ Se 1 prestador: auto-selecionar
│ Qtd presta-  │
│ dores > 1?   │──→ Se > 1: mostrar botões
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ HTTP GET     │ → getAvailableSlots?prestadorId=X&servicoId=Y
│ Consultar    │
│ Horários     │◄──────────────────────────┐
└──────┬───────┘                           │
       │                                   │
       ▼                                   │
┌──────────────┐                           │
│ Botões       │ → [Hoje 09:00] [Hoje 10:00] [Hoje 14:00]
│ Dinâmicos    │                           │
│ Horários     │                           │
└──────┬───────┘                           │
       │                                   │
       ▼                                   │
┌──────────────┐                           │
│ Confirmação  │──→ [🔄 Trocar horário] ───┘
│ Resumo +     │
│ Sim/Não      │──→ [❌ Cancelar] → FIM
└──────┬───────┘
       │ [✅ Confirmar]
       ▼
┌──────────────┐
│ HTTP POST    │ → createBooking { ...dados }
│ Criar        │
│ Agendamento  │──→ Se erro 409: voltar para Horários
└──────┬───────┘
       │ Sucesso
       ▼
┌──────────────┐
│ Mensagem     │ → "✅ Agendamento confirmado! Protocolo: AGD-2026-A3F7"
│ Final        │
│ + Protocolo  │
└──────────────┘
       │
       ▼
     [FIM]
```

---

## ⚠️ Observações Importantes

1. **Timeout de API:** Configure timeout de 10s nas chamadas HTTP para evitar que o fluxo trave
2. **Fallback:** Adicione mensagens de fallback caso a API retorne erro
3. **Rate limit:** O Typebot pode fazer muitas chamadas — monitore o consumo da API
4. **Sessão:** Cada conversa WhatsApp é uma sessão separada no Typebot (usando o número como sessionId)
5. **Persistência:** O Typebot mantém as variáveis durante toda a sessão — não precisa pedir dados novamente

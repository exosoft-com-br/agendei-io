const API_URL = 'https://plataforma-agendamentos-api.onrender.com';

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(`${API_URL}/api${path}`, { ...opts, headers });
  return res.json();
}

function limparFormulario() {
  ['nichoId','nomeFantasia','descricao','telefone','cnpjCpf','cep','endereco','bairro','cidade','estado'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('linksNegocio').style.display = 'none';
  document.getElementById('grupoAtivo').style.display = 'none';
  document.getElementById('btnWhatsappForm').style.display = 'none';
  window.editandoNegocioId = null;
}

async function salvarNegocio() {
  const body = {
    nichoId: document.getElementById('nichoId').value.trim(),
    nomeFantasia: document.getElementById('nomeFantasia').value.trim(),
    descricao: document.getElementById('descricao').value.trim(),
    telefoneComercial: document.getElementById('telefone').value.trim(),
    cnpjCpf: document.getElementById('cnpjCpf').value.trim(),
    endereco: document.getElementById('endereco').value.trim(),
    bairro: document.getElementById('bairro').value.trim(),
    cidade: document.getElementById('cidade').value.trim(),
    estado: document.getElementById('estado').value.trim().toUpperCase(),
  };
  if (window.editandoNegocioId) {
    body.ativo = document.getElementById('ativo').checked;
  }
  if (!body.nichoId || !body.nomeFantasia) { alert('Nicho e Nome Fantasia são obrigatórios.'); return; }
  let data;
  if (window.editandoNegocioId) {
    data = await apiFetch(`/negocios/${window.editandoNegocioId}`, { method: 'PUT', body: JSON.stringify(body) });
  } else {
    data = await apiFetch('/negocios', { method: 'POST', body: JSON.stringify(body) });
  }
  if (data.erro) { alert(data.erro); return; }
  // Garante que o id correto seja usado (preferencialmente do retorno da API)
  const id = data.negocio?.id || window.editandoNegocioId;
  if (id) {
    gerarLinksNegocio(id);
    document.getElementById('linksNegocio').style.display = 'block';
  }
  limparFormulario();
  carregarNegocios();
  window.editandoNegocioId = null;
}

async function gerarLinksNegocio(id) {
  const baseUrl = 'https://app.agendei.io.exosoft.com.br/';
  const linkAgendamento = `${baseUrl}?negocio=${id}`;
  
  let linkAgenda = '';
  let servicos = [];
  let negocioData = {};
  try {
    const resp = await apiFetch(`/negocio/${id}/publico`);
    servicos = (resp.servicos || []);
    negocioData = resp.negocio || {};
    if (negocioData.nichoId) {
      linkAgenda = `${window.location.origin}/agenda/agenda.html?nichoId=${negocioData.nichoId}`;
    }
  } catch(e) {
    console.error("Erro ao buscar dados publicos do negocio", e);
  }

  const linkAgendaNegocio = `${window.location.origin}/agenda/agenda-negocio.html?negocioId=${id}`;
  document.getElementById('linkAgendamento').value = linkAgendamento;
  document.getElementById('linkAgenda').value = linkAgenda;
  // Novo campo: link de agenda por negócio
  const linkAgendaNegocioInput = document.getElementById('linkAgendaNegocio');
  if (linkAgendaNegocioInput) linkAgendaNegocioInput.value = linkAgendaNegocio;

  // Link de agenda do negócio sempre disponível
  const linksServicosDiv = document.getElementById('linksServicos');
  if (linksServicosDiv) {
    let html = '';
    html += `<label style='margin-top:8px'>Link de agenda do negócio:</label>`;
    html += `<div style='display:flex;align-items:center;gap:8px;margin-bottom:8px'>
      <input type='text' id='linkAgendaNegocio' value='${window.location.origin}/agenda/agenda-negocio.html?negocioId=${id}' readonly style='flex:1;padding:8px;border-radius:6px;border:1px solid #ccc'>
      <button class='btn btn-outline btn-sm' onclick="copiarLink('linkAgendaNegocio')">Copiar</button>
      <a class='btn btn-outline btn-sm' href='${window.location.origin}/agenda/agenda-negocio.html?negocioId=${id}' target='_blank'>Abrir</a>
    </div>`;
    // Buscar serviços do negócio para gerar links de agenda por serviço
    let servicos = [];
    try {
      const resp = await apiFetch(`/negocio/${id}/publico`);
      servicos = (resp.servicos || []);
    } catch {}
    if (servicos.length) {
      html += '<label style="margin-top:8px">Links de agenda por serviço:</label>' +
        servicos.map(s =>
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <input type="text" id="linkAgendaServico_${s.id}" value="${window.location.origin}/agenda/agenda.html?servicoId=${s.id}" readonly style="flex:1;padding:8px;border-radius:6px;border:1px solid #ccc">
            <button class="btn btn-outline btn-sm" onclick="copiarLink('linkAgendaServico_${s.id}')">Copiar</button>
            <span style="font-size:.92em;color:#555">${s.nome}</span>
          </div>`
        ).join('');
    }
    linksServicosDiv.innerHTML = html;
    linksServicosDiv.style.display = 'block';
  }
  document.getElementById('linksNegocio').style.display = 'block';
}

function copiarLink(id) {
  const input = document.getElementById(id);
  input.select();
  document.execCommand('copy');
  alert('Link copiado!');
}

async function carregarNegocios() {
  const el = document.getElementById('negociosList');
  el.innerHTML = '';
  try {
    const data = await apiFetch('/negocios');
    for (const n of (data.negocios||[])) {
      const baseUrl = 'https://app.agendei.io.exosoft.com.br/';
      const linkAgendamento = `${baseUrl}?negocio=${n.id}`;
      const linkAgenda = `${window.location.origin}/agenda/agenda.html?nichoId=${n.nichoId}`;
      // Buscar serviços para cada negócio
      let servicos = [];
      try {
        const resp = await apiFetch(`/negocio/${n.id}/publico`);
        servicos = (resp.servicos || []);
      } catch {}
      let linksServicosHtml = '';
      // Link de agenda do negócio
      linksServicosHtml += `<div style='margin-top:6px'><label style='font-size:.95em'>Link de agenda do negócio:</label>
        <div style='display:flex;align-items:center;gap:8px;margin-bottom:8px'>
          <input type='text' id='linkAgendaNegocioList_${n.id}' value='${window.location.origin}/agenda/agenda-negocio.html?negocioId=${n.id}' readonly style='flex:1;padding:6px;border-radius:6px;border:1px solid #ccc;font-size:.95em'>
          <button class='btn btn-outline btn-sm' onclick="copiarLink('linkAgendaNegocioList_${n.id}')">Copiar</button>
          <a class='btn btn-outline btn-sm' href='${window.location.origin}/agenda/agenda-negocio.html?negocioId=${n.id}' target='_blank'>Abrir</a>
        </div></div>`;
      if (servicos.length) {
        linksServicosHtml += '<div><label style="font-size:.95em">Links de agenda por serviço:</label>' +
          servicos.map(s =>
            `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <input type="text" id="linkAgendaServicoList_${n.id}_${s.id}" value="${window.location.origin}/agenda/agenda.html?servicoId=${s.id}" readonly style="flex:1;padding:6px;border-radius:6px;border:1px solid #ccc;font-size:.95em">
              <button class="btn btn-outline btn-sm" onclick="copiarLink('linkAgendaServicoList_${n.id}_${s.id}')">Copiar</button>
              <span style="font-size:.92em;color:#555">${s.nome}</span>
            </div>`
          ).join('') + '</div>';
      }
      el.innerHTML += `
        <div class='negocio-card'>
          <div class='negocio-header'>
            <div class='negocio-info'>
              <strong>${n.nome_fantasia||n.nome_publico||n.nome||n.id}</strong>
              ${n.ativo === false ? '<span style="background:#fee2e2;color:#c53030;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px">Inativo</span>' : '<span style="background:#e6f9ee;color:#276749;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px">Ativo</span>'}
              <div class='negocio-detail'>${n.descricao||''}</div>
            </div>
            <div class='negocio-actions'>
              <button class='btn btn-outline btn-sm' onclick='editarNegocio("${n.id}")'>Editar</button>
              <button class='btn btn-outline btn-sm' onclick='mostrarCardWhatsapp("${n.id}")' style='color:#25D366;border-color:#25D366'>📱 WhatsApp</button>
            </div>
          </div>
          <div class='negocio-links' style='margin-top:8px'>
            <div style='font-size:.95em'>
              <span>🔗 Link de agendamento: <a href='${linkAgendamento}' target='_blank'>${linkAgendamento}</a></span><br>
              <span>📅 Link de agenda: <a href='${linkAgenda}' target='_blank'>${linkAgenda}</a></span>
            </div>
            ${linksServicosHtml}
          </div>
        </div>
      `;
    }
  } catch (e) { el.innerHTML = '<div class="empty">Erro ao carregar negócios.</div>'; }
}

async function editarNegocio(id) {
  window.editandoNegocioId = id;
  const data = await apiFetch(`/negocios/${id}`);
  if (!data || !data.negocio) return;
  const n = data.negocio;
  document.getElementById('nichoId').value = n.nicho_id || '';
  document.getElementById('nomeFantasia').value = n.nome_fantasia || '';
  document.getElementById('descricao').value = n.descricao || '';
  document.getElementById('telefone').value = n.telefone_comercial || '';
  document.getElementById('cnpjCpf').value = n.cnpj_cpf || '';
  document.getElementById('cep').value = n.cep || '';
  document.getElementById('endereco').value = n.endereco || '';
  document.getElementById('bairro').value = n.bairro || '';
  document.getElementById('cidade').value = n.cidade || '';
  document.getElementById('estado').value = n.estado || '';
  // Mostrar toggle ativo e botão WhatsApp no form de edição
  document.getElementById('grupoAtivo').style.display = 'block';
  document.getElementById('ativo').checked = n.ativo !== false;
  document.getElementById('btnWhatsappForm').style.display = 'inline-block';
  if (id) {
    await gerarLinksNegocio(id);
    document.getElementById('linksNegocio').style.display = 'block';
  }
}

carregarNegocios();

// ─── WhatsApp ──────────────────────────────────────────────────────────────────

let whatsappNegocioId = null;
let pollInterval = null;

function mostrarCardWhatsapp(negocioId) {
  whatsappNegocioId = negocioId;
  document.getElementById('cardWhatsapp').style.display = 'block';
  document.getElementById('cardWhatsapp').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  verificarStatusWhatsapp();
}

async function verificarStatusWhatsapp() {
  if (!whatsappNegocioId) return;
  try {
    const data = await apiFetch(`/negocio/${whatsappNegocioId}/whatsapp/status`);
    atualizarUIWhatsapp(data.status, data.qrcode);
  } catch (e) {
    console.error('Erro ao verificar status WhatsApp', e);
  }
}

function atualizarUIWhatsapp(status, qrcode) {
  const divConectado     = document.getElementById('whatsappConectado');
  const divDesconectado  = document.getElementById('whatsappDesconectado');
  const divConectando    = document.getElementById('whatsappConectando');
  const divInicial       = document.getElementById('whatsappInicial');
  const statusPoll       = document.getElementById('statusPoll');

  if (status === 'conectado') {
    divConectado.style.display = 'block';
    divDesconectado.style.display = 'none';
    pararPoll();
    return;
  }

  divConectado.style.display = 'none';
  divDesconectado.style.display = 'block';

  if (status === 'conectando' && qrcode) {
    divInicial.style.display = 'none';
    divConectando.style.display = 'block';
    document.getElementById('qrcodeImg').src = qrcode;
    if (statusPoll) statusPoll.textContent = 'Aguardando leitura do QR Code...';
    iniciarPoll();
  } else {
    divInicial.style.display = 'block';
    divConectando.style.display = 'none';
    pararPoll();
  }
}

async function conectarWhatsapp() {
  if (!whatsappNegocioId) return;
  try {
    const data = await apiFetch(`/negocio/${whatsappNegocioId}/whatsapp/conectar`, { method: 'POST' });
    if (data.erro) { alert(data.erro); return; }
    atualizarUIWhatsapp('conectando', data.qrcode);
  } catch (e) {
    alert('Erro ao iniciar conexão WhatsApp. Verifique se o servidor está configurado.');
  }
}

async function gerarQRCode() {
  await conectarWhatsapp();
}

async function desconectarWhatsapp() {
  if (!whatsappNegocioId || !confirm('Deseja desconectar o WhatsApp deste negócio?')) return;
  try {
    await apiFetch(`/negocio/${whatsappNegocioId}/whatsapp/desconectar`, { method: 'DELETE' });
    atualizarUIWhatsapp('desconectado', null);
  } catch (e) {
    alert('Erro ao desconectar.');
  }
}

function iniciarPoll() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    if (!whatsappNegocioId) return;
    try {
      const data = await apiFetch(`/negocio/${whatsappNegocioId}/whatsapp/status`);
      atualizarUIWhatsapp(data.status, data.qrcode);
    } catch {}
  }, 5000);
}

function pararPoll() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

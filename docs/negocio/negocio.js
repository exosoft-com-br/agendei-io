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
  const baseUrl = 'https://exosoft-com-br.github.io/plataforma-agendamentos/';
  const linkAgendamento = `${baseUrl}?negocio=${id}`;
  const linkAgenda = `${window.location.origin}/agenda/agenda.html?nichoId=${id}`;
  document.getElementById('linkAgendamento').value = linkAgendamento;
  document.getElementById('linkAgenda').value = linkAgenda;

  // Buscar serviços do negócio para gerar links de agenda por serviço
  let servicos = [];
  try {
    const resp = await apiFetch(`/negocio/${id}/publico`);
    servicos = (resp.servicos || []);
  } catch {}
  const linksServicosDiv = document.getElementById('linksServicos');
  if (linksServicosDiv) {
    if (servicos.length) {
      linksServicosDiv.innerHTML = '<label style="margin-top:8px">Links de agenda por serviço:</label>' +
        servicos.map(s =>
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <input type="text" id="linkAgendaServico_${s.id}" value="${window.location.origin}/agenda/agenda.html?servicoId=${s.id}" readonly style="flex:1;padding:8px;border-radius:6px;border:1px solid #ccc">
            <button class="btn btn-outline btn-sm" onclick="copiarLink('linkAgendaServico_${s.id}')">Copiar</button>
            <span style="font-size:.92em;color:#555">${s.nome}</span>
          </div>`
        ).join('');
      linksServicosDiv.style.display = 'block';
    } else {
      linksServicosDiv.innerHTML = '';
      linksServicosDiv.style.display = 'none';
    }
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
      const baseUrl = 'https://exosoft-com-br.github.io/plataforma-agendamentos/';
      const linkAgendamento = `${baseUrl}?negocio=${n.id}`;
      const linkAgenda = `${window.location.origin}/agenda/agenda.html?nichoId=${n.id}`;
      // Buscar serviços para cada negócio
      let servicos = [];
      try {
        const resp = await apiFetch(`/negocio/${n.id}/publico`);
        servicos = (resp.servicos || []);
      } catch {}
      let linksServicosHtml = '';
      if (servicos.length) {
        linksServicosHtml = '<div style="margin-top:6px"><label style="font-size:.95em">Links de agenda por serviço:</label>' +
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
              <div class='negocio-detail'>${n.descricao||''}</div>
            </div>
            <div class='negocio-actions'>
              <button class='btn btn-outline btn-sm' onclick='editarNegocio("${n.id}")'>Editar</button>
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
  if (id) {
    await gerarLinksNegocio(id);
    document.getElementById('linksNegocio').style.display = 'block';
  }
}

carregarNegocios();

const API_URL = 'https://plataforma-agendamentos-api.onrender.com';

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(`${API_URL}/api${path}`, { ...opts, headers });
  return res.json();
}

async function carregarNegocioInfo(negocioId) {
  try {
    const data = await apiFetch(`/negocio/${negocioId}/publico`);
    if (data && data.negocio) {
      document.getElementById('negocioInfo').innerHTML = `<strong>${data.negocio.nomeFantasia}</strong><br><span style='color:#888'>${data.negocio.descricao||''}</span>`;
    }
  } catch {}
}

async function carregarAgenda() {
  const negocioId = getQueryParam('negocioId');
  const data = document.getElementById('data').value;
  const clienteNome = document.getElementById('clienteNome').value.trim();
  const clienteTelefone = document.getElementById('clienteTelefone').value.trim();
  let url = `/booking?`;
  if (negocioId) url += `negocioId=${encodeURIComponent(negocioId)}&`;
  if (data) url += `data=${encodeURIComponent(data)}&`;
  if (clienteNome) url += `clienteNome=${encodeURIComponent(clienteNome)}&`;
  if (clienteTelefone) url += `clienteTelefone=${encodeURIComponent(clienteTelefone)}&`;
  try {
    const res = await apiFetch(url);
    const agendamentos = res.agendamentos || [];
    const tbody = document.getElementById('agendaBody');
    tbody.innerHTML = '';
    if (!agendamentos.length) {
      document.getElementById('agendaTable').style.display = 'none';
      document.getElementById('agendaEmpty').style.display = 'block';
      return;
    }
    // Buscar nomes dos serviços
    const servicoIds = [...new Set(agendamentos.map(ag => ag.servico_id).filter(Boolean))];
    let servicosMap = {};
    if (servicoIds.length) {
      try {
        const servicosResp = await apiFetch(`/servicos?ids=${servicoIds.join(',')}`);
        (servicosResp.servicos||[]).forEach(s => { servicosMap[s.id] = s.nome; });
      } catch {}
    }
    agendamentos.forEach(ag => {
      const hora = ag.data_hora?.split('T')[1]?.substring(0,5) || ag.data_hora;
      const clienteTelefone = ag.cliente_telefone || ag.telefone || ag.telefone_comercial || '—';
      const servicoNome = ag.servico_nome || servicosMap[ag.servico_id] || ag.servico_id || '—';
      tbody.innerHTML += `<tr><td><strong>${hora}</strong></td><td>${ag.cliente_nome||'—'}</td><td>${clienteTelefone}</td><td>${servicoNome}</td><td><span class="badge badge-active">${ag.status||'—'}</span></td><td style="font-size:.8rem">${ag.protocolo||'—'}</td></tr>`;
    });
    document.getElementById('agendaTable').style.display = 'table';
    document.getElementById('agendaEmpty').style.display = 'none';
  } catch (e) {
    document.getElementById('agendaTable').style.display = 'none';
    document.getElementById('agendaEmpty').style.display = 'block';
  }
}

document.getElementById('data').onchange = carregarAgenda;
document.getElementById('clienteNome').oninput = carregarAgenda;
document.getElementById('clienteTelefone').oninput = carregarAgenda;

const negocioId = getQueryParam('negocioId');
if (negocioId) carregarNegocioInfo(negocioId);
carregarAgenda();

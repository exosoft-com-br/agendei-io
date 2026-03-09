const API_URL = 'https://plataforma-agendamentos-api.onrender.com';

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(`${API_URL}/api${path}`, { ...opts, headers });
  return res.json();
}

async function carregarNichos() {
  const sel = document.getElementById('nichoId');
  sel.innerHTML = '<option value="">Selecione...</option>';
  try {
    const data = await apiFetch('/nichos');
    (data.nichos||[]).forEach(n => {
      sel.innerHTML += `<option value="${n.id}">${n.nome_publico||n.nome||n.id}</option>`;
    });
  } catch {}
}

async function carregarPrestadores() {
  const nichoId = document.getElementById('nichoId').value;
  const sel = document.getElementById('prestadorId');
  sel.innerHTML = '<option value="">Todos</option>';
  if (!nichoId) { carregarServicos(); carregarAgenda(); return; }
  try {
    const data = await apiFetch(`/prestadores?nichoId=${encodeURIComponent(nichoId)}`);
    (data.prestadores||[]).forEach(p => {
      sel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
  } catch {}
  carregarServicos();
  carregarAgenda();
}

async function carregarServicos() {
  const nichoId = document.getElementById('nichoId').value;
  const sel = document.getElementById('servicoId');
  sel.innerHTML = '<option value="">Todos</option>';
  if (!nichoId) { carregarAgenda(); return; }
  try {
    const data = await apiFetch(`/servicos?nichoId=${encodeURIComponent(nichoId)}`);
    (data.servicos||[]).forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
    });
  } catch {}
  carregarAgenda();
}

async function carregarAgenda() {
  const nichoId = document.getElementById('nichoId').value;
  const prestadorId = document.getElementById('prestadorId').value;
  const servicoId = document.getElementById('servicoId').value;
  const data = document.getElementById('data').value;
  const clienteNome = document.getElementById('clienteNome').value.trim();
  const clienteTelefone = document.getElementById('clienteTelefone').value.trim();
  let url = `/booking?`;
  if (nichoId) url += `nichoId=${encodeURIComponent(nichoId)}&`;
  if (prestadorId) url += `prestadorId=${encodeURIComponent(prestadorId)}&`;
  if (servicoId) url += `servicoId=${encodeURIComponent(servicoId)}&`;
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
      // Garante que telefone e serviço sejam exibidos mesmo se vierem em campos alternativos
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

document.getElementById('nichoId').onchange = carregarPrestadores;
document.getElementById('prestadorId').onchange = carregarServicos;
document.getElementById('servicoId').onchange = carregarAgenda;
document.getElementById('data').onchange = carregarAgenda;
document.getElementById('clienteNome').oninput = carregarAgenda;
document.getElementById('clienteTelefone').oninput = carregarAgenda;

carregarNichos();
carregarAgenda();

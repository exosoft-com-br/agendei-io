const API_URL = 'https://plataforma-agendamentos-api.onrender.com';

async function apiFetch(path, opts = {}) {
  // Simulating fetching ownerId from somewhere, e.g., localStorage
  const ownerId = localStorage.getItem('ownerId') || 'user-placeholder';
  const headers = { 
    'Content-Type': 'application/json',
    'X-Owner-Id': ownerId, // Pass ownerId in a custom header
    ...opts.headers 
  };
  const res = await fetch(`${API_URL}/api${path}`, { ...opts, headers });
  return res.json();
}

async function carregarNegocios() {
  const sel = document.getElementById('negocioId');
  sel.innerHTML = '<option value="">Selecione...</option>';
  try {
    // Assuming the /negocios endpoint can be called if associated with an owner
    // For this example, let's assume an ownerId is needed.
    const ownerId = localStorage.getItem('ownerId');
    if (!ownerId) {
        console.warn("OwnerID not found, cannot load negocios.");
        // Maybe you need to login first or have this info available.
        // For now, let's try to call without it if the user is an admin.
    }
    const data = await apiFetch(`/negocios`); // Updated endpoint
    (data.negocios||[]).forEach(n => {
      sel.innerHTML += `<option value="${n.id}">${n.nome_fantasia||n.nome_publico||n.nome||n.id}</option>`;
    });
  } catch(e) {
      console.error("Erro ao carregar negocios", e);
  }
}

async function carregarPrestadores() {
  const negocioId = document.getElementById('negocioId').value;
  const sel = document.getElementById('prestadorId');
  sel.innerHTML = '<option value="">Todos</option>';
  if (!negocioId) { carregarServicos(); carregarAgenda(); return; }
  try {
    const data = await apiFetch(`/prestadores?negocioId=${encodeURIComponent(negocioId)}`);
    (data.prestadores||[]).forEach(p => {
      sel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
  } catch {}
  carregarServicos();
  carregarAgenda();
}

async function carregarServicos() {
  const negocioId = document.getElementById('negocioId').value;
  const sel = document.getElementById('servicoId');
  sel.innerHTML = '<option value="">Todos</option>';
  if (!negocioId) { carregarAgenda(); return; }
  try {
    // Assuming servicos can be filtered by negocioId.
    const data = await apiFetch(`/servicos?negocioId=${encodeURIComponent(negocioId)}`);
    (data.servicos||[]).forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
    });
  } catch {}
  carregarAgenda();
}

async function carregarAgenda() {
  const negocioId = document.getElementById('negocioId').value;
  const prestadorId = document.getElementById('prestadorId').value;
  const servicoId = document.getElementById('servicoId').value;
  const data = document.getElementById('data').value;
  const clienteNome = document.getElementById('clienteNome').value.trim();
  const clienteTelefone = document.getElementById('clienteTelefone').value.trim();
  let url = `/booking?`;
  if (negocioId) url += `negocioId=${encodeURIComponent(negocioId)}&`;
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
    // Efficiently fetch all required services if not already in a local cache
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

document.getElementById('negocioId').onchange = carregarPrestadores;
document.getElementById('prestadorId').onchange = carregarServicos; // This might need adjustment if services are tied to prestador
document.getElementById('servicoId').onchange = carregarAgenda;
document.getElementById('data').onchange = carregarAgenda;
document.getElementById('clienteNome').oninput = carregarAgenda;
document.getElementById('clienteTelefone').oninput = carregarAgenda;

// Initial load
carregarNegocios();
carregarAgenda();

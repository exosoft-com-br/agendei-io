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
  const id = data.negocio?.id || window.editandoNegocioId;
  gerarLinksNegocio(id);
  limparFormulario();
  carregarNegocios();
  window.editandoNegocioId = null;
}

function gerarLinksNegocio(id) {
  const baseUrl = 'https://exosoft-com-br.github.io/plataforma-agendamentos/';
  const linkAgendamento = `${baseUrl}?negocio=${id}`;
  const linkAgenda = `${window.location.origin}/agenda/agenda.html?nichoId=${id}`;
  document.getElementById('linkAgendamento').value = linkAgendamento;
  document.getElementById('linkAgenda').value = linkAgenda;
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
    (data.negocios||[]).forEach(n => {
      el.innerHTML += `<div class='negocio-card'><div class='negocio-header'><div class='negocio-info'><strong>${n.nome_fantasia||n.nome_publico||n.nome||n.id}</strong><div class='negocio-detail'>${n.descricao||''}</div></div><div class='negocio-actions'><button class='btn btn-outline btn-sm' onclick='editarNegocio("${n.id}")'>Editar</button></div></div></div>`;
    });
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
  gerarLinksNegocio(id);
}

carregarNegocios();

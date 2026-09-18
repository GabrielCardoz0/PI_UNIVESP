const lista = document.getElementById('lista');
const msg = document.getElementById('msg');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const form = document.getElementById('form-admin');
const btnNovo = document.getElementById('btn-novo');
const btnCancelar = document.getElementById('btn-cancelar');
const btnSalvar = document.getElementById('btn-salvar');
const btnLogout = document.getElementById('btn-logout');
const who = document.getElementById('who');
const inputBusca = document.getElementById('q');
let ultimoFoco = null;

const nomesCampos = {
  nomeCompleto: 'Nome Completo',
  comoPrefereChamada: 'Como prefere ser chamada',
  dataNascimento: 'Data de Nascimento',
  email: 'E-mail',
  celular: 'Celular / WhatsApp',
  rg: 'RG',
  cpf: 'CPF',
  cep: 'CEP',
  logradouro: 'Logradouro',
  numero: 'Número',
  bairro: 'Bairro',
  cidade: 'Cidade',
  estado: 'Estado',
};

function escapar(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function alerta(target, tipo, mensagens, { focar = false } = {}) {
  target.replaceChildren();
  const textos = Array.isArray(mensagens) ? mensagens : [mensagens];
  const elemento = document.createElement('div');
  elemento.className = `alert ${tipo}`;
  elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

  if (textos.length === 1) {
    elemento.textContent = textos[0];
  } else {
    const titulo = document.createElement('p');
    titulo.className = 'alert-title';
    titulo.textContent = 'Revise os seguintes problemas:';
    const itens = document.createElement('ul');
    for (const texto of textos) {
      const item = document.createElement('li');
      item.textContent = texto;
      itens.append(item);
    }
    elemento.append(titulo, itens);
  }

  if (focar) elemento.tabIndex = -1;
  target.append(elemento);
  if (focar) elemento.focus();
}

function idsDescricoes(campo) {
  return (campo.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
}

function limparErroCampo(campo) {
  campo.removeAttribute('aria-invalid');
  const errorId = `${campo.id}-error`;
  document.getElementById(errorId)?.remove();
  const descricoes = idsDescricoes(campo).filter((id) => id !== errorId);
  if (descricoes.length) campo.setAttribute('aria-describedby', descricoes.join(' '));
  else campo.removeAttribute('aria-describedby');
}

function limparErrosFormulario() {
  for (const campo of form.elements) {
    if (campo.id) limparErroCampo(campo);
  }
}

function marcarErroCampo(campo, texto) {
  if (!campo) return;
  limparErroCampo(campo);
  const errorId = `${campo.id}-error`;
  const erro = document.createElement('p');
  erro.id = errorId;
  erro.className = 'field-error';
  erro.textContent = texto;
  campo.closest('.field')?.append(erro);
  campo.setAttribute('aria-invalid', 'true');
  campo.setAttribute('aria-describedby', [...idsDescricoes(campo), errorId].join(' '));
}

function mensagemValidacao(campo) {
  const nome = nomesCampos[campo.name] || 'este campo';
  if (campo.validity.valueMissing) return `Preencha o campo “${nome}”.`;
  if (campo.name === 'dataNascimento' && campo.validity.rangeUnderflow) {
    return 'A data de nascimento não pode ser anterior a 01/01/1900.';
  }
  if (campo.name === 'dataNascimento' && campo.validity.rangeOverflow) {
    return 'A pessoa inscrita deve ter pelo menos 18 anos.';
  }
  if (campo.name === 'email' && campo.validity.patternMismatch) {
    return 'Informe um e-mail completo, incluindo o domínio (ex.: nome@exemplo.com).';
  }
  if (campo.name === 'numero' && campo.validity.patternMismatch) {
    return 'Informe somente algarismos no campo “Número”.';
  }
  if (campo.validity.typeMismatch) return `Informe um valor válido no campo “${nome}”.`;
  return `Revise o campo “${nome}”.`;
}

function validarFormulario() {
  const invalidos = [];
  for (const campo of form.elements) {
    if (!campo.willValidate) continue;
    limparErroCampo(campo);
    if (!campo.checkValidity()) {
      marcarErroCampo(campo, mensagemValidacao(campo));
      invalidos.push(campo);
    }
  }
  return invalidos;
}

function normalizarErroServidor(texto) {
  const campoObrigatorio = texto.match(/^Campo "([^"]+)" é obrigatório\.$/);
  if (campoObrigatorio && nomesCampos[campoObrigatorio[1]]) {
    return `Preencha o campo “${nomesCampos[campoObrigatorio[1]]}”.`;
  }
  return texto;
}

function campoRelacionadoAoErro(texto) {
  if (/e-mail/i.test(texto)) return form.elements.email;
  if (/estado/i.test(texto)) return form.elements.estado;
  if (/data de nascimento/i.test(texto)) return form.elements.dataNascimento;
  const nome = Object.keys(nomesCampos).find((campo) => texto.includes(`"${campo}"`));
  return nome ? form.elements[nome] : null;
}

async function carregarSessao() {
  const r = await fetch('/api/auth/me');
  if (!r.ok) {
    window.location.href = '/login.html';
    return false;
  }
  const data = await r.json();
  who.textContent = data.username ? `Usuário: ${data.username}` : '';
  return true;
}

async function carregarLista() {
  lista.setAttribute('aria-busy', 'true');
  const q = inputBusca.value.trim();
  const url = q ? `/api/admin/inscricoes?q=${encodeURIComponent(q)}` : '/api/admin/inscricoes';
  try {
    const r = await fetch(url);
    if (r.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    if (!r.ok) throw new Error('Falha ao carregar inscrições');
    const dados = await r.json();
    renderizar(dados);
  } catch {
    alerta(msg, 'error', 'Não foi possível carregar as inscrições.', { focar: true });
  } finally {
    lista.setAttribute('aria-busy', 'false');
  }
}

function renderizar(itens) {
  const badge = document.getElementById('total-badge');
  badge.replaceChildren();
  if (itens.length) {
    const total = document.createElement('span');
    total.className = 'badge';
    total.textContent = `${itens.length} ${itens.length === 1 ? 'inscrita' : 'inscritas'}`;
    badge.append(total);
  } else {
    badge.textContent = 'Nenhuma inscrita';
  }

  if (!itens.length) {
    lista.innerHTML = `
      <div class="empty">
        <div class="empty-icon" aria-hidden="true">
          <svg focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/></svg>
        </div>
        <h2 class="empty-title">Nenhuma inscrição encontrada</h2>
        <p>Tente ajustar a busca ou crie uma nova inscrição.</p>
      </div>`;
    return;
  }

  const linhas = itens.map((i) => {
    const nome = escapar(i.nomeCompleto);
    return `
      <tr>
        <th scope="row" class="nome">${nome}</th>
        <td class="muted-cell">${escapar(i.email)}</td>
        <td class="muted-cell">${escapar(i.celular)}</td>
        <td>${escapar(i.cidade)}/${escapar(i.estado)}</td>
        <td class="muted-cell">${formatarDataHora(i.createdAt)}</td>
        <td class="muted-cell">${formatarDataHora(i.updatedAt)}</td>
        <td>
          <div class="acoes">
            <button class="ghost sm" data-edit="${i.id}" aria-label="Editar inscrição de ${nome}">Editar</button>
            <button class="danger sm" data-del="${i.id}" aria-label="Excluir inscrição de ${nome}">Excluir</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  lista.innerHTML = `
    <div class="table-wrap" tabindex="0" role="region" aria-label="Tabela de inscrições">
      <table>
        <caption class="sr-only">Inscrições recebidas</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">E-mail</th>
            <th scope="col">Celular</th>
            <th scope="col">Cidade/UF</th>
            <th scope="col">Inscrita em</th>
            <th scope="col">Atualizada em</th>
            <th scope="col" class="acoes-header">Ações</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function formatarDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function abrirModal(titulo, dados) {
  ultimoFoco = document.activeElement;
  modalTitle.textContent = titulo;
  modalMsg.replaceChildren();
  form.reset();
  limparErrosFormulario();

  for (const [k, v] of Object.entries(dados || {})) {
    const el = form.elements.namedItem(k);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'date' && v) el.value = new Date(v).toISOString().slice(0, 10);
    else el.value = v ?? '';
  }
  formatarValoresExistentes(form);

  const ts = document.getElementById('modal-timestamps');
  if (dados && dados.id && (dados.createdAt || dados.updatedAt)) {
    ts.textContent = `Inscrita em: ${formatarDataHora(dados.createdAt)} · Atualizada em: ${formatarDataHora(dados.updatedAt)}`;
    ts.style.display = 'block';
  } else {
    ts.textContent = '';
    ts.style.display = 'none';
  }

  modal.showModal();
  requestAnimationFrame(() => form.elements.nomeCompleto.focus());
}

function fecharModal() {
  if (modal.open) modal.close();
}

function coletarPayload() {
  const fd = new FormData(form);
  return {
    nomeCompleto: fd.get('nomeCompleto'),
    comoPrefereChamada: fd.get('comoPrefereChamada'),
    dataNascimento: fd.get('dataNascimento'),
    email: fd.get('email'),
    celular: fd.get('celular'),
    rg: fd.get('rg'),
    cpf: fd.get('cpf'),
    cep: fd.get('cep'),
    logradouro: fd.get('logradouro'),
    numero: fd.get('numero'),
    complemento: fd.get('complemento'),
    bairro: fd.get('bairro'),
    cidade: fd.get('cidade'),
    estado: fd.get('estado'),
  };
}

btnNovo.addEventListener('click', () => abrirModal('Nova inscrição', { id: '' }));
btnCancelar.addEventListener('click', fecharModal);

modal.addEventListener('cancel', (event) => {
  event.preventDefault();
  fecharModal();
});

modal.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    fecharModal();
  }
});

modal.addEventListener('close', () => {
  if (ultimoFoco && document.contains(ultimoFoco)) ultimoFoco.focus();
});

modal.addEventListener('click', (event) => {
  if (event.target !== modal) return;
  const rect = modal.getBoundingClientRect();
  const fora = event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom;
  if (fora) fecharModal();
});

btnLogout.addEventListener('click', async () => {
  btnLogout.disabled = true;
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

inputBusca.addEventListener('input', () => {
  clearTimeout(inputBusca._t);
  inputBusca._t = setTimeout(carregarLista, 250);
});

lista.addEventListener('click', async (event) => {
  const botaoEditar = event.target.closest('[data-edit]');
  const botaoExcluir = event.target.closest('[data-del]');

  if (botaoEditar) {
    const r = await fetch(`/api/admin/inscricoes/${botaoEditar.dataset.edit}`);
    if (!r.ok) {
      alerta(msg, 'error', 'Não foi possível carregar a inscrição.', { focar: true });
      return;
    }
    const dados = await r.json();
    abrirModal('Editar inscrição', { ...dados, id: dados.id });
  }

  if (botaoExcluir) {
    if (!confirm('Excluir esta inscrição?')) return;
    const r = await fetch(`/api/admin/inscricoes/${botaoExcluir.dataset.del}`, { method: 'DELETE' });
    if (!r.ok) alerta(msg, 'error', 'Erro ao excluir.', { focar: true });
    else {
      alerta(msg, 'success', 'Inscrição excluída.', { focar: true });
      carregarLista();
    }
  }
});

form.addEventListener('input', (event) => {
  if (event.target.matches('input, select') && event.target.checkValidity()) {
    limparErroCampo(event.target);
  }
});

form.addEventListener('change', (event) => {
  if (event.target.matches('input, select') && event.target.checkValidity()) {
    limparErroCampo(event.target);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalMsg.replaceChildren();

  const invalidos = validarFormulario();
  if (invalidos.length) {
    alerta(
      modalMsg,
      'error',
      invalidos.length === 1
        ? 'Há 1 campo que precisa ser corrigido antes de salvar.'
        : `Há ${invalidos.length} campos que precisam ser corrigidos antes de salvar.`,
    );
    invalidos[0].focus();
    return;
  }

  const id = form.elements.namedItem('id').value;
  const payload = coletarPayload();
  const url = id ? `/api/admin/inscricoes/${id}` : '/api/admin/inscricoes';
  const method = id ? 'PUT' : 'POST';
  btnSalvar.disabled = true;
  btnSalvar.setAttribute('aria-busy', 'true');
  btnSalvar.textContent = 'Salvando…';
  form.setAttribute('aria-busy', 'true');

  try {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const errosOriginais = body.erros || [body.error || 'Erro ao salvar.'];
      const erros = errosOriginais.map(normalizarErroServidor);
      for (const erro of errosOriginais) {
        const campo = campoRelacionadoAoErro(erro);
        if (campo) marcarErroCampo(campo, normalizarErroServidor(erro));
      }
      alerta(modalMsg, 'error', erros);
      const primeiroInvalido = form.querySelector('[aria-invalid="true"]');
      if (primeiroInvalido) primeiroInvalido.focus();
      return;
    }

    fecharModal();
    alerta(msg, 'success', id ? 'Inscrição atualizada.' : 'Inscrição criada.', { focar: true });
    carregarLista();
  } catch {
    alerta(modalMsg, 'error', 'Falha de conexão.', { focar: true });
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.removeAttribute('aria-busy');
    btnSalvar.textContent = 'Salvar';
    form.removeAttribute('aria-busy');
  }
});

attachMasks(form);
attachCepLookup(form);
configurarDataNascimento(form);
carregarSessao().then((autenticado) => {
  if (autenticado) carregarLista();
});

const form = document.getElementById('form-inscricao');
const msg = document.getElementById('msg');
const btn = document.getElementById('btn-enviar');

attachMasks(form);
attachCepLookup(form);
configurarDataNascimento(form);

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
  aceiteLgpd: 'Autorização de uso dos dados conforme a LGPD',
  aceiteMaiorIdade: 'Declaração de maioridade',
};

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

function marcarErroCampo(campo, texto) {
  if (!campo) return;
  limparErroCampo(campo);
  const errorId = `${campo.id}-error`;
  const erro = document.createElement('p');
  erro.id = errorId;
  erro.className = 'field-error';
  erro.textContent = texto;
  campo.closest('.field, .checkbox')?.append(erro);
  campo.setAttribute('aria-invalid', 'true');
  campo.setAttribute('aria-describedby', [...idsDescricoes(campo), errorId].join(' '));
}

function mensagemValidacao(campo) {
  const nome = nomesCampos[campo.name] || 'este campo';
  if (campo.validity.valueMissing) {
    if (campo.type === 'checkbox') return `Marque “${nome}” para continuar.`;
    return `Preencha o campo “${nome}”.`;
  }
  if (campo.name === 'dataNascimento' && campo.validity.rangeUnderflow) {
    return 'A data de nascimento não pode ser anterior a 01/01/1900.';
  }
  if (campo.name === 'dataNascimento' && campo.validity.rangeOverflow) {
    return 'É necessário ter pelo menos 18 anos para realizar a inscrição.';
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

function mostrarMsg(tipo, mensagens, { focar = false } = {}) {
  msg.replaceChildren();
  const textos = Array.isArray(mensagens) ? mensagens : [mensagens];
  const alerta = document.createElement('div');
  alerta.className = `alert ${tipo}`;
  alerta.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

  if (textos.length === 1) {
    alerta.textContent = textos[0];
  } else {
    const titulo = document.createElement('p');
    titulo.className = 'alert-title';
    titulo.textContent = 'Revise os seguintes problemas:';
    const lista = document.createElement('ul');
    for (const texto of textos) {
      const item = document.createElement('li');
      item.textContent = texto;
      lista.append(item);
    }
    alerta.append(titulo, lista);
  }

  if (focar) alerta.tabIndex = -1;
  msg.append(alerta);
  if (focar) alerta.focus({ preventScroll: true });
  msg.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

function normalizarErroServidor(texto) {
  const campoObrigatorio = texto.match(/^Campo "([^"]+)" é obrigatório\.$/);
  if (campoObrigatorio && nomesCampos[campoObrigatorio[1]]) {
    return `Preencha o campo “${nomesCampos[campoObrigatorio[1]]}”.`;
  }
  return texto;
}

function campoRelacionadoAoErro(texto) {
  const nomes = Object.keys(nomesCampos);
  if (/e-mail/i.test(texto)) return form.elements.email;
  if (/estado/i.test(texto)) return form.elements.estado;
  if (/data de nascimento/i.test(texto)) return form.elements.dataNascimento;
  if (/LGPD/i.test(texto)) return form.elements.aceiteLgpd;
  if (/maior de 18/i.test(texto)) return form.elements.aceiteMaiorIdade;
  return form.elements[nomes.find((nome) => texto.includes(`"${nome}"`))];
}

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
  msg.replaceChildren();

  const invalidos = validarFormulario();
  if (invalidos.length) {
    mostrarMsg(
      'error',
      invalidos.length === 1
        ? 'Há 1 campo que precisa ser corrigido antes do envio.'
        : `Há ${invalidos.length} campos que precisam ser corrigidos antes do envio.`,
    );
    invalidos[0].focus();
    return;
  }

  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = 'Enviando…';
  form.setAttribute('aria-busy', 'true');
  mostrarMsg('info', 'Enviando inscrição…');

  const fd = new FormData(form);
  const payload = {
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
    aceiteLgpd: fd.get('aceiteLgpd') === 'on',
    aceiteMaiorIdade: fd.get('aceiteMaiorIdade') === 'on',
    aceiteImagem: fd.get('aceiteImagem') === 'on',
  };

  try {
    const r = await fetch('/api/inscricoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const errosOriginais = body.erros || [body.error || 'Erro ao enviar.'];
      const erros = errosOriginais.map(normalizarErroServidor);
      for (const erro of errosOriginais) {
        const campo = campoRelacionadoAoErro(erro);
        if (campo) marcarErroCampo(campo, normalizarErroServidor(erro));
      }
      mostrarMsg('error', erros, { focar: true });
      const primeiroInvalido = form.querySelector('[aria-invalid="true"]');
      if (primeiroInvalido) primeiroInvalido.focus();
    } else {
      window.location.href = '/obrigado.html';
      return;
    }
  } catch {
    mostrarMsg('error', 'Falha de conexão. Tente novamente.', { focar: true });
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.textContent = 'Enviar inscrição';
    form.removeAttribute('aria-busy');
  }
});

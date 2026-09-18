function maskCPF(v) {
  v = (v || '').replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return v;
}

function maskRG(v) {
  v = (v || '').replace(/[^\dXx]/g, '').toUpperCase().slice(0, 10);
  if (v.length > 8) return v.replace(/(\d{2})(\d{3})(\d{3})([\dX]+)/, '$1.$2.$3-$4');
  if (v.length > 5) return v.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  if (v.length > 2) return v.replace(/(\d{2})(\d+)/, '$1.$2');
  return v;
}

function maskTelefone(v) {
  v = (v || '').replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (v.length > 6)  return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  if (v.length > 2)  return v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  if (v.length > 0)  return v.replace(/(\d{0,2})/, '($1');
  return v;
}

function maskCEP(v) {
  v = (v || '').replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) return v.replace(/(\d{5})(\d{1,3})/, '$1-$2');
  return v;
}

function maskNumero(v) {
  return (v || '').replace(/\D/g, '').slice(0, 20);
}

const MASCARAS = {
  cpf: maskCPF,
  rg: maskRG,
  celular: maskTelefone,
  cep: maskCEP,
  numero: maskNumero,
};

function attachMasks(root) {
  for (const [name, fn] of Object.entries(MASCARAS)) {
    const el = root.querySelector(`[name="${name}"]`);
    if (!el) continue;
    const formatar = () => {
      const formatted = fn(el.value);
      if (el.value !== formatted) {
        el.value = formatted;
        try { el.setSelectionRange(formatted.length, formatted.length); } catch {}
      }
    };
    el.addEventListener('input', formatar);
    el.addEventListener('blur', formatar);
    if (el.value) el.value = fn(el.value);
  }
}

function formatarValoresExistentes(root) {
  for (const [name, fn] of Object.entries(MASCARAS)) {
    const el = root.querySelector(`[name="${name}"]`);
    if (el && el.value) el.value = fn(el.value);
  }
}

async function buscarCep(cep, form) {
  const digits = (cep || '').replace(/\D/g, '');
  if (digits.length !== 8) return;
  const cepInput = form.elements.cep;
  const status = form.querySelector('[data-cep-status]');
  if (cepInput) cepInput.dataset.loading = '1';
  if (status) status.textContent = 'Consultando CEP…';
  try {
    const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!r.ok) {
      if (status) status.textContent = 'Não foi possível consultar o CEP. Preencha o endereço manualmente.';
      return;
    }
    const data = await r.json();
    if (data.erro) {
      if (status) status.textContent = 'CEP não encontrado. Preencha o endereço manualmente.';
      return;
    }
    const preencher = (nome, valor) => {
      const campo = form.elements[nome];
      if (!campo || !valor) return;
      campo.value = valor;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    };
    preencher('logradouro', data.logradouro);
    preencher('bairro', data.bairro);
    preencher('cidade', data.localidade);
    preencher('estado', data.uf);
    if (status) status.textContent = 'Endereço preenchido com os dados encontrados para o CEP.';
  } catch {
    if (status) status.textContent = 'Falha de conexão ao consultar o CEP. Preencha o endereço manualmente.';
  } finally {
    if (cepInput) delete cepInput.dataset.loading;
  }
}

function configurarDataNascimento(form) {
  const campo = form.elements.dataNascimento;
  if (!campo) return;
  const hoje = new Date();
  const ano = hoje.getFullYear() - 18;
  const mes = hoje.getMonth() + 1;
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
  const dia = Math.min(hoje.getDate(), ultimoDiaDoMes);
  campo.max = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function attachCepLookup(form) {
  const cepEl = form.elements.cep;
  if (!cepEl) return;
  const handler = () => buscarCep(cepEl.value, form);
  cepEl.addEventListener('blur', handler);
  cepEl.addEventListener('input', () => {
    const status = form.querySelector('[data-cep-status]');
    if (status && (cepEl.value || '').replace(/\D/g, '').length < 8) status.textContent = '';
    if ((cepEl.value || '').replace(/\D/g, '').length === 8) handler();
  });
}

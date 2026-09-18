const { Prisma } = require('@prisma/client');
const repo = require('../repositories/inscricaoRepository');

const ESTADOS_VALIDOS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO', 'EX',
]);

const DATA_NASCIMENTO_MINIMA = '1900-01-01';
const EMAIL_VALIDO = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function dataMaximaParaMaioridade() {
  const hoje = new Date();
  const ano = hoje.getFullYear() - 18;
  const mes = hoje.getMonth() + 1;
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
  const dia = Math.min(hoje.getDate(), ultimoDiaDoMes);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

class ValidationError extends Error {
  constructor(erros) {
    super('Validação falhou');
    this.erros = erros;
    this.status = 400;
  }
}

class ConflictError extends Error {
  constructor(campo) {
    super(`Já existe inscrição com este ${campo}.`);
    this.status = 409;
  }
}

class NotFoundError extends Error {
  constructor() {
    super('Inscrição não encontrada');
    this.status = 404;
  }
}

function sanitizeString(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function normalizar(data, { exigirAceites }) {
  const erros = [];
  const out = {};

  const camposTexto = [
    ['nomeCompleto', 200],
    ['comoPrefereChamada', 100],
    ['celular', 30],
    ['rg', 30],
    ['cpf', 20],
    ['cep', 15],
    ['logradouro', 200],
    ['numero', 20],
    ['bairro', 120],
    ['cidade', 120],
  ];
  for (const [campo, max] of camposTexto) {
    const v = sanitizeString(data[campo], max);
    if (!v) erros.push(`Campo "${campo}" é obrigatório.`);
    out[campo] = v;
  }

  if (out.numero && !/^\d+$/.test(out.numero)) {
    erros.push('Número do endereço deve conter somente algarismos.');
  }

  const complemento = sanitizeString(data.complemento, 120);
  out.complemento = complemento || null;

  const email = sanitizeString(data.email, 200).toLowerCase();
  if (!email || !EMAIL_VALIDO.test(email)) {
    erros.push('E-mail inválido.');
  }
  out.email = email;

  const estado = sanitizeString(data.estado, 4).toUpperCase();
  if (!ESTADOS_VALIDOS.has(estado)) erros.push('Estado inválido.');
  out.estado = estado;

  if (!data.dataNascimento) {
    erros.push('Data de nascimento é obrigatória.');
  } else {
    const dataNascimento = sanitizeString(data.dataNascimento, 10);
    const d = new Date(`${dataNascimento}T00:00:00.000Z`);
    const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)
      && !isNaN(d.getTime())
      && d.toISOString().slice(0, 10) === dataNascimento;

    if (!dataValida) erros.push('Data de nascimento inválida.');
    else if (dataNascimento < DATA_NASCIMENTO_MINIMA) {
      erros.push('Data de nascimento não pode ser anterior a 01/01/1900.');
    } else if (dataNascimento > dataMaximaParaMaioridade()) {
      erros.push('Data de nascimento inválida: é necessário ter pelo menos 18 anos.');
    } else out.dataNascimento = d;
  }

  if ('aceiteLgpd' in data) out.aceiteLgpd = !!data.aceiteLgpd;
  if ('aceiteMaiorIdade' in data) out.aceiteMaiorIdade = !!data.aceiteMaiorIdade;
  if ('aceiteImagem' in data) out.aceiteImagem = !!data.aceiteImagem;

  if (exigirAceites) {
    if (!out.aceiteLgpd) erros.push('É necessário autorizar o uso dos dados (LGPD).');
    if (!out.aceiteMaiorIdade) erros.push('É necessário declarar ser maior de 18 anos.');
  }

  if (erros.length) throw new ValidationError(erros);
  return out;
}

function tratarErroPrisma(e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const campo = (e.meta?.target || []).join(', ') || 'campo único';
      throw new ConflictError(campo);
    }
    if (e.code === 'P2025') throw new NotFoundError();
  }
  throw e;
}

async function listar(busca) {
  return repo.listar({ busca });
}

async function obter(id) {
  const inscricao = await repo.buscarPorId(id);
  if (!inscricao) throw new NotFoundError();
  return inscricao;
}

async function criarPublica(payload) {
  const dados = normalizar(payload, { exigirAceites: true });
  try {
    return await repo.criar(dados);
  } catch (e) { tratarErroPrisma(e); }
}

async function criarAdmin(payload) {
  const dados = normalizar(payload, { exigirAceites: false });
  try {
    return await repo.criar(dados);
  } catch (e) { tratarErroPrisma(e); }
}

async function atualizar(id, payload) {
  const dados = normalizar(payload, { exigirAceites: false });
  try {
    return await repo.atualizar(id, dados);
  } catch (e) { tratarErroPrisma(e); }
}

async function remover(id) {
  try {
    await repo.remover(id);
  } catch (e) { tratarErroPrisma(e); }
}

module.exports = {
  listar,
  obter,
  criarPublica,
  criarAdmin,
  atualizar,
  remover,
  ValidationError,
  ConflictError,
  NotFoundError,
};

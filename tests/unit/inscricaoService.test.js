jest.mock('../../src/repositories/inscricaoRepository');
const { Prisma } = require('@prisma/client');
const repo = require('../../src/repositories/inscricaoRepository');
const service = require('../../src/services/inscricaoService');
const { inscricaoValida } = require('../helpers/fixtures');

const prismaErr = (code, meta) =>
  new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test', meta });

beforeEach(() => jest.resetAllMocks());

describe('normalização/validação (via criarPublica)', () => {
  test('payload válido é normalizado e enviado ao repositório', async () => {
    repo.criar.mockResolvedValue({ id: 1 });
    await expect(service.criarPublica(inscricaoValida())).resolves.toEqual({ id: 1 });
    const dados = repo.criar.mock.calls[0][0];
    expect(dados.email).toBe('maria@example.com');
    expect(dados.estado).toBe('SP');
    expect(dados.dataNascimento).toBeInstanceOf(Date);
    expect(dados.aceiteLgpd).toBe(true);
    expect(dados.aceiteImagem).toBe(false);
  });

  test.each([
    'nomeCompleto', 'comoPrefereChamada', 'celular', 'rg', 'cpf',
    'cep', 'logradouro', 'numero', 'bairro', 'cidade',
  ])('campo obrigatório %s vazio', async (campo) => {
    await expect(service.criarPublica(inscricaoValida({ [campo]: '   ' })))
      .rejects.toMatchObject({ status: 400, erros: [`Campo "${campo}" é obrigatório.`] });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  test('campo não-string é tratado como vazio', async () => {
    await expect(service.criarPublica(inscricaoValida({ rg: 123 })))
      .rejects.toMatchObject({ status: 400 });
  });

  test('trunca textos acima do limite', async () => {
    repo.criar.mockResolvedValue({});
    await service.criarPublica(inscricaoValida({ nomeCompleto: 'a'.repeat(300) }));
    expect(repo.criar.mock.calls[0][0].nomeCompleto).toHaveLength(200);
  });

  test('complemento vazio vira null', async () => {
    repo.criar.mockResolvedValue({});
    await service.criarPublica(inscricaoValida({ complemento: '' }));
    expect(repo.criar.mock.calls[0][0].complemento).toBeNull();
  });

  test.each(['', 'sem-arroba', 'a@b', 'a b@c.com'])('e-mail inválido "%s"', async (email) => {
    await expect(service.criarPublica(inscricaoValida({ email })))
      .rejects.toMatchObject({ erros: ['E-mail inválido.'] });
  });

  test.each(['XX', '', 'S'])('estado inválido "%s"', async (estado) => {
    await expect(service.criarPublica(inscricaoValida({ estado })))
      .rejects.toMatchObject({ erros: ['Estado inválido.'] });
  });

  test('estado EX é aceito', async () => {
    repo.criar.mockResolvedValue({});
    await service.criarPublica(inscricaoValida({ estado: 'ex' }));
    expect(repo.criar.mock.calls[0][0].estado).toBe('EX');
  });

  test('data de nascimento ausente', async () => {
    await expect(service.criarPublica(inscricaoValida({ dataNascimento: undefined })))
      .rejects.toMatchObject({ erros: ['Data de nascimento é obrigatória.'] });
  });

  test('data de nascimento inválida', async () => {
    await expect(service.criarPublica(inscricaoValida({ dataNascimento: 'abc' })))
      .rejects.toMatchObject({ erros: ['Data de nascimento inválida.'] });
  });

  test('exige aceites no fluxo público', async () => {
    await expect(service.criarPublica(inscricaoValida({ aceiteLgpd: false, aceiteMaiorIdade: false })))
      .rejects.toMatchObject({
        erros: [
          'É necessário autorizar o uso dos dados (LGPD).',
          'É necessário declarar ser maior de 18 anos.',
        ],
      });
  });

  test('aceites ausentes no fluxo público também falham', async () => {
    const p = inscricaoValida();
    delete p.aceiteLgpd; delete p.aceiteMaiorIdade; delete p.aceiteImagem;
    await expect(service.criarPublica(p)).rejects.toMatchObject({ status: 400 });
  });

  test('acumula múltiplos erros', async () => {
    const err = await service.criarPublica({}).catch((e) => e);
    expect(err).toBeInstanceOf(service.ValidationError);
    expect(err.erros.length).toBeGreaterThan(5);
  });
});

describe('criarAdmin / atualizar', () => {
  test('criarAdmin não exige aceites e não os define se ausentes', async () => {
    const p = inscricaoValida();
    delete p.aceiteLgpd; delete p.aceiteMaiorIdade; delete p.aceiteImagem;
    repo.criar.mockResolvedValue({ id: 2 });
    await expect(service.criarAdmin(p)).resolves.toEqual({ id: 2 });
    expect(repo.criar.mock.calls[0][0]).not.toHaveProperty('aceiteLgpd');
  });

  test('criarAdmin valida', async () => {
    await expect(service.criarAdmin({})).rejects.toBeInstanceOf(service.ValidationError);
  });

  test('atualizar sucesso', async () => {
    repo.atualizar.mockResolvedValue({ id: 3 });
    await expect(service.atualizar(3, inscricaoValida())).resolves.toEqual({ id: 3 });
    expect(repo.atualizar).toHaveBeenCalledWith(3, expect.any(Object));
  });

  test('atualizar com P2025 vira NotFoundError', async () => {
    repo.atualizar.mockRejectedValue(prismaErr('P2025'));
    await expect(service.atualizar(9, inscricaoValida())).rejects.toBeInstanceOf(service.NotFoundError);
  });

  test('atualizar valida', async () => {
    await expect(service.atualizar(1, {})).rejects.toMatchObject({ status: 400 });
  });
});

describe('mapeamento de erros do Prisma', () => {
  test('P2002 com meta.target', async () => {
    repo.criar.mockRejectedValue(prismaErr('P2002', { target: ['cpf', 'email'] }));
    await expect(service.criarPublica(inscricaoValida()))
      .rejects.toMatchObject({ status: 409, message: 'Já existe inscrição com este cpf, email.' });
  });

  test('P2002 sem meta', async () => {
    repo.criar.mockRejectedValue(prismaErr('P2002'));
    await expect(service.criarAdmin(inscricaoValida()))
      .rejects.toBeInstanceOf(service.ConflictError);
  });

  test('outro código Prisma é repassado', async () => {
    const e = prismaErr('P9999');
    repo.criar.mockRejectedValue(e);
    await expect(service.criarPublica(inscricaoValida())).rejects.toBe(e);
  });

  test('erro genérico é repassado', async () => {
    const e = new Error('boom');
    repo.criar.mockRejectedValue(e);
    await expect(service.criarPublica(inscricaoValida())).rejects.toBe(e);
  });
});

describe('listar / obter / remover', () => {
  test('listar repassa a busca', async () => {
    repo.listar.mockResolvedValue([1]);
    await expect(service.listar('x')).resolves.toEqual([1]);
    expect(repo.listar).toHaveBeenCalledWith({ busca: 'x' });
  });

  test('obter encontrado', async () => {
    repo.buscarPorId.mockResolvedValue({ id: 1 });
    await expect(service.obter(1)).resolves.toEqual({ id: 1 });
  });

  test('obter inexistente', async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.obter(1)).rejects.toMatchObject({ status: 404 });
  });

  test('remover sucesso', async () => {
    repo.remover.mockResolvedValue({});
    await expect(service.remover(1)).resolves.toBeUndefined();
  });

  test('remover inexistente (P2025)', async () => {
    repo.remover.mockRejectedValue(prismaErr('P2025'));
    await expect(service.remover(1)).rejects.toBeInstanceOf(service.NotFoundError);
  });
});

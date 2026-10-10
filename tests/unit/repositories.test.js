const mockPrisma = {
  inscricao: {
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), delete: jest.fn(),
  },
  admin: { findUnique: jest.fn(), create: jest.fn() },
};
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

const inscRepo = require('../../src/repositories/inscricaoRepository');
const adminRepo = require('../../src/repositories/adminRepository');

beforeEach(() => jest.clearAllMocks());

describe('inscricaoRepository', () => {
  test('listar sem busca', async () => {
    mockPrisma.inscricao.findMany.mockResolvedValue([]);
    await inscRepo.listar();
    expect(mockPrisma.inscricao.findMany).toHaveBeenCalledWith({ where: {}, orderBy: { createdAt: 'desc' } });
  });

  test('listar com busca', async () => {
    await inscRepo.listar({ busca: 'ana' });
    const { where } = mockPrisma.inscricao.findMany.mock.calls[0][0];
    expect(where.OR).toHaveLength(4);
    expect(where.OR[0]).toEqual({ nomeCompleto: { contains: 'ana' } });
  });

  test('buscarPorId / criar / atualizar / remover', async () => {
    await inscRepo.buscarPorId(1);
    expect(mockPrisma.inscricao.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    await inscRepo.criar({ a: 1 });
    expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({ data: { a: 1 } });
    await inscRepo.atualizar(2, { b: 2 });
    expect(mockPrisma.inscricao.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { b: 2 } });
    await inscRepo.remover(3);
    expect(mockPrisma.inscricao.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});

describe('adminRepository', () => {
  test('buscarPorUsername e criar', async () => {
    await adminRepo.buscarPorUsername('admin');
    expect(mockPrisma.admin.findUnique).toHaveBeenCalledWith({ where: { username: 'admin' } });
    await adminRepo.criar({ username: 'a', passwordHash: 'h' });
    expect(mockPrisma.admin.create).toHaveBeenCalledWith({ data: { username: 'a', passwordHash: 'h' } });
  });
});

jest.mock('../../src/repositories/adminRepository');
const bcrypt = require('bcryptjs');
const adminRepo = require('../../src/repositories/adminRepository');
const { autenticar, AuthError } = require('../../src/services/authService');

let hash;
beforeAll(() => { hash = bcrypt.hashSync('segredo', 4); });
beforeEach(() => jest.resetAllMocks());

test.each([[undefined, 'x'], ['admin', ''], ['', '']])('credenciais ausentes (%p, %p)', async (u, p) => {
  await expect(autenticar(u, p)).rejects.toBeInstanceOf(AuthError);
  expect(adminRepo.buscarPorUsername).not.toHaveBeenCalled();
});

test('usuário inexistente', async () => {
  adminRepo.buscarPorUsername.mockResolvedValue(null);
  await expect(autenticar('x', 'y')).rejects.toMatchObject({ status: 401, message: 'Credenciais inválidas' });
});

test('senha errada', async () => {
  adminRepo.buscarPorUsername.mockResolvedValue({ id: 1, username: 'admin', passwordHash: hash });
  await expect(autenticar('admin', 'errada')).rejects.toBeInstanceOf(AuthError);
});

test('sucesso não vaza o hash', async () => {
  adminRepo.buscarPorUsername.mockResolvedValue({ id: 1, username: 'admin', passwordHash: hash });
  await expect(autenticar('admin', 'segredo')).resolves.toEqual({ id: 1, username: 'admin' });
});

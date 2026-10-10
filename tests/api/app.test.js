jest.mock('../../src/services/inscricaoService');
jest.mock('../../src/services/authService');
const request = require('supertest');
const inscricaoService = require('../../src/services/inscricaoService');
const authService = require('../../src/services/authService');
const app = require('../../app');
const { inscricaoValida } = require('../helpers/fixtures');

const httpErr = (status, erros) => Object.assign(new Error('x'), { status, erros });

async function logado() {
  authService.autenticar.mockResolvedValue({ id: 1, username: 'admin' });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'p' }).expect(200);
  return agent;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /api/inscricoes', () => {
  test('201 com id', async () => {
    inscricaoService.criarPublica.mockResolvedValue({ id: 7, extra: 'x' });
    const res = await request(app).post('/api/inscricoes').send(inscricaoValida());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 7 });
  });

  test('400 com lista de erros', async () => {
    inscricaoService.criarPublica.mockRejectedValue(httpErr(400, ['a', 'b']));
    const res = await request(app).post('/api/inscricoes').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erros: ['a', 'b'] });
  });

  test('409 usa a mensagem do erro', async () => {
    inscricaoService.criarPublica.mockRejectedValue(httpErr(409));
    const res = await request(app).post('/api/inscricoes').send({});
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erros: ['x'] });
  });

  test('500 genérico', async () => {
    inscricaoService.criarPublica.mockRejectedValue(new Error('db caiu'));
    const res = await request(app).post('/api/inscricoes').send({});
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ erros: ['Erro interno.'] });
  });
});

describe('autenticação', () => {
  test('login ok', async () => {
    authService.autenticar.mockResolvedValue({ id: 1, username: 'admin' });
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'p' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, username: 'admin' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('login 401', async () => {
    authService.autenticar.mockRejectedValue(Object.assign(new Error('Credenciais inválidas'), { status: 401 }));
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciais inválidas' });
  });

  test('login com erro inesperado -> 500', async () => {
    authService.autenticar.mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(500);
  });

  test('me sem sessão', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ authenticated: false });
  });

  test('me, logout e me novamente', async () => {
    const agent = await logado();
    const me = await agent.get('/api/auth/me');
    expect(me.body).toEqual({ authenticated: true, username: 'admin' });
    await agent.post('/api/auth/logout').expect(200, { ok: true });
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('rotas admin exigem autenticação', () => {
  test.each([
    ['get', '/api/admin/inscricoes'],
    ['get', '/api/admin/inscricoes/1'],
    ['post', '/api/admin/inscricoes'],
    ['put', '/api/admin/inscricoes/1'],
    ['delete', '/api/admin/inscricoes/1'],
  ])('%s %s -> 401', async (metodo, url) => {
    const res = await request(app)[metodo](url);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Não autenticado' });
  });
});

describe('CRUD admin autenticado', () => {
  test('listar com busca (trim) e sem busca', async () => {
    inscricaoService.listar.mockResolvedValue([{ id: 1 }]);
    const agent = await logado();
    await agent.get('/api/admin/inscricoes?q=%20ana%20').expect(200, [{ id: 1 }]);
    expect(inscricaoService.listar).toHaveBeenLastCalledWith('ana');
    await agent.get('/api/admin/inscricoes?q=a&q=b').expect(200);
    expect(inscricaoService.listar).toHaveBeenLastCalledWith('');
    await agent.get('/api/admin/inscricoes').expect(200);
    expect(inscricaoService.listar).toHaveBeenLastCalledWith('');
  });

  test('listar com erro -> 500', async () => {
    inscricaoService.listar.mockRejectedValue(new Error('x'));
    const agent = await logado();
    await agent.get('/api/admin/inscricoes').expect(500);
  });

  test('obter: ok, 404 e id inválido', async () => {
    const agent = await logado();
    inscricaoService.obter.mockResolvedValueOnce({ id: 5 });
    await agent.get('/api/admin/inscricoes/5').expect(200, { id: 5 });
    inscricaoService.obter.mockRejectedValueOnce(httpErr(404));
    await agent.get('/api/admin/inscricoes/6').expect(404);
    await agent.get('/api/admin/inscricoes/abc').expect(400, { erros: ['ID inválido'] });
    await agent.get('/api/admin/inscricoes/1.5').expect(400);
  });

  test('criar: 201 e 400', async () => {
    const agent = await logado();
    inscricaoService.criarAdmin.mockResolvedValueOnce({ id: 9 });
    await agent.post('/api/admin/inscricoes').send(inscricaoValida()).expect(201, { id: 9 });
    inscricaoService.criarAdmin.mockRejectedValueOnce(httpErr(400, ['e']));
    await agent.post('/api/admin/inscricoes').send({}).expect(400, { erros: ['e'] });
  });

  test('atualizar: ok, erro e id inválido', async () => {
    const agent = await logado();
    inscricaoService.atualizar.mockResolvedValueOnce({ id: 2 });
    await agent.put('/api/admin/inscricoes/2').send({}).expect(200, { id: 2 });
    expect(inscricaoService.atualizar).toHaveBeenCalledWith(2, {});
    inscricaoService.atualizar.mockRejectedValueOnce(httpErr(404));
    await agent.put('/api/admin/inscricoes/3').send({}).expect(404);
    await agent.put('/api/admin/inscricoes/x').send({}).expect(400);
  });

  test('remover: ok, erro e id inválido', async () => {
    const agent = await logado();
    inscricaoService.remover.mockResolvedValueOnce();
    await agent.delete('/api/admin/inscricoes/2').expect(200, { ok: true });
    inscricaoService.remover.mockRejectedValueOnce(httpErr(404));
    await agent.delete('/api/admin/inscricoes/3').expect(404);
    await agent.delete('/api/admin/inscricoes/x').expect(400);
  });
});

describe('GET /admin', () => {
  test('redireciona sem sessão', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login.html');
  });

  test('serve admin.html com sessão', async () => {
    const agent = await logado();
    const res = await agent.get('/admin');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

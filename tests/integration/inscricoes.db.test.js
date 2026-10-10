const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
process.env.DATABASE_URL = 'file:./test.db';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const app = require('../../app');
const { inscricaoValida } = require('../helpers/fixtures');

const prisma = new PrismaClient();

beforeAll(async () => {
  execSync('npx prisma db push --skip-generate --force-reset', {
    cwd: root, stdio: 'ignore', env: { ...process.env },
  });
  await prisma.admin.create({
    data: { username: 'admin', passwordHash: bcrypt.hashSync('admin123', 4) },
  });
}, 60000);

afterAll(() => prisma.$disconnect());

test('fluxo completo com banco real', async () => {
  // público cria
  const criada = await request(app).post('/api/inscricoes').send(inscricaoValida());
  expect(criada.status).toBe(201);
  const id = criada.body.id;

  // login errado e certo
  await request(app).post('/api/auth/login').send({ username: 'admin', password: 'x' }).expect(401);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' }).expect(200);

  // listar/buscar
  const lista = await agent.get('/api/admin/inscricoes?q=maria');
  expect(lista.body).toHaveLength(1);
  expect((await agent.get('/api/admin/inscricoes?q=zzz')).body).toHaveLength(0);

  // obter
  const obtida = await agent.get(`/api/admin/inscricoes/${id}`);
  expect(obtida.body.email).toBe('maria@example.com');
  expect(obtida.body.estado).toBe('SP');

  // atualizar
  const atual = await agent.put(`/api/admin/inscricoes/${id}`).send(inscricaoValida({ cidade: 'Campinas' }));
  expect(atual.status).toBe(200);
  expect(atual.body.cidade).toBe('Campinas');

  // criar via admin
  await agent.post('/api/admin/inscricoes').send(inscricaoValida({ cpf: '999' })).expect(201);

  // remover e 404 subsequentes
  await agent.delete(`/api/admin/inscricoes/${id}`).expect(200);
  await agent.get(`/api/admin/inscricoes/${id}`).expect(404);
  await agent.delete(`/api/admin/inscricoes/${id}`).expect(404);
  await agent.put(`/api/admin/inscricoes/${id}`).send(inscricaoValida()).expect(404);
}, 30000);

test('duplicidade de CPF é aceita hoje (sem @unique no schema)', async () => {
  await request(app).post('/api/inscricoes').send(inscricaoValida({ cpf: 'dup' })).expect(201);
  await request(app).post('/api/inscricoes').send(inscricaoValida({ cpf: 'dup' })).expect(201);
});

const path = require('path');
const express = require('express');
const session = require('express-session');
const inscricaoService = require('./src/services/inscricaoService');
const authService = require('./src/services/authService');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'Não autenticado' });
  next();
}

function handleError(res, e) {
  if (e && e.status) {
    const body = e.erros ? { erros: e.erros } : { erros: [e.message] };
    return res.status(e.status).json(body);
  }
  console.error(e);
  return res.status(500).json({ erros: ['Erro interno.'] });
}

// ---------- Inscrição pública ----------

app.post('/api/inscricoes', async (req, res) => {
  try {
    const inscricao = await inscricaoService.criarPublica(req.body);
    res.status(201).json({ id: inscricao.id });
  } catch (e) { handleError(res, e); }
});

// ---------- Autenticação ----------

app.post('/api/auth/login', async (req, res) => {
  try {
    const admin = await authService.autenticar(req.body.username, req.body.password);
    req.session.adminId = admin.id;
    req.session.adminUser = admin.username;
    res.json({ ok: true, username: admin.username });
  } catch (e) {
    if (e.status === 401) return res.status(401).json({ error: e.message });
    handleError(res, e);
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, username: req.session.adminUser });
});

// ---------- Admin CRUD ----------

app.get('/api/admin/inscricoes', requireAuth, async (req, res) => {
  try {
    const busca = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const lista = await inscricaoService.listar(busca);
    res.json(lista);
  } catch (e) { handleError(res, e); }
});

app.get('/api/admin/inscricoes/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erros: ['ID inválido'] });
  try {
    const inscricao = await inscricaoService.obter(id);
    res.json(inscricao);
  } catch (e) { handleError(res, e); }
});

app.post('/api/admin/inscricoes', requireAuth, async (req, res) => {
  try {
    const inscricao = await inscricaoService.criarAdmin(req.body);
    res.status(201).json(inscricao);
  } catch (e) { handleError(res, e); }
});

app.put('/api/admin/inscricoes/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erros: ['ID inválido'] });
  try {
    const inscricao = await inscricaoService.atualizar(id, req.body);
    res.json(inscricao);
  } catch (e) { handleError(res, e); }
});

app.delete('/api/admin/inscricoes/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erros: ['ID inválido'] });
  try {
    await inscricaoService.remover(id);
    res.json({ ok: true });
  } catch (e) { handleError(res, e); }
});

// ---------- Estáticos ----------

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  if (!req.session.adminId) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

module.exports = app;

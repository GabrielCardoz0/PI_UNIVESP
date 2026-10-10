const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadEnv } = require('../../src/config/loadEnv');

test('carrega variáveis sem sobrescrever as existentes e ignora linhas inválidas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'T_A="valor a"\nT_B=b\n# comentario\nlixo\nT_C=original\n');
  process.env.T_C = 'existente';
  delete process.env.T_A; delete process.env.T_B;
  loadEnv(file);
  expect(process.env.T_A).toBe('valor a');
  expect(process.env.T_B).toBe('b');
  expect(process.env.T_C).toBe('existente');
  fs.rmSync(dir, { recursive: true });
});

test('arquivo inexistente é ignorado', () => {
  expect(() => loadEnv('/nao/existe/.env')).not.toThrow();
});

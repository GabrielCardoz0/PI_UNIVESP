const path = require('path');
const { loadEnv } = require('./src/config/loadEnv');

// Carrega .env sem depender de pacote externo (antes de carregar o app)
loadEnv(path.join(__dirname, '.env'));

const app = require('./app');

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

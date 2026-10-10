function inscricaoValida(overrides = {}) {
  return {
    nomeCompleto: 'Maria da Silva',
    comoPrefereChamada: 'Maria',
    email: 'Maria@Example.com',
    celular: '(11) 99999-9999',
    rg: '12.345.678-9',
    cpf: '123.456.789-09',
    dataNascimento: '1990-05-20',
    cep: '01001-000',
    logradouro: 'Praça da Sé',
    numero: '100',
    complemento: 'Apto 1',
    bairro: 'Sé',
    cidade: 'São Paulo',
    estado: 'sp',
    aceiteLgpd: true,
    aceiteMaiorIdade: true,
    aceiteImagem: false,
    ...overrides,
  };
}

module.exports = { inscricaoValida };

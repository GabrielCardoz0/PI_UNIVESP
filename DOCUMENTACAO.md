# Amecomex — Sistema de Inscrições

Aplicação Node.js que substitui o antigo formulário Google da **Associação de Mulheres Especialistas em Comércio Exterior (AMECOMEX)**. Cadastros públicos via formulário web e gerenciamento administrativo (CRUD) protegido por login.

---

## 1. Stack

| Camada     | Tecnologia                                          |
| ---------- | --------------------------------------------------- |
| Runtime    | Node.js (CommonJS, JS puro)                         |
| Servidor   | Express 4                                           |
| ORM        | Prisma 5                                            |
| Banco      | SQLite (arquivo `prisma/dev.db`)                    |
| Sessão     | express-session (cookie HTTP-only)                  |
| Hash senha | bcryptjs                                            |
| Frontend   | HTML/CSS/JS puro (sem build), design tokens shadcn  |
| Auto-fill  | API pública ViaCEP                                  |

---

## 2. Estrutura de pastas

```text
PI_UNIVESP/
├── prisma/
│   ├── schema.prisma          # modelos Inscricao e Admin
│   ├── seed.js                # cria o admin inicial
│   └── dev.db                 # banco SQLite (gerado)
├── public/                    # frontend estático
│   ├── index.html             # formulário público
│   ├── login.html             # login admin
│   ├── admin.html             # painel CRUD
│   ├── obrigado.html          # página de agradecimento
│   ├── styles.css             # tokens shadcn + componentes
│   ├── form.js                # lógica do formulário público
│   ├── login.js               # lógica de login
│   ├── admin.js               # lógica do painel
│   └── masks.js               # máscaras CPF/RG/tel/CEP + ViaCEP
├── src/
│   ├── repositories/          # acesso direto ao Prisma
│   │   ├── inscricaoRepository.js
│   │   └── adminRepository.js
│   └── services/              # validação e regras de negócio
│       ├── inscricaoService.js
│       └── authService.js
├── server.js                  # rotas Express + sessão
├── .env                       # banco, sessão, porta e credenciais do seed
├── package.json
├── README.md                  # instalação e início rápido
├── APRESENTACAO.md            # material de apoio para apresentação
└── DOCUMENTACAO.md            # este arquivo
```

Arquitetura em três camadas: **Rotas → Services → Repositories → Prisma → SQLite**. Cada camada só conhece a camada imediatamente abaixo.

---

## 3. Banco de dados

### 3.1 Diagrama

```
┌──────────────────────────────────────┐         ┌──────────────────────┐
│            Inscricao                 │         │        Admin         │
├──────────────────────────────────────┤         ├──────────────────────┤
│ id                Int  PK auto       │         │ id            Int PK │
│ nomeCompleto      String             │         │ username      String │
│ comoPrefereChamada String             │        │ passwordHash  String │
│ dataNascimento    DateTime           │         │ createdAt     DateTime│
│ email             String             │         └──────────────────────┘
│ celular           String             │
│ rg                String             │         (Sem relação por FK:
│ cpf               String             │          o Admin apenas opera
│ cep               String             │          sobre Inscricao via
│ logradouro        String             │          autenticação de sessão)
│ numero            String             │
│ complemento       String?  ← opcional│
│ bairro            String             │
│ cidade            String             │
│ estado            String  (UF)       │
│ aceiteLgpd        Bool   @default(false) │
│ aceiteMaiorIdade  Bool   @default(false) │
│ aceiteImagem      Bool   @default(false) │
│ createdAt         DateTime @default(now())│
│ updatedAt         DateTime @updatedAt │
└──────────────────────────────────────┘
```

### 3.2 Tabela `Inscricao`

Armazena cada cadastro feito pelo formulário público (ou inserido manualmente pelo admin).

| Campo                | Tipo         | Obrigatório | Observação                                                                 |
| -------------------- | ------------ | ----------- | -------------------------------------------------------------------------- |
| `id`                 | `Int`        | sim (PK)    | Auto-incremento.                                                            |
| `nomeCompleto`       | `String`     | sim         | Nome completo da inscrita.                                                  |
| `comoPrefereChamada` | `String`     | sim         | Nome social / apelido preferido.                                            |
| `dataNascimento`     | `DateTime`   | sim         | Recebido como `YYYY-MM-DD`; convertido para `Date` no service.              |
| `email`              | `String`     | sim         | Validado por regex. **Sem `@unique`** (decisão atual permite duplicatas).   |
| `celular`            | `String`     | sim         | Armazenado já formatado `(00) 00000-0000`.                                  |
| `rg`                 | `String`     | sim         | Armazenado formatado `00.000.000-X`.                                        |
| `cpf`                | `String`     | sim         | Armazenado formatado `000.000.000-00`. **Sem `@unique`**.                   |
| `cep`                | `String`     | sim         | Formato `00000-000`. Dispara busca ViaCEP no front.                         |
| `logradouro`         | `String`     | sim         | Preenchido pelo ViaCEP (editável).                                          |
| `numero`             | `String`     | sim         | Informado pela inscrita.                                                    |
| `complemento`        | `String?`    | não         | Apto, bloco, sala etc.                                                      |
| `bairro`             | `String`     | sim         | Preenchido pelo ViaCEP (editável).                                          |
| `cidade`             | `String`     | sim         | Preenchido pelo ViaCEP (editável).                                          |
| `estado`             | `String`     | sim         | UF (2 letras), validada contra `ESTADOS_VALIDOS` (`EX` para fora do Brasil).|
| `aceiteLgpd`         | `Boolean`    | sim         | Obrigatório `true` para envio público.                                      |
| `aceiteMaiorIdade`   | `Boolean`    | sim         | Obrigatório `true` para envio público.                                      |
| `aceiteImagem`       | `Boolean`    | não         | Opcional. `false` se não marcado.                                           |
| `createdAt`          | `DateTime`   | auto        | Preenchido por `@default(now())`.                                           |
| `updatedAt`          | `DateTime`   | auto        | Atualizado a cada `update` via `@updatedAt`.                                |

### 3.3 Tabela `Admin`

Usuários com acesso ao painel.

| Campo          | Tipo       | Obrigatório | Observação                                          |
| -------------- | ---------- | ----------- | --------------------------------------------------- |
| `id`           | `Int`      | sim (PK)    | Auto-incremento.                                    |
| `username`     | `String`   | sim         | `@unique` — não pode haver dois admins iguais.      |
| `passwordHash` | `String`   | sim         | Hash bcrypt (cost 10).                              |
| `createdAt`    | `DateTime` | auto        | `@default(now())`.                                  |

### 3.4 Relação entre as tabelas

**Não há foreign key entre `Admin` e `Inscricao`.** São tabelas independentes:

- `Inscricao` guarda os cadastros do público.
- `Admin` guarda credenciais usadas para autorizar operações de CRUD sobre `Inscricao` via cookie de sessão.

Caso futuramente seja necessário rastrear *qual* admin editou cada inscrição, basta adicionar `editadoPorId Int?` em `Inscricao` referenciando `Admin.id` — mas hoje isso não é requisito.

---

## 4. Camada de rotas (`server.js`)

### 4.1 Middlewares globais

| Função / config            | O que faz                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Carga manual de `.env`     | Lê o arquivo `.env` linha a linha sem depender de `dotenv` (zero abstração).                    |
| `express.json()`           | Parse de JSON do body, limite de 1 MB.                                                          |
| `express.urlencoded()`     | Parse de form-urlencoded.                                                                       |
| `express-session`          | Sessão em cookie HTTP-only, `sameSite: 'lax'`, expira em 8 horas.                               |
| `express.static('public')` | Serve os HTML/CSS/JS do `public/`.                                                              |

Como nenhum `store` externo foi configurado, `express-session` usa o `MemoryStore` padrão. Isso atende ao desenvolvimento local, mas não deve ser usado em produção: as sessões são perdidas ao reiniciar o processo e o armazenamento não foi projetado para múltiplas instâncias.

### 4.2 Helpers locais

| Helper            | Finalidade                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `requireAuth`     | Middleware que rejeita com 401 quando `req.session.adminId` não está setado.                                        |
| `handleError`     | Tradutor de erros de service para resposta HTTP. Usa `e.status` e `e.erros` lançados pelos services; 500 no resto.  |

### 4.3 Endpoints

#### Público

| Método | Rota              | Body                                | Respostas                                                                | Função no service                  |
| ------ | ----------------- | ----------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| POST   | `/api/inscricoes` | Payload completo + aceites          | `201 { id }` · `400 { erros }`                                            | `inscricaoService.criarPublica`    |

Validações obrigatórias na criação pública: todos os campos textuais, `dataNascimento`, `email` válido, `estado` em `ESTADOS_VALIDOS`, `aceiteLgpd` e `aceiteMaiorIdade` ambos `true`.

#### Autenticação

| Método | Rota                  | Body                              | Respostas                                | Função no service        |
| ------ | --------------------- | --------------------------------- | ---------------------------------------- | ------------------------ |
| POST   | `/api/auth/login`     | `{ username, password }`          | `200 { ok, username }` · `401`            | `authService.autenticar` |
| POST   | `/api/auth/logout`    | —                                 | `200 { ok }` (destrói sessão)             | —                        |
| GET    | `/api/auth/me`        | —                                 | `200 { authenticated, username }` · `401` | —                        |

#### Admin CRUD (protegidas por `requireAuth`)

| Método | Rota                            | Body                | Respostas                                                  | Função no service                                |
| ------ | ------------------------------- | ------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| GET    | `/api/admin/inscricoes?q=...`   | —                   | `200 [inscricao]`                                          | `inscricaoService.listar(busca)`                 |
| GET    | `/api/admin/inscricoes/:id`     | —                   | `200 inscricao` · `404`                                    | `inscricaoService.obter(id)`                     |
| POST   | `/api/admin/inscricoes`         | Payload (sem aceites)| `201 inscricao` · `400`                                    | `inscricaoService.criarAdmin`                    |
| PUT    | `/api/admin/inscricoes/:id`     | Payload (sem aceites)| `200 inscricao` · `400` · `404`                            | `inscricaoService.atualizar`                     |
| DELETE | `/api/admin/inscricoes/:id`     | —                   | `200 { ok }` · `404`                                       | `inscricaoService.remover`                       |

Nas operações admin **não** se enviam `aceiteLgpd/aceiteMaiorIdade/aceiteImagem` no body — o service só atualiza esses campos se chegarem no payload, então o consentimento original do cliente fica preservado em updates.

#### Rotas estáticas

- `GET /admin` → redireciona para `/login.html` se não autenticado; senão serve `admin.html`.
- `GET /` → serve `public/index.html` (formulário público).
- `GET /obrigado.html` → página de confirmação após envio.

---

## 5. Camada de services

### 5.1 `inscricaoService.js`

| Função                  | Descrição                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizar(data, opts)` | Sanitiza strings (`trim`+`slice`), valida formato de e-mail, valida UF, converte `dataNascimento` para `Date`. Acumula erros e lança `ValidationError` se algum existir. Inclui aceites no resultado **apenas se** estiverem presentes em `data` (preservando-os em updates do admin). |
| `criarPublica(payload)` | Valida com `exigirAceites: true`; chama `repo.criar`. Erros do Prisma são traduzidos por `tratarErroPrisma`.                                |
| `criarAdmin(payload)`   | Igual ao anterior mas com `exigirAceites: false`.                                                                                            |
| `atualizar(id, payload)`| Valida com `exigirAceites: false`; chama `repo.atualizar`.                                                                                  |
| `obter(id)`             | Busca pelo PK; lança `NotFoundError` se inexistente.                                                                                         |
| `listar(busca)`         | Lista ordenada por `createdAt desc`, com filtro `OR` (nome, e-mail, CPF, cidade).                                                            |
| `remover(id)`           | Deleta; lança `NotFoundError` se id não existir.                                                                                             |
| `tratarErroPrisma(e)`   | Traduz `P2002` em `ConflictError 409` e `P2025` em `NotFoundError 404`.                                                                      |

Classes de erro: `ValidationError(status=400)`, `ConflictError(status=409)`, `NotFoundError(status=404)`. Cada uma carrega `erros[]` ou `message`.

### 5.2 `authService.js`

| Função                          | Descrição                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `autenticar(username, password)`| Busca admin via repository; compara senha com `bcrypt.compare`; retorna `{ id, username }` ou lança `AuthError(401)`. |

---

## 6. Camada de repositories (acesso direto ao Prisma)

### 6.1 `inscricaoRepository.js`

| Função                  | Equivale a                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `listar({ busca })`     | `prisma.inscricao.findMany` com `OR` em 4 campos quando `busca` não vazia.                 |
| `buscarPorId(id)`       | `prisma.inscricao.findUnique({ where: { id } })`                                           |
| `criar(dados)`          | `prisma.inscricao.create({ data: dados })`                                                 |
| `atualizar(id, dados)`  | `prisma.inscricao.update({ where: { id }, data: dados })`                                  |
| `remover(id)`           | `prisma.inscricao.delete({ where: { id } })`                                               |

### 6.2 `adminRepository.js`

| Função                       | Equivale a                                                                  |
| ---------------------------- | --------------------------------------------------------------------------- |
| `buscarPorUsername(username)`| `prisma.admin.findUnique({ where: { username } })`                          |
| `criar({ username, passwordHash })` | `prisma.admin.create({ data: { username, passwordHash } })`          |

---

## 7. Frontend

### 7.1 Páginas

| Página           | Rota             | Função                                                       |
| ---------------- | ---------------- | ------------------------------------------------------------ |
| `index.html`     | `/`              | Formulário público com todos os campos do antigo Google Form. |
| `obrigado.html`  | `/obrigado.html` | Confirmação visual após envio (redirecionada via `form.js`). |
| `login.html`     | `/login.html`    | Login admin.                                                  |
| `admin.html`     | `/admin`         | Lista + CRUD em diálogo nativo.                               |

### 7.2 Scripts

| Arquivo       | Funções principais |
| ------------- | ------------------ |
| `masks.js`    | Formata CPF, RG, telefone e CEP; consulta o ViaCEP; anuncia o estado da consulta; preenche o endereço sem deslocar o foco. |
| `form.js`     | Valida o formulário público, relaciona erros aos campos, move o foco para o primeiro inválido, envia `POST /api/inscricoes` e redireciona em sucesso. |
| `login.js`    | Envia credenciais para `POST /api/auth/login`, comunica erro/carregamento e redireciona para `/admin` em sucesso. |
| `admin.js`    | Verifica sessão, busca e renderiza registros, constrói a tabela semântica, controla o diálogo nativo e executa o CRUD administrativo. |

### 7.3 Integração ViaCEP

Em `masks.js`, `attachCepLookup(form)` ouve `blur` e `input` do campo `cep`. Quando há 8 dígitos, faz `GET https://viacep.com.br/ws/{cep}/json/` e preenche `logradouro`, `bairro`, `cidade` e `estado`.

O estado da consulta é publicado em uma região `role="status"`: consultando, endereço encontrado, CEP inexistente ou falha de conexão. Em qualquer falha, os campos continuam editáveis para preenchimento manual. O preenchimento automático dispara eventos `input` e `change`, permitindo que erros antigos sejam removidos, e não muda o foco de forma inesperada.

### 7.4 Design

CSS aplica tokens HSL no padrão **shadcn/ui** (`--background`, `--foreground`, `--primary`, `--ring`, etc.), raio padrão `0.5rem`, indicador de foco sólido, diálogo com `backdrop-filter: blur(4px)`, reflow responsivo e suporte a `prefers-reduced-motion`. Não há framework ou etapa de build; a fonte Inter é carregada pelo Google Fonts, com fallback para fontes do sistema.

---

### 7.5 Envio de e-mail

O sistema **não envia e-mails atualmente**. O endereço informado é validado e armazenado junto à inscrição, e a página `obrigado.html` apenas comunica que a associação poderá entrar em contato posteriormente.

Não há Nodemailer, servidor SMTP, API transacional ou fila de envio configurada. Uma implementação futura precisaria ser adicionada ao backend depois da criação bem-sucedida da inscrição, com tratamento de falhas que não provoque perda do cadastro.

---

## 8. Acessibilidade

As melhorias de acessibilidade estão concentradas na camada de interface. O backend, as regras de negócio, o schema Prisma e os contratos de API permaneceram inalterados.

A estratégia de implementação segue esta prioridade:

1. HTML nativo e semântico;
2. CSS para foco, contraste, legibilidade e reflow;
3. JavaScript para mensagens dinâmicas e gerenciamento previsível do foco;
4. ARIA apenas quando o HTML nativo não comunica sozinho um estado dinâmico.

### 8.1 Estrutura e nomes acessíveis

- todas as páginas possuem `header`, `nav` e `main`;
- um link “Ir para o conteúdo principal” permite ignorar o cabeçalho repetido;
- todos os campos visíveis possuem `<label for="...">` associado a um `id`;
- placeholders são apenas exemplos e não substituem os labels;
- campos obrigatórios mantêm `required` e indicação visual por asterisco;
- os consentimentos públicos são agrupados por `<fieldset>` e `<legend>`;
- elementos decorativos da marca e SVGs sem conteúdo informativo usam `aria-hidden="true"`;
- a hierarquia de títulos parte de um `h1` por página e usa níveis subordinados para diálogo e estados vazios.

### 8.2 Validação e mensagens

Os formulários público e administrativo usam validação controlada pelo JavaScript para apresentar mensagens consistentes com os erros do backend.

Fluxo de uma tentativa inválida:

```text
Envio do formulário
        ↓
Validação dos controles nativos
        ↓
Mensagem específica ao lado de cada campo
        ↓
aria-invalid="true" no controle
        ↓
aria-describedby liga controle e mensagem
        ↓
Foco no primeiro campo inválido
```

Erros urgentes usam `role="alert"`; sucesso, carregamento, quantidade de resultados e consulta de CEP usam `role="status"`. Durante requisições, formulário e botão recebem `aria-busy`, o texto do botão muda e envios repetidos são temporariamente bloqueados.

O botão público permanece alcançável antes dos consentimentos. Assim, uma pessoa que navega por teclado pode tentar enviar e receber uma explicação específica, em vez de encontrar um botão desabilitado e sem feedback.

As mensagens retornadas pela API são interpretadas no frontend e associadas aos campos correspondentes. Essa opção preserva o formato atual das respostas e evita alteração desnecessária dos contratos do backend.

### 8.3 Teclado e foco

- não há `tabindex` positivo;
- links e botões usam elementos HTML nativos;
- todos os controles interativos têm indicador de foco sólido de 3 px;
- `scroll-margin-top` evita que o cabeçalho fixo esconda um elemento focado;
- a ordem de tabulação segue a ordem lógica do DOM;
- erros movem o foco para um destino previsível;
- a preferência `prefers-reduced-motion` reduz animações e rolagem suave.

### 8.4 Diálogo administrativo

O formulário de criação e edição usa `<dialog>` aberto por `showModal()`. O próprio navegador fornece a semântica modal, coloca o diálogo na top layer e impede a interação com o conteúdo de fundo.

Comportamentos implementados:

- `aria-labelledby` associa o diálogo ao título;
- `aria-describedby` associa as instruções;
- o foco inicial vai para o campo Nome Completo;
- Tab e Shift+Tab permanecem no contexto modal;
- Escape fecha o diálogo;
- Cancelar e clique fora também fecham;
- ao fechar, o foco retorna ao elemento que abriu o diálogo.

Foi preferido `<dialog>` a uma `div` com `role="dialog"`, pois a alternativa exigiria implementar manualmente isolamento do fundo e contenção de foco.

### 8.5 Busca e tabela administrativa

- a busca possui label visualmente oculto e não depende do placeholder;
- a quantidade de resultados é uma região de status;
- a listagem usa `<table>` com `<caption>`;
- cabeçalhos de coluna usam `scope="col"`;
- o nome da inscrita é o cabeçalho da linha com `scope="row"`;
- a coluna final possui o título “Ações”;
- botões repetidos incluem o registro no nome acessível, por exemplo “Editar inscrição de Maria”;
- a tabela fica em uma região rolável por teclado quando não cabe na largura disponível.

### 8.6 Contraste, zoom e reflow

- cores de erro e sucesso foram escurecidas para manter contraste em fundo claro;
- placeholders e textos secundários mantêm contraste de texto AA;
- bordas necessárias para identificar campos foram reforçadas;
- campos e botões usam altura mínima, permitindo crescimento quando o texto aumenta;
- linhas com duas colunas passam para uma coluna em telas estreitas;
- o diálogo respeita a altura da viewport e mantém o corpo rolável;
- a tabela preserva os dados por rolagem horizontal, em vez de cortar colunas.

Contrastes medidos durante a validação:

| Elemento | Relação de contraste |
| -------- | -------------------- |
| Texto principal em fundo branco | 19,9:1 |
| Texto secundário e placeholder | 4,83:1 |
| Texto de erro | 6,48:1 |

### 8.7 Critérios WCAG 2.2 relacionados

| Critério | Aplicação no projeto |
| -------- | -------------------- |
| 1.3.1 — Informações e relações | Labels, fieldset, títulos e tabela semântica. |
| 1.4.3 — Contraste mínimo | Textos, placeholders e erros revisados. |
| 1.4.10 — Reflow | Formulário e diálogo responsivos. |
| 2.1.1 — Teclado | Controles e diálogo operáveis sem mouse. |
| 2.4.1 — Ignorar blocos | Link para o conteúdo principal. |
| 2.4.3 — Ordem do foco | Ordem lógica e foco previsível após erros. |
| 2.4.7 — Foco visível | Indicador consistente em todos os controles. |
| 3.3.1 — Identificação de erros | Mensagem textual e estado inválido. |
| 3.3.2 — Labels ou instruções | Labels persistentes e indicação de obrigatoriedade. |
| 4.1.2 — Nome, função e valor | Controles nomeados e diálogo nativo. |
| 4.1.3 — Mensagens de status | Erros, sucesso, busca, carregamento e CEP anunciados. |

### 8.8 Alternativas não adotadas

| Alternativa | Motivo para não aplicar |
| ----------- | ----------------------- |
| Overlay ou barra de acessibilidade | Não corrige a semântica e pode conflitar com tecnologias assistivas. |
| Biblioteca de componentes | HTML nativo já atende aos controles existentes, sem adicionar dependências. |
| Reescrita em outro framework | Os problemas eram locais e corrigíveis na stack atual. |
| Focus trap completo em JavaScript | O `<dialog>` nativo já oferece o comportamento modal necessário. |
| Mudança dos erros da API | A interface consegue associar as respostas atuais aos campos sem quebrar contratos. |

---

## 9. Como executar

### 9.1 Pré-requisitos

- Node.js 20 ou superior recomendado;
- npm;
- acesso à internet para instalar dependências, carregar a fonte e consultar o ViaCEP.

### 9.2 Instalação e configuração

```bash
# 1. instala exatamente as versões do package-lock.json
npm ci

# 2. gera o Prisma Client
npm run db:generate

# 3. sincroniza o schema e cria o banco SQLite
npm run db:push

# 4. cria o administrador inicial
npm run seed

# 5. sobe o servidor
npm start
```

Para desenvolvimento com reinício automático do servidor:

```bash
npm run dev
```

Acesso:

- Público: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin` (login em `/login.html`)
- LAN (celular na mesma WiFi): `http://<IP-do-notebook>:3000`

Variáveis em `.env`:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="troque-este-segredo-em-producao"
PORT=3000
ADMIN_USER="admin"
ADMIN_PASS="troque-esta-senha"
```

`DATABASE_URL` é necessária para o Prisma. Se `ADMIN_USER` e `ADMIN_PASS` forem omitidas, o seed usa `admin` e `admin123`.

O seed cria o administrador somente quando o username ainda não existe. Alterar `ADMIN_PASS` e executar o seed novamente não troca a senha de um registro existente.

O arquivo `.env`, o banco `prisma/dev.db` e seu journal estão no `.gitignore` e não devem ser versionados.

### 9.3 Scripts disponíveis

| Comando | Finalidade |
| ------- | ---------- |
| `npm start` | Inicia o servidor. |
| `npm run dev` | Inicia com `node --watch`. |
| `npm run db:generate` | Gera o Prisma Client. |
| `npm run db:push` | Sincroniza o schema com o banco. |
| `npm run seed` | Cria o administrador inicial. |

---

## 10. Validação e testes

O projeto ainda não possui scripts automatizados de teste, lint ou auditoria de acessibilidade. A validação da implementação atual incluiu:

- análise sintática dos quatro scripts do frontend com `node --check`;
- busca estática por campos sem labels, IDs ausentes, `tabindex` positivo e elementos não semânticos simulando botões;
- inspeção da árvore de acessibilidade das quatro páginas;
- envio inválido do formulário público, com foco e mensagens associados;
- login, busca e CRUD administrativo com dados sintéticos;
- abertura do diálogo, foco inicial, Escape e retorno do foco;
- reflow em viewport de 320 × 640 pixels;
- medição de contraste dos textos principais, secundários e de erro;
- inspeção do console do navegador sem erros ou warnings.

Verificação sintática reproduzível:

```bash
node --check public/form.js
node --check public/login.js
node --check public/admin.js
node --check public/masks.js
```

Roteiro manual recomendado após mudanças:

1. percorrer o formulário com Tab e Shift+Tab;
2. enviar com campos vazios e confirmar o foco no primeiro erro;
3. corrigir um campo e verificar a remoção do estado inválido;
4. testar consulta de CEP e preenchimento manual após falha;
5. abrir o diálogo administrativo, navegar dentro dele e fechar com Escape;
6. confirmar o retorno do foco ao botão de origem;
7. usar a busca e verificar o anúncio da quantidade de resultados;
8. testar zoom real de 200%, aumento do texto e modo de alto contraste;
9. realizar ao menos uma rodada com NVDA, JAWS, VoiceOver ou TalkBack.

---

## 11. Roadmap

Sugestões priorizadas para próximas iterações:

### Curto prazo (uma sessão de trabalho cada)

- **Validação de CPF no backend** com algoritmo de dígito verificador (atualmente só formata, não valida).
- **Trocar senha do admin pela UI** (rota `PUT /api/auth/password`).
- **Re-aplicar `@unique` em `email` e `cpf`** se a regra do negócio confirmar que duplicatas devem ser bloqueadas.
- **Paginação** em `GET /api/admin/inscricoes` (`?page=&pageSize=`).
- **Testes automatizados de acessibilidade** no fluxo público e administrativo.

### Médio prazo

- **Exportação CSV** das inscrições filtradas (botão no admin).
- **E-mail de confirmação automático** para a inscrita após cadastro (Nodemailer + SMTP).
- **Filtros avançados**: por estado, por intervalo de datas, por status de aceite de imagem.
- **Auditoria**: adicionar `editadoPorId` em `Inscricao` referenciando `Admin.id`, registrando quem alterou.
- **Rate limiting** em `/api/inscricoes` (`express-rate-limit`) para mitigar spam.
- **Testes**: Jest + Supertest cobrindo os services e endpoints.

### Longo prazo

- **Migração SQLite → PostgreSQL** para produção (basta trocar o `provider` no `schema.prisma` e `DATABASE_URL`).
- **Deploy** com HTTPS (Nginx + Let's Encrypt, ou hospedagem PaaS).
- **Soft delete** em `Inscricao` (`deletedAt DateTime?`) para preservar histórico.
- **Recuperação de senha do admin** por e-mail.
- **Dashboard** com estatísticas (total por estado, evolução mensal).
- **Multi-admin com papéis** (super-admin x admin de leitura).

---

## 12. Decisões de arquitetura

- **Sem build do frontend**: HTML/CSS/JS puro entregue por `express.static`. Reduz fricção para um projeto pequeno.
- **Três camadas no backend**: rotas finas em `server.js`, regras em services, acesso a dados em repositories. Trocar Prisma por outro ORM exige tocar só nos repositories.
- **`.env` carregado manualmente** em `server.js` e `seed.js` para não exigir `dotenv` como dependência.
- **Senha do admin via bcrypt** com cost 10 — equilíbrio entre segurança e velocidade.
- **Aceites preservados em update**: o service só sobrescreve `aceiteLgpd/aceiteMaiorIdade/aceiteImagem` se eles vierem no payload; o admin não os envia, garantindo que o consentimento original do cliente nunca seja alterado pelo painel.
- **Acessibilidade sem biblioteca adicional**: elementos semânticos nativos, CSS e JavaScript existente cobrem os requisitos sem overlay ou framework de componentes.
- **Diálogo nativo**: `<dialog>` com `showModal()` reduz código manual de foco e mantém o comportamento esperado de teclado.
- **Contratos do backend preservados**: mensagens existentes da API são associadas aos campos no frontend, evitando mudanças incompatíveis.

## Testes automatizados

- `npm test` executa a suíte (Jest + Supertest); `npm run test:cov` gera o relatório de cobertura (mínimo de 90% imposto em `jest.config.js`).
- `tests/unit`: serviços, repositórios e loader de `.env` (dependências mockadas).
- `tests/api`: rotas Express via Supertest (serviços mockados).
- `tests/integration`: fluxo completo com SQLite real em `prisma/test.db` (recriado a cada execução, ignorado pelo git).
- `app.js` exporta o app Express; `server.js` apenas carrega o `.env` e chama `listen`.

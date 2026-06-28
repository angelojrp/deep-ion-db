# Deep Ion DB

IDE relacional **fortemente orientada a DBAs e Administradores de Dados**, com **integração nativa a ferramentas de IA** (Claude, OpenAI Codex, Gemini e modelos locais). Construída com **Electron + React + TypeScript**.

> Conecte-se a **PostgreSQL, MySQL/MariaDB, SQLite, SQL Server e Oracle**, escreva SQL num editor de nível VS Code, administre o servidor (sessões, EXPLAIN, DDL, backup, ER) e peça ajuda à **IA** — tudo no desktop ou na **web empresarial** com SSO e acesso gerenciado.

## Por que Deep Ion DB?

- 🧠 **IA de verdade no fluxo do DBA** — NL→SQL com contexto do schema, explicação e otimização de queries, diagnóstico de performance e um chat que conhece o seu banco. Use Claude, OpenAI, Gemini ou **modelos locais** (sem mandar dados para a nuvem).
- 🗄️ **Multi-banco, uma só ferramenta** — o mesmo editor, grade e explorador para 5 dialetos, com paridade de recursos.
- 🛠️ **Toolkit de administração** — Database Explorer multi-conexão, geração de DDL, planos `EXPLAIN`, monitor de sessões, dashboard de saúde, backup/restore, diff de schemas e diagrama ER.
- 🌐 **Desktop e web empresarial** — a mesma UI roda como app desktop ou como web app com **SSO (OIDC)**, **RBAC**, **conexões proxied** (o usuário nunca vê host/senha), **auditoria** e painel de administração.
- 🤖 **Servidor MCP** — exponha o banco (somente-leitura) a agentes como o Claude Code.
- 🔒 **Seguro por padrão** — Electron com `contextIsolation` + `sandbox`, segredos no cofre, SQL parametrizado nos metadados.

## Capturas de tela

> 📸 _As imagens das telas principais ficam em [`docs/img/`](docs/img/). Veja o guia de captura em [`docs/img/README.md`](docs/img/README.md)._

| Editor + resultados | Database Explorer | Assistente de IA | Admin web (SSO) |
| --- | --- | --- | --- |
| _em breve_ | _em breve_ | _em breve_ | _em breve_ |

## Download (versão desktop)

Baixe o instalador da sua plataforma na página de **[Releases](https://github.com/angelojrp/deep-ion-db/releases/latest)**:

| Plataforma | Arquivo |
| --- | --- |
| Windows | `Deep Ion DB-<versão>-Windows-x64-setup.exe` |
| macOS | `Deep Ion DB-<versão>-macOS-<arch>.dmg` |
| Linux | `Deep Ion DB-<versão>-Linux-x86_64.AppImage` ou `.deb` |

> Os builds ainda não são assinados, então o Windows (SmartScreen) e o macOS (Gatekeeper) podem exibir um aviso na primeira execução.

## Primeiros passos (em ~5 minutos)

1. **Instale** o app a partir da [Release](https://github.com/angelojrp/deep-ion-db/releases/latest) da sua plataforma e abra-o.
2. **Crie uma conexão** — escolha o banco (PostgreSQL, MySQL/MariaDB, SQLite, SQL Server ou Oracle), informe host/porta/credenciais (ou o caminho do arquivo, no SQLite) e teste. A conexão fica salva com a senha protegida pelo cofre do sistema operacional.
3. **Explore o banco** — navegue por tabelas e colunas na lateral; clicar gera um `SELECT * … LIMIT 100`.
4. **Execute SQL** — escreva no editor Monaco (autocomplete ciente do schema) e rode com **Ctrl/Cmd + Enter**. Os resultados aparecem na grade, com contagem de linhas, tempo de execução e export CSV/JSON.
5. **Use a IA** _(opcional)_ — em **Configurações de IA**, informe a chave do provedor (Claude/OpenAI/Gemini) ou aponte para um modelo local. Depois peça uma query em linguagem natural, explique ou otimize a query atual, ou converse com o assistente que conhece o seu schema.

> Prefere não instalar nada por usuário? Há também a **[versão web empresarial](#versão-web-empresarial)** com SSO e acesso gerenciado aos bancos.

## Recursos

**Editor e produtividade**
- Conexão a **PostgreSQL**, **MySQL/MariaDB**, **SQLite**, **SQL Server** e **Oracle**
- Editor SQL com **Monaco** (mesmo editor do VS Code) — autocomplete ciente do schema, formatação (pretty-print) e Ctrl/Cmd + Enter para executar
- Executar seleção e suporte a múltiplos result sets
- Grade de resultados (**TanStack Table**) com contagem de linhas, tempo de execução, edição inline (CRUD) e export CSV/JSON/Excel
- Múltiplas conexões e abas simultâneas, histórico de queries e favoritos
- Workspace de queries no diretório local e editor/visualizador de **Markdown**

**Toolkit de DBA**
- **Database Explorer** multi-conexão (estilo DataGrip) com explorador de objetos
- Geração de **DDL** (CREATE/ALTER), planos de execução (**EXPLAIN**), diagrama **ER** e diff de schemas
- Monitor de **sessões** ativas, **dashboard de saúde** do servidor, gestão de usuários/roles, **backup/restore**, importação em massa e agendador de jobs

**Inteligência Artificial** (Claude · OpenAI · Gemini · modelos locais)
- **NL→SQL** com contexto do schema, **explicação** e **otimização** de queries
- **Diagnóstico** de performance, **documentação automática** do schema e geração de dados de seed
- **Chat DBA** com contexto do banco e **servidor MCP** somente-leitura para agentes

**Plataforma**
- Versão **web empresarial** com SSO (OIDC), RBAC, conexões proxied, auditoria e painel admin
- Auto-update, temas/preferências e instaladores assinados (Windows/macOS/Linux)
- Arquitetura segura do Electron: `contextIsolation`, `sandbox`, sem `nodeIntegration`

## Versão web empresarial

Além do app desktop, há uma **versão web** com SSO (OIDC), data sources gerenciados, grants de acesso, auditoria e painel de administração — épico [#53](https://github.com/angelojrp/deep-ion-db/issues/53).

A web **reaproveita a mesma UI do desktop**: uma única base React recebe a camada de acesso por injeção (`window.api` no Electron, cliente HTTP no web) e ajusta os recursos por **capabilities**.

Para subir o ambiente via **Docker Compose**:

```bash
docker compose up -d && curl http://localhost:4000/health
```

Veja **[docs/DEPLOY.md](docs/DEPLOY.md)** para configuração completa (OIDC, banco de metadados, cofre de segredos).

## Servidor MCP (expor o banco a agentes de IA)

Há um servidor **MCP** (Model Context Protocol) **somente-leitura** que expõe um PostgreSQL a agentes como o Claude Code (tools: `list_tables`, `list_columns`, `query`).

```bash
npm run mcp:server   # stdio; configure as variáveis DEEPION_DB_*
```

Configuração no Claude Code (`mcpServers`):

```json
{
  "mcpServers": {
    "deep-ion-db": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "env": {
        "DEEPION_DB_HOST": "localhost",
        "DEEPION_DB_PORT": "5432",
        "DEEPION_DB_USER": "postgres",
        "DEEPION_DB_PASSWORD": "...",
        "DEEPION_DB_NAME": "app"
      }
    }
  }
}
```

## Arquitetura

```
src/
  main/              # processo principal do Electron
    db/
      drivers/       # postgres.ts, mysql.ts, sqlite.ts, mssql.ts, oracle.ts
      manager.ts     # roteia operações para o driver da conexão
      types.ts       # interface Driver
    ipc.ts           # handlers ipcMain (db:connect, db:query, ...)
    index.ts         # criação da janela
  preload/           # contextBridge -> window.api.db.*
  shared/            # tipos compartilhados (ConnectionConfig, QueryResult, ...)
  renderer/          # UI em React
    src/
      components/    # Sidebar, SqlEditor, ResultsGrid, ...
      App.tsx
server/              # backend web (Fastify)
  src/
    auth.ts          # OIDC/JWT
    dataSources.ts   # data sources gerenciados
    grants.ts        # concessões de acesso
    audit.ts         # log de auditoria
    users.ts         # gestão de usuários
web/                 # entrada React do modo web
```

Cada driver implementa a interface `Driver` (`connect`, `disconnect`, `query`, `listTables`, `listColumns`), o que torna simples adicionar novos bancos.

## Requisitos

- **Node.js 20+** (recomendado via nvm)
- Toolchain de build nativo para o `better-sqlite3` (`make`, `g++`/`gcc`, `python3`)

## Como rodar

```bash
npm install
npm run rebuild   # recompila o better-sqlite3 para o ABI do Electron
npm run dev       # inicia em modo desenvolvimento
```

> No WSL2, a janela aparece via WSLg (suporte gráfico nativo do WSL).

### Build de produção

```bash
npm run build
npm run start
```

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Modo desenvolvimento com HMR |
| `npm run build` | Compila main/preload/renderer para `out/` |
| `npm run start` | Roda o build de produção |
| `npm run rebuild` | Recompila o `better-sqlite3` para o Electron |
| `npm run typecheck` | Checagem de tipos (node + web + server + webapp) |
| `npm run quality` | typecheck + lint + format:check |
| `npm test` | Executa a suite de testes (Vitest) |
| `npm run server:dev` | Inicia o backend web em modo desenvolvimento |
| `npm run web:build` | Compila o frontend web para `web/public/` |

## Roadmap

O planejamento completo, priorizado por épico, está em **[ROADMAP.md](ROADMAP.md)** e nas [issues](https://github.com/angelojrp/deep-ion-db/issues).

## Colaboração e feedback

Sugestões, bugs e dúvidas são bem-vindos! Há duas formas de contribuir:

### Pelo próprio app

A UI tem um botão **Feedback** na barra de abas (canto superior direito). Ele abre um formulário com tipo (melhoria / bug / pergunta), título e descrição, e pré-preenche uma issue no GitHub para você revisar e enviar — sem precisar criar nada manualmente.

### Diretamente no GitHub

Abra uma issue em [github.com/angelojrp/deep-ion-db/issues](https://github.com/angelojrp/deep-ion-db/issues). Use os labels:

| Label | Quando usar |
| --- | --- |
| `enhancement` | Sugestão de nova funcionalidade ou melhoria |
| `bug` | Comportamento incorreto ou inesperado |
| `question` | Dúvida sobre uso ou arquitetura |

### Fluxo de branches

```
main        ← produção (apenas merges de release com tag vX.Y.Z)
develop     ← integração; base das features
feature/*   ← uma feature/issue; PR para develop
fix/*       ← correções; PR para develop
```

PRs devem seguir **Conventional Commits** (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`…) e referenciar a issue no rodapé (`Closes #N`).

## Licença

MIT

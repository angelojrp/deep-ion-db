# Deep Ion DB

IDE relacional **fortemente orientada a DBAs e Administradores de Dados**, com **integração nativa a ferramentas de IA** (Claude, OpenAI Codex, Gemini e modelos locais). Construída com **Electron + React + TypeScript**.

## Download (versão desktop)

Baixe o instalador da sua plataforma na página de **[Releases](https://github.com/angelojrp/deep-ion-db/releases/latest)**:

| Plataforma | Arquivo |
| --- | --- |
| Windows | `Deep Ion DB-<versão>-Windows-x64-setup.exe` |
| macOS | `Deep Ion DB-<versão>-macOS-<arch>.dmg` |
| Linux | `Deep Ion DB-<versão>-Linux-x86_64.AppImage` ou `.deb` |

> Os builds ainda não são assinados, então o Windows (SmartScreen) e o macOS (Gatekeeper) podem exibir um aviso na primeira execução.

## Recursos

- Conexão a **PostgreSQL**, **MySQL/MariaDB**, **SQLite**, **SQL Server** e **Oracle**
- Editor SQL com **Monaco** (mesmo editor do VS Code) — autocomplete ciente do schema, formatação, Ctrl/Cmd + Enter para executar
- Grade de resultados (**TanStack Table**) com contagem de linhas, tempo de execução e export CSV/JSON
- Navegador de tabelas e colunas na lateral — clique gera `SELECT * … LIMIT 100`
- Múltiplas conexões e abas simultâneas
- Histórico de queries e favoritos
- Integração com **IA** (Claude, Codex, Gemini, modelos locais) — NL→SQL, assistente com contexto do banco
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

# Deep Ion DB

IDE para bancos de dados relacionais (estilo DBeaver), construída com **Electron + React + TypeScript**.

Esta é a primeira versão utilizável (`0.1.0`): conectar a um banco, escrever SQL com destaque de sintaxe e ver os resultados em grade.

## Download (versão desktop)

Baixe o instalador da sua plataforma na página de **[Releases](https://github.com/angelojrp/deep-ion-db/releases/latest)**:

| Plataforma | Arquivo |
| --- | --- |
| Windows | `Deep Ion DB-<versão>-Windows-x64-setup.exe` |
| macOS | `Deep Ion DB-<versão>-macOS-<arch>.dmg` |
| Linux | `Deep Ion DB-<versão>-Linux-x86_64.AppImage` ou `.deb` |

> Os builds ainda não são assinados, então o Windows (SmartScreen) e o macOS (Gatekeeper) podem exibir um aviso na primeira execução — é normal nesta fase.

## Recursos

- Conexão a **PostgreSQL**, **MySQL/MariaDB**, **SQLite**, **SQL Server** e **Oracle**
- Editor SQL com **Monaco** (mesmo editor do VS Code), atalho **Ctrl/Cmd + Enter** para executar
- Grade de resultados (**TanStack Table**) com contagem de linhas e tempo de execução
- Navegador de tabelas na lateral — clique gera um `SELECT * ... LIMIT 100`
- Múltiplas conexões simultâneas
- Arquitetura segura do Electron: `contextIsolation`, `sandbox`, sem `nodeIntegration` — acesso ao banco só via IPC

## Versão web empresarial (em construção)

Além do app desktop, há uma **versão web** (broker de acesso a bancos com SSO, data sources
gerenciados, grants e auditoria) — épico [#53](https://github.com/angelojrp/deep-ion-db/issues/53).
A web **reaproveita a mesma UI do desktop** (editor, abas, explorer, grid): uma única base React
recebe a camada de acesso por injeção (`window.api` no Electron, cliente HTTP no web) e ajusta os
recursos por **capabilities** — no web os data sources já vêm configurados pelo servidor.
Para subir o ambiente via **Docker Compose** ou **Kubernetes**, veja **[docs/DEPLOY.md](docs/DEPLOY.md)**.

```bash
docker compose up -d && curl http://localhost:4000/health
```

## Servidor MCP (expor o banco a agentes de IA)

Há um servidor **MCP** (Model Context Protocol) **somente-leitura** que expõe um PostgreSQL a
agentes como o Claude Code (tools: `list_tables`, `list_columns`, `query`).

```bash
npm run mcp:server   # stdio; configure as variáveis DEEPION_DB_*
```

Configuração no Claude Code (`mcpServers`), rodando a partir da pasta do projeto:

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
      drivers/       # postgres.ts, mysql.ts, sqlite.ts
      manager.ts     # roteia operações para o driver da conexão
      types.ts       # interface Driver
    ipc.ts           # handlers ipcMain (db:connect, db:query, ...)
    index.ts         # criação da janela
  preload/           # contextBridge -> window.api.db.*
  shared/            # tipos compartilhados (ConnectionConfig, QueryResult, ...)
  renderer/          # UI em React
    src/
      components/    # Sidebar, SqlEditor, ResultsGrid
      App.tsx
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

### Build de produção (empacotado pelo electron-vite)

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
| `npm run typecheck` | Checagem de tipos (node + web) |

## Roadmap

O planejamento completo, priorizado por milestone (Produtividade → DBA Toolkit → IA), está em **[ROADMAP.md](ROADMAP.md)** e nas [issues](https://github.com/angelojrp/deep-ion-db/issues).

Destaques das próximas versões:

- **v0.2 — Produtividade:** abas, autocomplete ciente do schema, export, edição na grade, conexões persistentes
- **v0.3 — DBA Toolkit:** explorador de objetos, EXPLAIN, monitor de sessões, usuários/permissões, diff de schemas, diagrama ER
- **v0.4 — IA para DBAs:** NL→SQL, assistente com contexto do banco, otimização por IA, **MCP**, multi-provedores (Claude/Codex/Gemini/local)

## Licença

MIT

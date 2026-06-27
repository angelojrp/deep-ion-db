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

- Conexão a **PostgreSQL**, **MySQL/MariaDB** e **SQLite**
- Editor SQL com **Monaco** (mesmo editor do VS Code), atalho **Ctrl/Cmd + Enter** para executar
- Grade de resultados (**TanStack Table**) com contagem de linhas e tempo de execução
- Navegador de tabelas na lateral — clique gera um `SELECT * ... LIMIT 100`
- Múltiplas conexões simultâneas
- Arquitetura segura do Electron: `contextIsolation`, `sandbox`, sem `nodeIntegration` — acesso ao banco só via IPC

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

- [ ] Múltiplas abas de query
- [ ] Edição de dados na grade (CRUD inline)
- [ ] Exportar resultados (CSV/JSON)
- [ ] Persistir conexões (com armazenamento seguro de senha)
- [ ] Expandir colunas/índices/constraints na árvore
- [ ] Suporte a SQL Server e mais bancos
- [ ] Empacotamento com electron-builder (instaladores)

## Licença

MIT

# CLAUDE.md — Guia de desenvolvimento (Deep Ion DB)

IDE relacional estilo DBeaver, **fortemente orientada a DBAs/Administradores de Dados**, com
**integração às principais ferramentas de IA** (Claude/Claude Code, OpenAI Codex, Gemini, modelos locais).
Stack: **Electron + React 19 + TypeScript**, build com **electron-vite**.

> Antes de planejar uma tarefa, leia o **[ROADMAP.md](ROADMAP.md)** e a issue correspondente.

## Arquitetura (resumo)

```
src/
  main/            # processo principal (Node): janela, IPC, acesso a banco
    db/
      drivers/     # postgres.ts, mysql.ts, sqlite.ts  (1 classe por banco)
      manager.ts   # DbManager: mantém conexões e roteia por id
      types.ts     # interface Driver
    ipc.ts         # ipcMain.handle('db:*')  -> DbManager
    index.ts       # BrowserWindow (sandbox + contextIsolation)
  preload/         # contextBridge -> window.api.db.*   (única ponte renderer↔main)
  shared/          # tipos compartilhados (ConnectionConfig, QueryResult, ...)
  renderer/src/    # React: components/, App.tsx
```

**Fluxo de dados:** renderer → `window.api.db.*` (preload) → `ipcRenderer.invoke` →
`ipcMain.handle` (ipc.ts) → `DbManager` → `Driver` concreto → banco.
O renderer **nunca** acessa Node/banco diretamente.

## Regras de ouro

- **Segurança Electron:** manter `sandbox: true`, `contextIsolation: true`, sem `nodeIntegration`.
  Toda nova capacidade do renderer passa por um canal IPC explícito no preload.
- **SQL parametrizado:** em metadados/consultas internas use placeholders (`$1`, `?`), nunca
  interpolação de string. (Queries do usuário no editor são executadas como digitadas — by design.)
- **Conexões:** abrir/fechar sempre via `DbManager`; não vazar handles. Erros viram rejeição do
  `ipcMain.handle` e são tratados na UI.
- **Tipos compartilhados** ficam em `src/shared/` e são a fonte da verdade entre as camadas.
- **TypeScript estrito.** React 19 não tem `JSX` global → `import { type JSX } from 'react'`.

## Padrão para adicionar um banco (driver)

Use a skill **`add-database-driver`**. Em resumo: criar `src/main/db/drivers/<novo>.ts`
implementando `Driver`, registrar no `switch` do `DbManager`, estender `DbKind` em
`src/shared/types.ts`, ajustar porta padrão na UI e adicionar testes.

## Qualidade — gates obrigatórios

Antes de abrir/atualizar um PR, rode:

```bash
npm run quality      # typecheck + lint + format:check
```

- **Format:** Prettier (`npm run format` aplica). Há hook que formata o arquivo ao salvar.
- **Lint:** ESLint flat config (`npm run lint:fix`).
- **Types:** `npm run typecheck` deve passar — há um Stop hook que bloqueia finalizar com erro de tipo.
- **Smoke/Build:** `npm run build` deve compilar; `/smoke` builda e abre o app.

## Issues e rastreamento

Issues de bug, feature e chore deste projeto são abertas **sempre** em:

```
gh issue create --repo angelojrp/deep-ion-db ...
```

> Isso sobrepõe a regra global que aponta para `deep-ion-ai/deep-ion`.
> Aquele repo é exclusivo para handoffs/decisões cross-projeto (labels `handoff/*`).

## Git — gitflow + Conventional Commits

**Nunca commitar/push direto na `main`.**

- `main` — produção; recebe apenas merges de release (com tag `vX.Y.Z` que dispara o CI de release).
- `develop` — integração; base das features.
- `feature/<slug>` — uma feature/issue; sai de `develop`, volta via **PR para `develop`**.
- `fix/<slug>`, `chore/<slug>`, `docs/<slug>` — conforme o tipo.
- Release: merge `develop` → `main` e tag `vX.Y.Z`.

**Conventional Commits** nas mensagens:

```
feat(editor): adiciona abas de query
fix(driver-pg): trata múltiplos result sets
chore(ci): serializa matriz de release
docs(roadmap): prioriza v0.4
```

Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf`, `style`.
Escopos comuns: `editor`, `grid`, `driver-pg|driver-mysql|driver-sqlite`, `ipc`, `connections`,
`ai`, `ci`, `roadmap`. Referencie a issue no corpo/rodapé (`Closes #N`).
PRs sempre para `develop` (use `gh pr create --base develop`).

> Não adicionar linhas `Co-Authored-By` nos commits.

## Desenvolvimento orientado a agentes (Claude Code)

Subagents disponíveis em `.claude/agents/` (use a ferramenta Agent):

- **db-driver-engineer** — implementa/estende drivers respeitando a interface `Driver`.
- **electron-security-reviewer** — audita IPC/preload/CSP/SQL/segredos (read-only).
- **test-engineer** — escreve testes (Vitest unit; e2e quando houver).
- **ai-integration-engineer** — implementa a camada de IA (provedores, NL→SQL, MCP) do épico #3.

Skills (`.claude/skills/`): `add-database-driver`, `release-app`.
Comandos (`.claude/commands/`): `/quality`, `/smoke`.

## Ambiente (WSL2) — importante

- Use o **Node do nvm** (`nvm use --lts`); o `npm` do PATH é o do Windows e `node` não está no PATH.
- Política **allow-scripts**: aprovar scripts com `npm approve-scripts <pkg>` quando necessário.
- Binário do Electron: se faltar, `node node_modules/electron/install.js`.
- `npm run rebuild` recompila o `better-sqlite3` para o ABI do Electron.
- App gráfico aparece via WSLg; se houver crash de sandbox, lançar com `--no-sandbox`.

## Como rodar

```bash
npm install && npm run rebuild
npm run dev          # desenvolvimento (HMR)
npm run build        # build de produção em out/
npm run dist:linux   # instaladores (ou :win / :mac)
```

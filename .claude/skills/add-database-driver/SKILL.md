---
name: add-database-driver
description: Procedimento para adicionar suporte a um novo banco relacional (ex.: SQL Server, Oracle, MariaDB) no Deep Ion DB, implementando a interface Driver e integrando à UI. Use quando a tarefa for "adicionar/dar suporte ao banco X".
---

# Adicionar um novo driver de banco

Siga estes passos, espelhando os drivers existentes em `src/main/db/drivers/`.

## 1. Tipo do banco

Em `src/shared/types.ts`, estenda a união `DbKind` com o novo valor (ex.: `'mssql'`).
Se o banco precisar de campos extras de conexão, acrescente em `ConnectionConfig`.

## 2. Dependência do driver

Instale o pacote do driver com o Node do nvm:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --lts
npm install <pacote>        # ex.: mssql, oracledb
```

Se o pacote tiver build nativo, aprove o script (`npm approve-scripts <pkg>`) e rode `npm run rebuild`.

## 3. Implementar o Driver

Crie `src/main/db/drivers/<banco>.ts` com uma classe que implementa `Driver`
(`connect`, `disconnect`, `query`, `listTables`, `listColumns`). Requisitos:

- `query()` retorna `QueryResult` completo (`columns`, `rows`, `rowCount`, `durationMs`, `command`),
  tratando SELECT vs. DML.
- Metadados (`listTables`/`listColumns`) com **SQL parametrizado** e mapeados para
  `SchemaTable`/`ColumnInfo`.
- `disconnect()` idempotente.

Use o driver mais parecido como referência (pg para servidores SQL; sqlite para arquivo).

## 4. Registrar no DbManager

Em `src/main/db/manager.ts`, adicione o `case` no `switch` de `create()` instanciando o novo driver.

## 5. UI de conexão

Em `src/renderer/src/components/Sidebar.tsx`: adicione a `<option>` no select de tipo e a porta
padrão em `DEFAULT_PORT`. Se houver campos novos, renderize-os condicionalmente.

## 6. Validar

```bash
npm run typecheck && npm run lint
npm run build      # garante que o bundle do main resolve o novo módulo
```

Adicione um teste (use o test-engineer): conexão + um SELECT simples + listagem de tabelas.

## 7. Documentar e commitar

Atualize o README (bancos suportados). Commit em Conventional Commits, escopo `driver-<banco>`:
`feat(driver-mssql): adiciona suporte a SQL Server`. Abra PR para `develop`.

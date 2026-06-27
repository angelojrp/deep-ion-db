# Roadmap — Deep Ion DB

IDE relacional **fortemente orientada a DBAs e Administradores de Dados**, com **integração nativa às principais ferramentas de IA** (Claude / Claude Code, OpenAI Codex, Google Gemini e modelos locais).

Este documento organiza e prioriza o backlog. As issues vivem em
[github.com/angelojrp/deep-ion-db/issues](https://github.com/angelojrp/deep-ion-db/issues)
e estão agrupadas por **milestone** e **épico**.

## Legenda de prioridade

| Prioridade | Significado |
| --- | --- |
| **P0** | Fundacional / desbloqueia outras issues — fazer primeiro |
| **P1** | Alto valor, próximo da entrega da milestone |
| **P2** | Importante, mas pode esperar |
| **P3** | Desejável / oportunístico |

Status: ✅ feito · 🚧 em andamento · ⬜ não iniciado

---

## ✅ v0.1.0 — Primeira versão (entregue)

Conexão a PostgreSQL/MySQL/SQLite, editor SQL (Monaco), grade de resultados (TanStack Table), navegador de tabelas e **instaladores desktop** (Windows/macOS/Linux) publicados em *Releases*.

---

## 🎯 v0.2 — Produtividade no SQL · épico [#1](https://github.com/angelojrp/deep-ion-db/issues/1)

Objetivo: tornar o uso diário tão fluido quanto DBeaver/DataGrip.

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P0** | [#10 Conexões persistentes com senha segura](https://github.com/angelojrp/deep-ion-db/issues/10) | ⬜ |
| **P0** | [#5 Múltiplas abas de query](https://github.com/angelojrp/deep-ion-db/issues/5) | ⬜ |
| **P1** | [#7 Autocomplete ciente do schema](https://github.com/angelojrp/deep-ion-db/issues/7) | ⬜ |
| **P1** | [#12 Executar seleção / múltiplos result sets](https://github.com/angelojrp/deep-ion-db/issues/12) | ⬜ |
| **P1** | [#8 Exportar resultados (CSV/JSON/Excel)](https://github.com/angelojrp/deep-ion-db/issues/8) | ⬜ |
| **P1** | [#6 Histórico de queries e favoritos](https://github.com/angelojrp/deep-ion-db/issues/6) | ⬜ |
| **P2** | [#9 Edição de dados na grade (CRUD inline)](https://github.com/angelojrp/deep-ion-db/issues/9) | ⬜ |
| **P2** | [#11 Formatação (pretty-print) de SQL](https://github.com/angelojrp/deep-ion-db/issues/11) | ⬜ |

**Razão da ordem:** persistir conexões (#10) é base para tudo; abas (#5) mudam o modelo de estado da UI, melhor antes de adicionar features em cima.

---

## 🛠️ v0.3 — DBA Toolkit · épico [#2](https://github.com/angelojrp/deep-ion-db/issues/2)

Objetivo: ferramentas de administração de primeira linha.

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P0** | [#13 Explorador de objetos completo](https://github.com/angelojrp/deep-ion-db/issues/13) | ⬜ |
| **P1** | [#14 Visualizar/gerar DDL (CREATE/ALTER)](https://github.com/angelojrp/deep-ion-db/issues/14) | ⬜ |
| **P1** | [#15 Visualização de planos (EXPLAIN)](https://github.com/angelojrp/deep-ion-db/issues/15) | ⬜ |
| **P1** | [#16 Monitor de sessões e atividade](https://github.com/angelojrp/deep-ion-db/issues/16) | ⬜ |
| **P2** | [#17 Usuários, roles e permissões](https://github.com/angelojrp/deep-ion-db/issues/17) | ⬜ |
| **P2** | [#18 Dashboard de saúde do servidor](https://github.com/angelojrp/deep-ion-db/issues/18) | ⬜ |
| **P2** | [#21 Diff de schemas e migrações](https://github.com/angelojrp/deep-ion-db/issues/21) | ⬜ |
| **P2** | [#20 Diagrama ER (engenharia reversa)](https://github.com/angelojrp/deep-ion-db/issues/20) | ⬜ |
| **P2** | [#19 Backup e restore](https://github.com/angelojrp/deep-ion-db/issues/19) | ⬜ |
| **P3** | [#22 Importação de dados em massa](https://github.com/angelojrp/deep-ion-db/issues/22) | ⬜ |
| **P3** | [#23 Agendador de jobs](https://github.com/angelojrp/deep-ion-db/issues/23) | ⬜ |

**Razão da ordem:** o explorador de objetos (#13) e a coleta de metadados por dialeto alimentam quase todas as demais (DDL, EXPLAIN, diff, ER).

---

## 🤖 v0.4 — IA para DBAs · épico [#3](https://github.com/angelojrp/deep-ion-db/issues/3) ⭐

Objetivo: diferencial do produto — IA integrada ao fluxo do DBA.

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P0** | [#24 Camada de provedores de IA (Claude/Codex/Gemini/local)](https://github.com/angelojrp/deep-ion-db/issues/24) | ⬜ |
| **P0** | [#25 Configuração de credenciais/modelos](https://github.com/angelojrp/deep-ion-db/issues/25) | ⬜ |
| **P1** | [#26 NL→SQL com contexto do schema](https://github.com/angelojrp/deep-ion-db/issues/26) | ⬜ |
| **P1** | [#27 Explicação de queries](https://github.com/angelojrp/deep-ion-db/issues/27) | ⬜ |
| **P1** | [#29 Assistente/chat DBA com contexto do banco](https://github.com/angelojrp/deep-ion-db/issues/29) | ⬜ |
| **P2** | [#30 Servidor MCP (expor o banco a agentes)](https://github.com/angelojrp/deep-ion-db/issues/30) | ⬜ |
| **P2** | [#28 Otimização de queries por IA](https://github.com/angelojrp/deep-ion-db/issues/28) | ⬜ |
| **P2** | [#31 Diagnóstico de performance por IA](https://github.com/angelojrp/deep-ion-db/issues/31) | ⬜ |
| **P3** | [#32 Documentação automática do schema](https://github.com/angelojrp/deep-ion-db/issues/32) | ⬜ |
| **P3** | [#33 Geração de dados de teste/seed](https://github.com/angelojrp/deep-ion-db/issues/33) | ⬜ |

**Razão da ordem:** a abstração de provedores (#24) + credenciais (#25) são pré-requisito de toda funcionalidade de IA.

---

## 🧱 Backlog / Plataforma · épico [#4](https://github.com/angelojrp/deep-ion-db/issues/4)

Sustentação, distribuição e qualidade — itens transversais às milestones.

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P1** | [#37 Identidade visual: ícones e branding](https://github.com/angelojrp/deep-ion-db/issues/37) | ⬜ |
| **P1** | [#39 CI de qualidade em PRs (lint/typecheck/test)](https://github.com/angelojrp/deep-ion-db/issues/39) | ⬜ |
| **P1** | [#38 Testes automatizados (unit + e2e)](https://github.com/angelojrp/deep-ion-db/issues/38) | ⬜ |
| **P1** | [#35 Auto-update do app](https://github.com/angelojrp/deep-ion-db/issues/35) | ⬜ |
| **P2** | [#34 Novos bancos (SQL Server, Oracle)](https://github.com/angelojrp/deep-ion-db/issues/34) | ⬜ |
| **P2** | [#36 Assinatura de código (Windows/macOS)](https://github.com/angelojrp/deep-ion-db/issues/36) | ⬜ |
| **P2** | [#40 Temas e preferências do usuário](https://github.com/angelojrp/deep-ion-db/issues/40) | ⬜ |

---

## Dependências relevantes

- IA (#26–#33) depende da fundação **#24 + #25**.
- **#28 Otimização por IA** consome **#15 EXPLAIN**.
- **#31 Diagnóstico por IA** consome **#18 Dashboard** e **#19 Backup/manutenção**.
- **#30 MCP** reaproveita a coleta de metadados do **#13 Explorador de objetos**.
- Recursos de DBA (DDL, EXPLAIN, diff, ER) dependem da coleta de metadados do **#13**.

## Como contribuir

1. Pegue uma issue da milestone atual respeitando a prioridade (P0 → P3).
2. Abra um PR referenciando a issue (`Closes #N`).
3. O CI (após [#39](https://github.com/angelojrp/deep-ion-db/issues/39)) roda typecheck/lint/testes.

> Este roadmap é vivo: prioridades podem mudar conforme feedback de uso.

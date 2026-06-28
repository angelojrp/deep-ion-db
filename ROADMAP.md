# Roadmap — Deep Ion DB

IDE relacional **fortemente orientada a DBAs e Administradores de Dados**, com **integração nativa às principais ferramentas de IA** (Claude / Claude Code, OpenAI Codex, Google Gemini e modelos locais).

Este documento resume o que **já está entregue** e organiza o **backlog em aberto**. As issues vivem em
[github.com/angelojrp/deep-ion-db/issues](https://github.com/angelojrp/deep-ion-db/issues).

## Legenda

| Prioridade | Significado |
| --- | --- |
| **P0** | Fundacional / desbloqueia outras issues — fazer primeiro |
| **P1** | Alto valor, próximo da entrega |
| **P2** | Importante, mas pode esperar |
| **P3** | Desejável / oportunístico |

Status: ✅ entregue · 🚧 em andamento · ⬜ não iniciado

---

## ✅ Entregue até aqui

O produto já cobre o ciclo completo de uso diário de um DBA, no **desktop** e na **web empresarial**.

### v0.1 — Fundação
Conexão a PostgreSQL/MySQL/SQLite, editor SQL (Monaco), grade de resultados (TanStack Table), navegador de tabelas e **instaladores desktop** (Windows/macOS/Linux) publicados em *Releases*.

### v0.2 — Produtividade no SQL · épico [#1](https://github.com/angelojrp/deep-ion-db/issues/1) ✅
Conexões persistentes com senha segura ([#10](https://github.com/angelojrp/deep-ion-db/issues/10)), múltiplas abas ([#5](https://github.com/angelojrp/deep-ion-db/issues/5)), autocomplete ciente do schema ([#7](https://github.com/angelojrp/deep-ion-db/issues/7)), executar seleção / múltiplos result sets ([#12](https://github.com/angelojrp/deep-ion-db/issues/12)), export CSV/JSON/Excel ([#8](https://github.com/angelojrp/deep-ion-db/issues/8)), histórico e favoritos ([#6](https://github.com/angelojrp/deep-ion-db/issues/6)), formatação de SQL ([#11](https://github.com/angelojrp/deep-ion-db/issues/11)), edição inline na grade ([#9](https://github.com/angelojrp/deep-ion-db/issues/9)), workspace de queries ([#44](https://github.com/angelojrp/deep-ion-db/issues/44)) e editor/visualizador de Markdown ([#45](https://github.com/angelojrp/deep-ion-db/issues/45)).

### v0.3 — DBA Toolkit · épico [#2](https://github.com/angelojrp/deep-ion-db/issues/2) ✅
Database Explorer multi-conexão estilo DataGrip ([#43](https://github.com/angelojrp/deep-ion-db/issues/43)), explorador de objetos ([#13](https://github.com/angelojrp/deep-ion-db/issues/13)), DDL CREATE/ALTER ([#14](https://github.com/angelojrp/deep-ion-db/issues/14)), planos de execução EXPLAIN ([#15](https://github.com/angelojrp/deep-ion-db/issues/15)), monitor de sessões ([#16](https://github.com/angelojrp/deep-ion-db/issues/16)), usuários/roles/permissões ([#17](https://github.com/angelojrp/deep-ion-db/issues/17)), dashboard de saúde ([#18](https://github.com/angelojrp/deep-ion-db/issues/18)), backup/restore ([#19](https://github.com/angelojrp/deep-ion-db/issues/19)), diagrama ER ([#20](https://github.com/angelojrp/deep-ion-db/issues/20)), diff de schemas ([#21](https://github.com/angelojrp/deep-ion-db/issues/21)), importação em massa ([#22](https://github.com/angelojrp/deep-ion-db/issues/22)) e agendador de jobs ([#23](https://github.com/angelojrp/deep-ion-db/issues/23)).

### v0.4 — IA para DBAs · épico [#3](https://github.com/angelojrp/deep-ion-db/issues/3) ✅ ⭐
Camada de provedores de IA ([#24](https://github.com/angelojrp/deep-ion-db/issues/24)) com configuração de credenciais ([#25](https://github.com/angelojrp/deep-ion-db/issues/25)); NL→SQL com contexto do schema ([#26](https://github.com/angelojrp/deep-ion-db/issues/26)), explicação de queries ([#27](https://github.com/angelojrp/deep-ion-db/issues/27)), otimização assistida ([#28](https://github.com/angelojrp/deep-ion-db/issues/28)), chat DBA com contexto do banco ([#29](https://github.com/angelojrp/deep-ion-db/issues/29)), servidor MCP ([#30](https://github.com/angelojrp/deep-ion-db/issues/30)), diagnóstico de performance ([#31](https://github.com/angelojrp/deep-ion-db/issues/31)), documentação automática do schema ([#32](https://github.com/angelojrp/deep-ion-db/issues/32)) e geração de dados de seed ([#33](https://github.com/angelojrp/deep-ion-db/issues/33)).

### Web empresarial · épico [#53](https://github.com/angelojrp/deep-ion-db/issues/53) ✅
Backend Fastify reaproveitando os drivers ([#54](https://github.com/angelojrp/deep-ion-db/issues/54)) + frontend React servido como web app ([#55](https://github.com/angelojrp/deep-ion-db/issues/55)); SSO via OIDC/Keycloak ([#56](https://github.com/angelojrp/deep-ion-db/issues/56), [#106](https://github.com/angelojrp/deep-ion-db/issues/106)), RBAC ([#57](https://github.com/angelojrp/deep-ion-db/issues/57)), banco de metadados ([#58](https://github.com/angelojrp/deep-ion-db/issues/58)), cadastro central de data sources com cofre ([#59](https://github.com/angelojrp/deep-ion-db/issues/59), [#62](https://github.com/angelojrp/deep-ion-db/issues/62)), grants por usuário/grupo com expiração ([#60](https://github.com/angelojrp/deep-ion-db/issues/60), [#121](https://github.com/angelojrp/deep-ion-db/issues/121)), conexão proxied sem expor credenciais ([#61](https://github.com/angelojrp/deep-ion-db/issues/61)), auditoria ([#63](https://github.com/angelojrp/deep-ion-db/issues/63), [#119](https://github.com/angelojrp/deep-ion-db/issues/119)), políticas por concessão ([#64](https://github.com/angelojrp/deep-ion-db/issues/64)), limite de sessões ([#65](https://github.com/angelojrp/deep-ion-db/issues/65)), painel de administração ([#115](https://github.com/angelojrp/deep-ion-db/issues/115)) e deploy via Docker/Compose ([#66](https://github.com/angelojrp/deep-ion-db/issues/66), [#97](https://github.com/angelojrp/deep-ion-db/issues/97)).

### Plataforma · épico [#4](https://github.com/angelojrp/deep-ion-db/issues/4) ✅
Suporte a **SQL Server e Oracle** ([#34](https://github.com/angelojrp/deep-ion-db/issues/34), [#101](https://github.com/angelojrp/deep-ion-db/issues/101)), auto-update ([#35](https://github.com/angelojrp/deep-ion-db/issues/35)), assinatura de código ([#36](https://github.com/angelojrp/deep-ion-db/issues/36)), branding ([#37](https://github.com/angelojrp/deep-ion-db/issues/37)), testes automatizados ([#38](https://github.com/angelojrp/deep-ion-db/issues/38)), CI de qualidade em PRs ([#39](https://github.com/angelojrp/deep-ion-db/issues/39)) e temas/preferências ([#40](https://github.com/angelojrp/deep-ion-db/issues/40)).

**Bancos suportados:** PostgreSQL · MySQL/MariaDB · SQLite · SQL Server · Oracle.

---

## 🚧 Em aberto — próxima rodada

Foco em **profissionalização**: robustez do core, segurança de produção, qualidade e maturidade da IA — sem tornar a ferramenta pesada.

### Robustez do core (drivers e execução)

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P0** | [#134 fix: `routines()` do MySQL ignora `schema`](https://github.com/angelojrp/deep-ion-db/issues/134) | ⬜ |
| **P1** | [#135 Cancelamento de queries em execução (Stop real)](https://github.com/angelojrp/deep-ion-db/issues/135) | ⬜ |
| **P1** | [#136 Teto de linhas + virtual scrolling para resultados grandes](https://github.com/angelojrp/deep-ion-db/issues/136) | ⬜ |
| **P1** | [#137 Timeout de query + reconexão resiliente](https://github.com/angelojrp/deep-ion-db/issues/137) | ⬜ |
| **P2** | [#138 BaseDriver: reduzir duplicação e garantir paridade](https://github.com/angelojrp/deep-ion-db/issues/138) | ⬜ |
| **P2** | [#149 Modularizar `App.tsx`](https://github.com/angelojrp/deep-ion-db/issues/149) | ⬜ |

### Segurança de produção

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P0** | [#139 Endurecer servidor web (CORS, rate-limit, helmet, controle de acesso, vault key)](https://github.com/angelojrp/deep-ion-db/issues/139) | ⬜ |
| **P0** | [#140 Endurecer Electron (openExternal, path traversal, CSP)](https://github.com/angelojrp/deep-ion-db/issues/140) | ⬜ |
| **P1** | [#141 Read-only de verdade no proxy/MCP + TLS](https://github.com/angelojrp/deep-ion-db/issues/141) | ⬜ |

### IA — maturidade

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P1** | [#142 Robustez: retry/backoff, timeout, erros, seleção de modelo](https://github.com/angelojrp/deep-ion-db/issues/142) | ⬜ |
| **P1** | [#144 Consentimento/redação antes de enviar dados à nuvem](https://github.com/angelojrp/deep-ion-db/issues/144) | ⬜ |
| **P2** | [#143 Streaming incremental das respostas](https://github.com/angelojrp/deep-ion-db/issues/143) | ⬜ |
| **P2** | [#145 Provedores Gemini e modelos locais (Ollama)](https://github.com/angelojrp/deep-ion-db/issues/145) | ⬜ |
| **P2** | [#146 MCP multi-dialeto + integração na UI](https://github.com/angelojrp/deep-ion-db/issues/146) | ⬜ |

### Qualidade, testes e CI

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P1** | [#147 Cobertura de drivers e camada IPC](https://github.com/angelojrp/deep-ion-db/issues/147) | ⬜ |
| **P1** | [#148 Coverage, build e smoke test no CI](https://github.com/angelojrp/deep-ion-db/issues/148) | ⬜ |
| **P2** | [#150 Atualizar ROADMAP e README (showcase)](https://github.com/angelojrp/deep-ion-db/issues/150) | 🚧 |

### Web e infraestrutura

| Prioridade | Issue | Status |
| --- | --- | --- |
| **P2** | [#131 UX do painel admin (forms em modal, confirmações, campos context-aware)](https://github.com/angelojrp/deep-ion-db/issues/131) | ⬜ |
| **P2** | [#132 Keycloak SSO + bancos de teste no docker-compose](https://github.com/angelojrp/deep-ion-db/issues/132) | ⬜ |
| **P2** | [#130 Render de diagramas Mermaid no preview de Markdown](https://github.com/angelojrp/deep-ion-db/issues/130) | ⬜ |
| **P3** | [#123 Desktop como thin client do servidor (modo servidor)](https://github.com/angelojrp/deep-ion-db/issues/123) | ⬜ |

---

## Como contribuir

1. Pegue uma issue do backlog respeitando a prioridade (P0 → P3).
2. Saia de `develop`, trabalhe em `feature/<slug>` (ou `fix/`, `docs/`, `chore/`).
3. Abra um PR para `develop` referenciando a issue (`Closes #N`), em **Conventional Commits**.
4. O CI roda typecheck/lint/testes.

> Este roadmap é vivo: prioridades podem mudar conforme feedback de uso.

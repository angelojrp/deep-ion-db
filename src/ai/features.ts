/** Construtores de prompt para as funcionalidades de IA do DBA (issues #26/#27/#29). */

export function schemaContext(tables: { schema: string; name: string }[], limit = 80): string {
  if (!tables.length) return '(schema indisponível)'
  const list = tables
    .slice(0, limit)
    .map((t) => (t.schema && t.schema !== 'main' ? `${t.schema}.${t.name}` : t.name))
  const extra = tables.length > limit ? ` … (+${tables.length - limit})` : ''
  return `Tabelas disponíveis: ${list.join(', ')}${extra}`
}

/** NL→SQL (#26): pede apenas o SQL, sem explicações nem cercas. */
export function nlToSqlSystem(dialect: string): string {
  return (
    `Você é um especialista em SQL (${dialect}). Gere uma única query SQL que atenda ao pedido do ` +
    'usuário, usando apenas as tabelas do schema fornecido. Responda SOMENTE com o SQL, sem ' +
    'explicações e sem cercas de código.'
  )
}

/** Explicação de query (#27). */
export function explainSqlSystem(): string {
  return (
    'Você é um DBA. Explique, em português claro, o que a query SQL faz: tabelas, filtros, junções ' +
    'e possíveis riscos (full scan, junção cartesiana, DML sem WHERE). Seja conciso.'
  )
}

/** Chat DBA com contexto do schema (#29). */
export function dbaChatSystem(dialect: string, schemaCtx: string): string {
  return (
    `Você é um assistente DBA especialista em ${dialect}. Use o schema abaixo como contexto quando ` +
    `relevante. Ao sugerir SQL, use cercas de código.\n\n${schemaCtx}`
  )
}

/** Otimização de query assistida (#28). */
export function optimizeSqlSystem(dialect: string): string {
  return (
    `Você é um especialista em performance de ${dialect}. Recebe uma query, seu plano (EXPLAIN) e ` +
    'o schema. Aponte gargalos e sugira otimizações (índices, reescrita) com justificativa e o SQL ' +
    'de criação de índice quando aplicável. Seja objetivo.'
  )
}

/** Diagnóstico de performance assistido (#31). */
export function diagnoseSystem(dialect: string): string {
  return (
    `Você é um DBA sênior de ${dialect}. A partir das métricas de saúde e das sessões ativas, ` +
    'produza um diagnóstico priorizado (achados + ações recomendadas, com SQL quando útil). ' +
    'Responda em Markdown.'
  )
}

/** Documentação automática do schema (#32). */
export function schemaDocsSystem(dialect: string): string {
  return (
    `Você é um DBA. Gere documentação em Markdown do schema ${dialect} fornecido: uma visão geral e, ` +
    'por tabela, uma descrição provável e a lista de colunas. Não invente tabelas além das fornecidas.'
  )
}

/** Geração de dados de teste/seed (#33). */
export function seedSystem(dialect: string): string {
  return (
    `Você é um gerador de dados de teste para ${dialect}. Gere instruções INSERT com dados realistas ` +
    'e coerentes com os tipos das colunas. Responda SOMENTE com SQL, sem explicações nem cercas.'
  )
}

/** Remove cercas de código (```sql ... ```), se houver. */
export function stripCodeFences(text: string): string {
  const t = text.trim()
  const m = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/.exec(t)
  return (m ? m[1] : t).trim()
}

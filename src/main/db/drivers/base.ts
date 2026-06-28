import type { HealthMetric, JobInfo, QueryResult, RoleInfo, SessionInfo } from '../types'

/**
 * Classe base para todos os drivers de banco.
 *
 * Fornece implementações padrão para métodos que muitos dialetos não suportam
 * (retornam lista vazia) e um utilitário para montar QueryResult de forma
 * padronizada. Os drivers concretos estendem esta classe e sobrescrevem apenas
 * o que é específico do dialeto.
 */
export abstract class BaseDriver {
  /**
   * Monta um QueryResult a partir das partes comuns.
   * Use em todos os drivers para garantir consistência na estrutura retornada.
   */
  protected normalizeQueryResult(
    columns: string[],
    rows: Record<string, unknown>[],
    rowCount: number,
    durationMs: number,
    command: string
  ): QueryResult {
    return { columns, rows, rowCount, durationMs, command }
  }

  /** Drivers que não suportam sessões retornam lista vazia. */
  async activeSessions(): Promise<SessionInfo[]> {
    return []
  }

  /** Drivers que não possuem agendador de jobs retornam lista vazia. */
  async jobs(): Promise<JobInfo[]> {
    return []
  }

  /** Drivers que não expõem roles/usuários via SQL retornam lista vazia. */
  async listRoles(): Promise<RoleInfo[]> {
    return []
  }

  /** Drivers que não expõem métricas de saúde retornam lista vazia. */
  async serverHealth(): Promise<HealthMetric[]> {
    return []
  }
}

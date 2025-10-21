import type { AuditLog } from "@distributed/types"
import { CryptoManager } from "@distributed/utils"

export class AuditDatabase {
  private logs: Map<string, AuditLog>
  private userIndex: Map<string, Set<string>>
  private actionIndex: Map<string, Set<string>>
  private chronologicalIndex: AuditLog[]

  constructor() {
    this.logs = new Map()
    this.userIndex = new Map()
    this.actionIndex = new Map()
    this.chronologicalIndex = []
  }

  async createLog(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    status: "success" | "failure",
    details: string,
    ipAddress: string,
  ): Promise<AuditLog> {
    const log: AuditLog = {
      id: CryptoManager.generateId(),
      userId,
      action,
      resource,
      resourceId,
      status,
      details,
      ipAddress,
      timestamp: new Date(),
    }

    this.logs.set(log.id, log)
    this.chronologicalIndex.push(log)

    // Update user index
    if (!this.userIndex.has(userId)) {
      this.userIndex.set(userId, new Set())
    }
    this.userIndex.get(userId)!.add(log.id)

    // Update action index
    if (!this.actionIndex.has(action)) {
      this.actionIndex.set(action, new Set())
    }
    this.actionIndex.get(action)!.add(log.id)

    return log
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.logs.get(id) || null
  }

  async findByUserId(userId: string, page = 1, limit = 10): Promise<{ logs: AuditLog[]; total: number }> {
    const logIds = this.userIndex.get(userId)
    if (!logIds) {
      return { logs: [], total: 0 }
    }

    const allLogs = Array.from(logIds)
      .map((id) => this.logs.get(id))
      .filter((log): log is AuditLog => log !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    const start = (page - 1) * limit
    const end = start + limit
    const logs = allLogs.slice(start, end)

    return { logs, total: allLogs.length }
  }

  async findAll(
    page = 1,
    limit = 10,
    filters?: { action?: string; status?: string },
  ): Promise<{ logs: AuditLog[]; total: number }> {
    let filteredLogs = [...this.chronologicalIndex]

    if (filters?.action) {
      const actionLogIds = this.actionIndex.get(filters.action)
      if (actionLogIds) {
        filteredLogs = filteredLogs.filter((log) => actionLogIds.has(log.id))
      } else {
        filteredLogs = []
      }
    }

    if (filters?.status) {
      filteredLogs = filteredLogs.filter((log) => log.status === filters.status)
    }

    // Sort by timestamp descending
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    const start = (page - 1) * limit
    const end = start + limit
    const logs = filteredLogs.slice(start, end)

    return { logs, total: filteredLogs.length }
  }

  async getStatistics(): Promise<{
    totalLogs: number
    successCount: number
    failureCount: number
    actionBreakdown: Record<string, number>
  }> {
    const totalLogs = this.logs.size
    let successCount = 0
    let failureCount = 0
    const actionBreakdown: Record<string, number> = {}

    for (const log of this.logs.values()) {
      if (log.status === "success") successCount++
      if (log.status === "failure") failureCount++

      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1
    }

    return { totalLogs, successCount, failureCount, actionBreakdown }
  }

  exportData(): AuditLog[] {
    return Array.from(this.logs.values())
  }

  importData(logs: AuditLog[]): void {
    logs.forEach((log) => {
      this.logs.set(log.id, log)
      this.chronologicalIndex.push(log)

      if (!this.userIndex.has(log.userId)) {
        this.userIndex.set(log.userId, new Set())
      }
      this.userIndex.get(log.userId)!.add(log.id)

      if (!this.actionIndex.has(log.action)) {
        this.actionIndex.set(log.action, new Set())
      }
      this.actionIndex.get(log.action)!.add(log.id)
    })

    // Re-sort chronological index
    this.chronologicalIndex.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }
}

import { Logger } from "@distributed/utils"
import type { NodeDatabase } from "./database"
import type { LeaderElection } from "./leader-election"

export class HealthMonitor {
  private logger: Logger
  private db: NodeDatabase
  private leaderElection: LeaderElection
  private heartbeatTimeout: number
  private checkInterval: NodeJS.Timeout | null

  constructor(db: NodeDatabase, leaderElection: LeaderElection, heartbeatTimeout = 15000) {
    this.logger = new Logger("HealthMonitor")
    this.db = db
    this.leaderElection = leaderElection
    this.heartbeatTimeout = heartbeatTimeout
    this.checkInterval = null
  }

  start(): void {
    this.logger.info("Starting health monitor", { heartbeatTimeout: this.heartbeatTimeout })

    this.checkInterval = setInterval(async () => {
      await this.checkNodeHealth()
    }, 5000) // Check every 5 seconds
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      this.logger.info("Health monitor stopped")
    }
  }

  private async checkNodeHealth(): Promise<void> {
    try {
      const staleNodes = await this.db.checkStaleNodes(this.heartbeatTimeout)

      if (staleNodes.length > 0) {
        this.logger.warn("Detected stale nodes", { count: staleNodes.length, nodes: staleNodes })

        // Check if leader failed
        const currentLeader = this.leaderElection.getCurrentLeader()
        if (currentLeader && staleNodes.includes(currentLeader)) {
          const activeNodes = await this.db.getActiveNodes()
          const activeNodeIds = activeNodes.map((n) => n.id)
          this.leaderElection.handleLeaderFailure(currentLeader, activeNodeIds)
        }
      }

      // Log health statistics
      const activeNodes = await this.db.getActiveNodes()
      const failedNodes = await this.db.findByStatus("failed")

      this.logger.debug("Health check completed", {
        activeNodes: activeNodes.length,
        failedNodes: failedNodes.length,
        leader: this.leaderElection.getCurrentLeader(),
      })
    } catch (error: any) {
      this.logger.error("Health check failed", { error: error.message })
    }
  }

  async getHealthReport(): Promise<{
    totalNodes: number
    activeNodes: number
    failedNodes: number
    inactiveNodes: number
    currentLeader: string | null
  }> {
    const allNodes = await this.db.listAll()
    const activeNodes = await this.db.findByStatus("active")
    const failedNodes = await this.db.findByStatus("failed")
    const inactiveNodes = await this.db.findByStatus("inactive")

    return {
      totalNodes: allNodes.length,
      activeNodes: activeNodes.length,
      failedNodes: failedNodes.length,
      inactiveNodes: inactiveNodes.length,
      currentLeader: this.leaderElection.getCurrentLeader(),
    }
  }
}

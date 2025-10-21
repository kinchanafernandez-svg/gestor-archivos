import { Logger } from "@distributed/utils"
import type { File } from "@distributed/types"

export class ReplicationManager {
  private logger: Logger
  private replicationFactor: number
  private availableNodes: string[]

  constructor(replicationFactor = 3) {
    this.logger = new Logger("ReplicationManager")
    this.replicationFactor = replicationFactor
    this.availableNodes = []
  }

  setAvailableNodes(nodes: string[]): void {
    this.availableNodes = nodes
    this.logger.info("Updated available nodes", { count: nodes.length })
  }

  selectReplicaNodes(excludeNode?: string): string[] {
    const availableForReplication = excludeNode
      ? this.availableNodes.filter((n) => n !== excludeNode)
      : this.availableNodes

    const count = Math.min(this.replicationFactor, availableForReplication.length)
    const selected: string[] = []

    // Simple random selection
    const shuffled = [...availableForReplication].sort(() => Math.random() - 0.5)
    for (let i = 0; i < count; i++) {
      selected.push(shuffled[i])
    }

    return selected
  }

  async replicateToNode(nodeAddress: string, fileId: string, content: Buffer, metadata: File): Promise<boolean> {
    try {
      this.logger.info("Replicating file to node", { nodeAddress, fileId })
      // In a real implementation, this would make a gRPC call to the target node
      // For now, we'll simulate success
      return true
    } catch (error: any) {
      this.logger.error("Replication failed", { nodeAddress, fileId, error: error.message })
      return false
    }
  }

  async replicateFile(fileId: string, content: Buffer, metadata: File): Promise<string[]> {
    const replicaNodes = this.selectReplicaNodes()
    const successfulReplicas: string[] = []

    for (const node of replicaNodes) {
      const success = await this.replicateToNode(node, fileId, content, metadata)
      if (success) {
        successfulReplicas.push(node)
      }
    }

    this.logger.info("File replication completed", {
      fileId,
      totalReplicas: successfulReplicas.length,
      targetReplicas: replicaNodes.length,
    })

    return successfulReplicas
  }
}

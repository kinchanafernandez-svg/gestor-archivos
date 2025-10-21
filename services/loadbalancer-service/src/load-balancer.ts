import { Logger } from "@distributed/utils"

interface NodeHealth {
  nodeId: string
  address: string
  port: number
  healthScore: number
  activeConnections: number
  lastUpdate: Date
}

export class LoadBalancer {
  private logger: Logger
  private nodes: Map<string, Map<string, NodeHealth>>
  private roundRobinIndex: Map<string, number>

  constructor() {
    this.logger = new Logger("LoadBalancer")
    this.nodes = new Map()
    this.roundRobinIndex = new Map()
  }

  registerNode(serviceType: string, nodeId: string, address: string, port: number): void {
    if (!this.nodes.has(serviceType)) {
      this.nodes.set(serviceType, new Map())
      this.roundRobinIndex.set(serviceType, 0)
    }

    const nodeHealth: NodeHealth = {
      nodeId,
      address,
      port,
      healthScore: 1.0,
      activeConnections: 0,
      lastUpdate: new Date(),
    }

    this.nodes.get(serviceType)!.set(nodeId, nodeHealth)
    this.logger.info("Node registered", { serviceType, nodeId, address, port })
  }

  updateNodeHealth(serviceType: string, nodeId: string, healthScore: number, activeConnections: number): void {
    const serviceNodes = this.nodes.get(serviceType)
    if (!serviceNodes) return

    const node = serviceNodes.get(nodeId)
    if (!node) return

    node.healthScore = healthScore
    node.activeConnections = activeConnections
    node.lastUpdate = new Date()

    this.logger.debug("Node health updated", { serviceType, nodeId, healthScore, activeConnections })
  }

  updateNodeWeight(nodeId: string, weight: number): boolean {
    for (const [serviceType, serviceNodes] of this.nodes.entries()) {
      const node = serviceNodes.get(nodeId)
      if (node) {
        node.healthScore = weight
        this.logger.info("Node weight updated", { serviceType, nodeId, weight })
        return true
      }
    }
    return false
  }

  removeNode(serviceType: string, nodeId: string): void {
    const serviceNodes = this.nodes.get(serviceType)
    if (serviceNodes) {
      serviceNodes.delete(nodeId)
      this.logger.info("Node removed", { serviceType, nodeId })
    }
  }

  selectNode(
    serviceType: string,
    strategy: "round-robin" | "least-connections" | "weighted" = "round-robin",
  ): NodeHealth | null {
    const serviceNodes = this.nodes.get(serviceType)
    if (!serviceNodes || serviceNodes.size === 0) {
      this.logger.warn("No nodes available", { serviceType })
      return null
    }

    const healthyNodes = Array.from(serviceNodes.values()).filter((node) => node.healthScore > 0.3)

    if (healthyNodes.length === 0) {
      this.logger.warn("No healthy nodes available", { serviceType })
      return null
    }

    switch (strategy) {
      case "least-connections":
        return this.selectLeastConnections(healthyNodes)
      case "weighted":
        return this.selectWeighted(healthyNodes)
      case "round-robin":
      default:
        return this.selectRoundRobin(serviceType, healthyNodes)
    }
  }

  private selectRoundRobin(serviceType: string, nodes: NodeHealth[]): NodeHealth {
    const currentIndex = this.roundRobinIndex.get(serviceType) || 0
    const selectedNode = nodes[currentIndex % nodes.length]
    this.roundRobinIndex.set(serviceType, (currentIndex + 1) % nodes.length)
    return selectedNode
  }

  private selectLeastConnections(nodes: NodeHealth[]): NodeHealth {
    return nodes.reduce((min, node) => (node.activeConnections < min.activeConnections ? node : min))
  }

  private selectWeighted(nodes: NodeHealth[]): NodeHealth {
    const totalWeight = nodes.reduce((sum, node) => sum + node.healthScore, 0)
    let random = Math.random() * totalWeight

    for (const node of nodes) {
      random -= node.healthScore
      if (random <= 0) {
        return node
      }
    }

    return nodes[0]
  }

  getNodeHealth(serviceType: string): NodeHealth[] {
    const serviceNodes = this.nodes.get(serviceType)
    if (!serviceNodes) return []
    return Array.from(serviceNodes.values())
  }

  getAllNodes(): Map<string, NodeHealth[]> {
    const result = new Map<string, NodeHealth[]>()
    for (const [serviceType, nodes] of this.nodes.entries()) {
      result.set(serviceType, Array.from(nodes.values()))
    }
    return result
  }
}

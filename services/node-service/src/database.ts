import type { Node, NodeMetrics } from "@distributed/types"

export class NodeDatabase {
  private nodes: Map<string, Node>
  private typeIndex: Map<string, Set<string>>
  private statusIndex: Map<string, Set<string>>

  constructor() {
    this.nodes = new Map()
    this.typeIndex = new Map()
    this.statusIndex = new Map()
  }

  async registerNode(id: string, type: Node["type"], address: string, port: number): Promise<Node> {
    const node: Node = {
      id,
      type,
      address,
      port,
      status: "active",
      lastHeartbeat: new Date(),
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        requestsPerMinute: 0,
      },
    }

    this.nodes.set(id, node)

    if (!this.typeIndex.has(type)) {
      this.typeIndex.set(type, new Set())
    }
    this.typeIndex.get(type)!.add(id)

    if (!this.statusIndex.has("active")) {
      this.statusIndex.set("active", new Set())
    }
    this.statusIndex.get("active")!.add(id)

    return node
  }

  async updateHeartbeat(id: string, metrics: NodeMetrics): Promise<Node | null> {
    const node = this.nodes.get(id)
    if (!node) return null

    node.lastHeartbeat = new Date()
    node.metrics = metrics
    node.status = "active"

    this.nodes.set(id, node)
    return node
  }

  async updateNodeStatus(id: string, status: Node["status"]): Promise<Node | null> {
    const node = this.nodes.get(id)
    if (!node) return null

    // Update status index
    this.statusIndex.get(node.status)?.delete(id)
    if (!this.statusIndex.has(status)) {
      this.statusIndex.set(status, new Set())
    }
    this.statusIndex.get(status)!.add(id)

    node.status = status
    this.nodes.set(id, node)

    return node
  }

  async findById(id: string): Promise<Node | null> {
    return this.nodes.get(id) || null
  }

  async findByType(type: string): Promise<Node[]> {
    const nodeIds = this.typeIndex.get(type)
    if (!nodeIds) return []

    return Array.from(nodeIds)
      .map((id) => this.nodes.get(id))
      .filter((node): node is Node => node !== undefined)
  }

  async findByStatus(status: string): Promise<Node[]> {
    const nodeIds = this.statusIndex.get(status)
    if (!nodeIds) return []

    return Array.from(nodeIds)
      .map((id) => this.nodes.get(id))
      .filter((node): node is Node => node !== undefined)
  }

  async listAll(filters?: { type?: string; status?: string }): Promise<Node[]> {
    let nodes = Array.from(this.nodes.values())

    if (filters?.type) {
      nodes = nodes.filter((node) => node.type === filters.type)
    }

    if (filters?.status) {
      nodes = nodes.filter((node) => node.status === filters.status)
    }

    return nodes
  }

  async getActiveNodes(): Promise<Node[]> {
    return this.findByStatus("active")
  }

  async checkStaleNodes(timeoutMs: number): Promise<string[]> {
    const now = Date.now()
    const staleNodes: string[] = []

    for (const [id, node] of this.nodes.entries()) {
      if (node.status === "active") {
        const timeSinceHeartbeat = now - node.lastHeartbeat.getTime()
        if (timeSinceHeartbeat > timeoutMs) {
          staleNodes.push(id)
          await this.updateNodeStatus(id, "failed")
        }
      }
    }

    return staleNodes
  }
}

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import path from "path"
import { NodeDatabase } from "./database"
import { LeaderElection } from "./leader-election"
import { HealthMonitor } from "./health-monitor"
import { Logger } from "@distributed/utils"

const logger = new Logger("NodeService")

// Load proto file
const PROTO_PATH = path.join(__dirname, "../../../proto/node.proto")
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const nodeProto = grpc.loadPackageDefinition(packageDefinition).node as any

// Initialize components
const db = new NodeDatabase()
const leaderElection = new LeaderElection(Number.parseInt(process.env.ELECTION_TIMEOUT || "10000"))
const healthMonitor = new HealthMonitor(db, leaderElection, Number.parseInt(process.env.HEARTBEAT_INTERVAL || "15000"))

// Start health monitoring
healthMonitor.start()

// gRPC service implementation
const nodeService = {
  async RegisterNode(call: any, callback: any) {
    try {
      const { node_id, node_type, address, port } = call.request

      logger.info("Register node request", { nodeId: node_id, nodeType: node_type, address, port })

      const node = await db.registerNode(node_id, node_type, address, port)

      // If this is the first node, make it the leader
      const activeNodes = await db.getActiveNodes()
      if (activeNodes.length === 1) {
        leaderElection.electLeader(node_id, 1, [node_id])
      }

      callback(null, {
        success: true,
        message: "Node registered successfully",
        leader_id: leaderElection.getCurrentLeader() || "",
      })

      logger.info("Node registered", { nodeId: node_id, leader: leaderElection.getCurrentLeader() })
    } catch (error: any) {
      logger.error("RegisterNode failed", { error: error.message })
      callback(null, {
        success: false,
        message: error.message,
        leader_id: "",
      })
    }
  },

  async Heartbeat(call: any, callback: any) {
    try {
      const { node_id, metrics } = call.request

      const node = await db.updateHeartbeat(node_id, {
        cpuUsage: metrics.cpu_usage,
        memoryUsage: metrics.memory_usage,
        activeConnections: metrics.active_connections,
        requestsPerMinute: metrics.requests_per_minute,
      })

      if (!node) {
        callback(null, {
          success: false,
          leader_id: "",
          active_nodes: [],
        })
        return
      }

      const activeNodes = await db.getActiveNodes()
      const activeNodeIds = activeNodes.map((n) => n.id)

      callback(null, {
        success: true,
        leader_id: leaderElection.getCurrentLeader() || "",
        active_nodes: activeNodeIds,
      })
    } catch (error: any) {
      logger.error("Heartbeat failed", { error: error.message })
      callback(null, {
        success: false,
        leader_id: "",
        active_nodes: [],
      })
    }
  },

  async GetNodeStatus(call: any, callback: any) {
    try {
      const { node_id } = call.request
      const node = await db.findById(node_id)

      if (!node) {
        callback(null, {
          node: null,
          success: false,
        })
        return
      }

      callback(null, {
        node: {
          node_id: node.id,
          node_type: node.type,
          address: node.address,
          port: node.port,
          status: node.status,
          last_heartbeat: node.lastHeartbeat.toISOString(),
          metrics: {
            cpu_usage: node.metrics.cpuUsage,
            memory_usage: node.metrics.memoryUsage,
            active_connections: node.metrics.activeConnections,
            requests_per_minute: node.metrics.requestsPerMinute,
          },
        },
        success: true,
      })
    } catch (error: any) {
      logger.error("GetNodeStatus failed", { error: error.message })
      callback(error)
    }
  },

  async ListNodes(call: any, callback: any) {
    try {
      const { node_type, status } = call.request

      const filters: { type?: string; status?: string } = {}
      if (node_type) filters.type = node_type
      if (status) filters.status = status

      const nodes = await db.listAll(filters)

      const nodeList = nodes.map((node) => ({
        node_id: node.id,
        node_type: node.type,
        address: node.address,
        port: node.port,
        status: node.status,
        last_heartbeat: node.lastHeartbeat.toISOString(),
        metrics: {
          cpu_usage: node.metrics.cpuUsage,
          memory_usage: node.metrics.memoryUsage,
          active_connections: node.metrics.activeConnections,
          requests_per_minute: node.metrics.requestsPerMinute,
        },
      }))

      callback(null, {
        nodes: nodeList,
        total: nodes.length,
      })
    } catch (error: any) {
      logger.error("ListNodes failed", { error: error.message })
      callback(error)
    }
  },

  async ElectLeader(call: any, callback: any) {
    try {
      const { candidate_id, term } = call.request

      logger.info("Leader election request", { candidateId: candidate_id, term })

      const activeNodes = await db.getActiveNodes()
      const activeNodeIds = activeNodes.map((n) => n.id)

      const voteGranted = leaderElection.electLeader(candidate_id, term, activeNodeIds)

      callback(null, {
        vote_granted: voteGranted,
        current_leader: leaderElection.getCurrentLeader() || "",
        term: leaderElection.getCurrentTerm(),
      })
    } catch (error: any) {
      logger.error("ElectLeader failed", { error: error.message })
      callback(error)
    }
  },

  async GetLeader(call: any, callback: any) {
    try {
      const leader = leaderElection.getCurrentLeader()
      const term = leaderElection.getCurrentTerm()

      callback(null, {
        leader_id: leader || "",
        term,
        success: leader !== null,
      })
    } catch (error: any) {
      logger.error("GetLeader failed", { error: error.message })
      callback(error)
    }
  },
}

// Start server
function startServer() {
  const server = new grpc.Server()
  server.addService(nodeProto.NodeService.service, nodeService)

  const port = process.env.NODE_SERVICE_PORT || "50054"
  const host = "0.0.0.0"

  server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      logger.error("Failed to start server", { error: error.message })
      return
    }
    logger.info(`Node Service started on port ${port}`)
  })
}

// Periodic health report
setInterval(async () => {
  const report = await healthMonitor.getHealthReport()
  logger.info("Health report", report)
}, 30000) // Every 30 seconds

process.on("SIGINT", () => {
  logger.info("Shutting down Node Service")
  healthMonitor.stop()
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Shutting down Node Service")
  healthMonitor.stop()
  process.exit(0)
})

startServer()

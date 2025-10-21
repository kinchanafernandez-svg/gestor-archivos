import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import path from "path"
import { LoadBalancer } from "./load-balancer"
import { Logger } from "@distributed/utils"

const logger = new Logger("LoadBalancerService")

// Load proto file
const PROTO_PATH = path.join(__dirname, "../../../proto/loadbalancer.proto")
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const loadbalancerProto = grpc.loadPackageDefinition(packageDefinition).loadbalancer as any

// Initialize load balancer
const loadBalancer = new LoadBalancer()

// Register mock nodes for demonstration
loadBalancer.registerNode("user", "user-node-1", "user-service-1", 50051)
loadBalancer.registerNode("user", "user-node-2", "user-service-2", 50051)
loadBalancer.registerNode("file", "file-node-1", "file-service-1", 50052)
loadBalancer.registerNode("file", "file-node-2", "file-service-2", 50052)
loadBalancer.registerNode("auditor", "auditor-node-1", "auditor-service-1", 50053)

// gRPC service implementation
const loadbalancerService = {
  async RouteRequest(call: any, callback: any) {
    try {
      const { service_type, request_id } = call.request

      logger.debug("Route request", { serviceType: service_type, requestId: request_id })

      const node = loadBalancer.selectNode(service_type, "round-robin")

      if (!node) {
        callback(null, {
          node_id: "",
          address: "",
          port: 0,
          success: false,
        })
        return
      }

      callback(null, {
        node_id: node.nodeId,
        address: node.address,
        port: node.port,
        success: true,
      })

      logger.debug("Request routed", {
        serviceType: service_type,
        nodeId: node.nodeId,
        address: node.address,
      })
    } catch (error: any) {
      logger.error("RouteRequest failed", { error: error.message })
      callback(null, {
        node_id: "",
        address: "",
        port: 0,
        success: false,
      })
    }
  },

  async GetNodeHealth(call: any, callback: any) {
    try {
      const { service_type } = call.request

      const nodes = loadBalancer.getNodeHealth(service_type)

      const nodeList = nodes.map((node) => ({
        node_id: node.nodeId,
        address: node.address,
        port: node.port,
        health_score: node.healthScore,
        active_connections: node.activeConnections,
      }))

      callback(null, {
        nodes: nodeList,
      })

      logger.debug("Node health retrieved", { serviceType: service_type, nodeCount: nodes.length })
    } catch (error: any) {
      logger.error("GetNodeHealth failed", { error: error.message })
      callback(error)
    }
  },

  async UpdateNodeWeight(call: any, callback: any) {
    try {
      const { node_id, weight } = call.request

      logger.info("Update node weight request", { nodeId: node_id, weight })

      const success = loadBalancer.updateNodeWeight(node_id, weight)

      callback(null, {
        success,
        message: success ? "Node weight updated successfully" : "Node not found",
      })
    } catch (error: any) {
      logger.error("UpdateNodeWeight failed", { error: error.message })
      callback(null, {
        success: false,
        message: error.message,
      })
    }
  },
}

// Start server
function startServer() {
  const server = new grpc.Server()
  server.addService(loadbalancerProto.LoadBalancerService.service, loadbalancerService)

  const port = process.env.LOADBALANCER_SERVICE_PORT || "50056"
  const host = "0.0.0.0"

  server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      logger.error("Failed to start server", { error: error.message })
      return
    }
    logger.info(`Load Balancer Service started on port ${port}`)
  })
}

// Periodic health check simulation
setInterval(() => {
  const allNodes = loadBalancer.getAllNodes()
  for (const [serviceType, nodes] of allNodes.entries()) {
    nodes.forEach((node) => {
      // Simulate health score fluctuation
      const healthScore = 0.7 + Math.random() * 0.3
      const activeConnections = Math.floor(Math.random() * 100)
      loadBalancer.updateNodeHealth(serviceType, node.nodeId, healthScore, activeConnections)
    })
  }
}, 10000) // Every 10 seconds

process.on("SIGINT", () => {
  logger.info("Shutting down Load Balancer Service")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Shutting down Load Balancer Service")
  process.exit(0)
})

startServer()

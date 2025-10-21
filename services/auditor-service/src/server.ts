import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import path from "path"
import { AuditDatabase } from "./database"
import { AuditReplicationManager } from "./replication"
import { Logger } from "@distributed/utils"

const logger = new Logger("AuditorService")

// Load proto file
const PROTO_PATH = path.join(__dirname, "../../../proto/auditor.proto")
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const auditorProto = grpc.loadPackageDefinition(packageDefinition).auditor as any

// Initialize components
const db = new AuditDatabase()
const replicationManager = new AuditReplicationManager()

// Mock replica nodes (in production, this would come from node service)
replicationManager.setReplicaNodes(["node-1:50053", "node-2:50053"])

// gRPC service implementation
const auditorService = {
  async LogEvent(call: any, callback: any) {
    try {
      const { user_id, action, resource, resource_id, status, details, ip_address } = call.request

      logger.info("Log event request", {
        userId: user_id,
        action,
        resource,
        status,
      })

      const log = await db.createLog(user_id, action, resource, resource_id, status, details, ip_address)

      // Replicate log asynchronously
      replicationManager.replicateLog(log).catch((error) => {
        logger.error("Background replication failed", { logId: log.id, error: error.message })
      })

      callback(null, {
        log_id: log.id,
        success: true,
      })

      logger.debug("Event logged", { logId: log.id })
    } catch (error: any) {
      logger.error("LogEvent failed", { error: error.message })
      callback(null, {
        log_id: "",
        success: false,
      })
    }
  },

  async GetLogs(call: any, callback: any) {
    try {
      const { page, limit, action, status } = call.request

      const filters: { action?: string; status?: string } = {}
      if (action) filters.action = action
      if (status) filters.status = status

      const { logs, total } = await db.findAll(page || 1, limit || 10, filters)

      const logList = logs.map((log) => ({
        log_id: log.id,
        user_id: log.userId,
        action: log.action,
        resource: log.resource,
        resource_id: log.resourceId,
        status: log.status,
        details: log.details,
        ip_address: log.ipAddress,
        timestamp: log.timestamp.toISOString(),
      }))

      callback(null, {
        logs: logList,
        total,
      })

      logger.debug("Logs retrieved", { count: logs.length, total })
    } catch (error: any) {
      logger.error("GetLogs failed", { error: error.message })
      callback(error)
    }
  },

  async GetUserLogs(call: any, callback: any) {
    try {
      const { user_id, page, limit } = call.request

      const { logs, total } = await db.findByUserId(user_id, page || 1, limit || 10)

      const logList = logs.map((log) => ({
        log_id: log.id,
        user_id: log.userId,
        action: log.action,
        resource: log.resource,
        resource_id: log.resourceId,
        status: log.status,
        details: log.details,
        ip_address: log.ipAddress,
        timestamp: log.timestamp.toISOString(),
      }))

      callback(null, {
        logs: logList,
        total,
      })

      logger.debug("User logs retrieved", { userId: user_id, count: logs.length })
    } catch (error: any) {
      logger.error("GetUserLogs failed", { error: error.message })
      callback(error)
    }
  },

  async ReplicateLog(call: any, callback: any) {
    try {
      const { log, target_node } = call.request

      logger.info("Replicate log request", {
        logId: log.log_id,
        targetNode: target_node,
      })

      // Import the replicated log
      const auditLog = {
        id: log.log_id,
        userId: log.user_id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resource_id,
        status: log.status as "success" | "failure",
        details: log.details,
        ipAddress: log.ip_address,
        timestamp: new Date(log.timestamp),
      }

      db.importData([auditLog])

      callback(null, {
        success: true,
        message: "Log replicated successfully",
      })

      logger.info("Log replicated", { logId: log.log_id })
    } catch (error: any) {
      logger.error("ReplicateLog failed", { error: error.message })
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
  server.addService(auditorProto.AuditorService.service, auditorService)

  const port = process.env.AUDITOR_SERVICE_PORT || "50053"
  const host = "0.0.0.0"

  server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      logger.error("Failed to start server", { error: error.message })
      return
    }
    logger.info(`Auditor Service started on port ${port}`)
  })
}

// Periodic statistics logging
setInterval(async () => {
  const stats = await db.getStatistics()
  logger.info("Audit statistics", stats)
}, 60000) // Every minute

process.on("SIGINT", () => {
  logger.info("Shutting down Auditor Service")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Shutting down Auditor Service")
  process.exit(0)
})

startServer()

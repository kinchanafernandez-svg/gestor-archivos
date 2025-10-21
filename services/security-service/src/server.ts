import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import path from "path"
import { RBACManager } from "./rbac"
import { JWTManager, Logger } from "@distributed/utils"

const logger = new Logger("SecurityService")

// Load proto file
const PROTO_PATH = path.join(__dirname, "../../../proto/security.proto")
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const securityProto = grpc.loadPackageDefinition(packageDefinition).security as any

// Initialize components
const jwtManager = new JWTManager(process.env.JWT_SECRET || "default-secret")
const rbacManager = new RBACManager()

// gRPC service implementation
const securityService = {
  async ValidateToken(call: any, callback: any) {
    try {
      const { token } = call.request

      // Check if token is revoked
      if (rbacManager.isTokenRevoked(token)) {
        callback(null, {
          valid: false,
          user_id: "",
          role: "",
          message: "Token has been revoked",
        })
        return
      }

      // Verify JWT
      const payload = jwtManager.verifyToken(token)
      if (!payload) {
        callback(null, {
          valid: false,
          user_id: "",
          role: "",
          message: "Invalid or expired token",
        })
        return
      }

      callback(null, {
        valid: true,
        user_id: payload.userId,
        role: payload.role,
        message: "Token is valid",
      })

      logger.debug("Token validated", { userId: payload.userId, role: payload.role })
    } catch (error: any) {
      logger.error("ValidateToken failed", { error: error.message })
      callback(null, {
        valid: false,
        user_id: "",
        role: "",
        message: error.message,
      })
    }
  },

  async CheckPermission(call: any, callback: any) {
    try {
      const { user_id, role, resource, action } = call.request

      logger.debug("Permission check", { userId: user_id, role, resource, action })

      const allowed = rbacManager.checkPermission(role, resource, action)

      callback(null, {
        allowed,
        message: allowed ? "Permission granted" : "Permission denied",
      })

      if (!allowed) {
        logger.warn("Permission denied", { userId: user_id, role, resource, action })
      }
    } catch (error: any) {
      logger.error("CheckPermission failed", { error: error.message })
      callback(null, {
        allowed: false,
        message: error.message,
      })
    }
  },

  async RevokeToken(call: any, callback: any) {
    try {
      const { token, user_id } = call.request

      logger.info("Revoke token request", { userId: user_id })

      rbacManager.revokeToken(token)

      callback(null, {
        success: true,
        message: "Token revoked successfully",
      })
    } catch (error: any) {
      logger.error("RevokeToken failed", { error: error.message })
      callback(null, {
        success: false,
        message: error.message,
      })
    }
  },

  async GetSecurityPolicy(call: any, callback: any) {
    try {
      const { role } = call.request

      const permissions = rbacManager.getPermissions(role)

      const permissionList = permissions.map((p) => ({
        resource: p.resource,
        actions: p.actions,
      }))

      callback(null, {
        permissions: permissionList,
      })

      logger.debug("Security policy retrieved", { role, permissionCount: permissions.length })
    } catch (error: any) {
      logger.error("GetSecurityPolicy failed", { error: error.message })
      callback(error)
    }
  },
}

// Start server
function startServer() {
  const server = new grpc.Server()
  server.addService(securityProto.SecurityService.service, securityService)

  const port = process.env.SECURITY_SERVICE_PORT || "50055"
  const host = "0.0.0.0"

  server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      logger.error("Failed to start server", { error: error.message })
      return
    }
    logger.info(`Security Service started on port ${port}`)
  })
}

process.on("SIGINT", () => {
  logger.info("Shutting down Security Service")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Shutting down Security Service")
  process.exit(0)
})

startServer()

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import path from "path"
import { UserDatabase } from "./database"
import { JWTManager, Logger, CryptoManager } from "@distributed/utils"

const logger = new Logger("UserService")

// Load proto file
const PROTO_PATH = path.join(__dirname, "../../../proto/user.proto")
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const userProto = grpc.loadPackageDefinition(packageDefinition).user as any

// Initialize database and JWT manager
const db = new UserDatabase()
const jwtManager = new JWTManager(process.env.JWT_SECRET || "default-secret")

// gRPC service implementation
const userService = {
  async Register(call: any, callback: any) {
    try {
      const { username, email, password, role } = call.request
      logger.info("Register request", { username, email, role })

      const user = await db.createUser(username, email, password, role || "user")

      callback(null, {
        user_id: user.id,
        message: "User registered successfully",
        success: true,
      })

      logger.info("User registered", { userId: user.id })
    } catch (error: any) {
      logger.error("Registration failed", { error: error.message })
      callback(null, {
        user_id: "",
        message: error.message,
        success: false,
      })
    }
  },

  async Login(call: any, callback: any) {
    try {
      const { email, password } = call.request
      logger.info("Login request", { email })

      const user = await db.findByEmail(email)
      if (!user) {
        callback(null, {
          token: "",
          user_id: "",
          username: "",
          role: "",
          success: false,
        })
        return
      }

      const isValid = await CryptoManager.comparePassword(password, user.password)
      if (!isValid) {
        callback(null, {
          token: "",
          user_id: "",
          username: "",
          role: "",
          success: false,
        })
        return
      }

      const token = jwtManager.generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      })

      callback(null, {
        token,
        user_id: user.id,
        username: user.username,
        role: user.role,
        success: true,
      })

      logger.info("User logged in", { userId: user.id })
    } catch (error: any) {
      logger.error("Login failed", { error: error.message })
      callback(null, {
        token: "",
        user_id: "",
        username: "",
        role: "",
        success: false,
      })
    }
  },

  async GetUser(call: any, callback: any) {
    try {
      const { user_id } = call.request
      const user = await db.findById(user_id)

      if (!user) {
        callback(new Error("User not found"))
        return
      }

      callback(null, {
        user_id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.createdAt.toISOString(),
      })
    } catch (error: any) {
      logger.error("GetUser failed", { error: error.message })
      callback(error)
    }
  },

  async UpdateUser(call: any, callback: any) {
    try {
      const { user_id, username, email } = call.request
      const user = await db.updateUser(user_id, { username, email })

      if (!user) {
        callback(null, {
          success: false,
          message: "User not found",
        })
        return
      }

      callback(null, {
        success: true,
        message: "User updated successfully",
      })

      logger.info("User updated", { userId: user_id })
    } catch (error: any) {
      logger.error("UpdateUser failed", { error: error.message })
      callback(null, {
        success: false,
        message: error.message,
      })
    }
  },

  async DeleteUser(call: any, callback: any) {
    try {
      const { user_id } = call.request
      const success = await db.deleteUser(user_id)

      callback(null, {
        success,
        message: success ? "User deleted successfully" : "User not found",
      })

      if (success) {
        logger.info("User deleted", { userId: user_id })
      }
    } catch (error: any) {
      logger.error("DeleteUser failed", { error: error.message })
      callback(null, {
        success: false,
        message: error.message,
      })
    }
  },

  async ListUsers(call: any, callback: any) {
    try {
      const { page, limit } = call.request
      const { users, total } = await db.listUsers(page || 1, limit || 10)

      const userList = users.map((user) => ({
        user_id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.createdAt.toISOString(),
      }))

      callback(null, {
        users: userList,
        total,
      })
    } catch (error: any) {
      logger.error("ListUsers failed", { error: error.message })
      callback(error)
    }
  },
}

// Start server
function startServer() {
  const server = new grpc.Server()
  server.addService(userProto.UserService.service, userService)

  const port = process.env.USER_SERVICE_PORT || "50051"
  const host = "0.0.0.0"

  server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      logger.error("Failed to start server", { error: error.message })
      return
    }
    logger.info(`User Service started on port ${port}`)
  })
}

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down User Service")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Shutting down User Service")
  process.exit(0)
})

startServer()

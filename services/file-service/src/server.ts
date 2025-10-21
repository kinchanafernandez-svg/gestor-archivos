import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import path from "path"
import { FileDatabase } from "./database"
import { FileStorage } from "./storage"
import { ReplicationManager } from "./replication"
import { Logger } from "@distributed/utils"

const logger = new Logger("FileService")

// Load proto file
const PROTO_PATH = path.join(__dirname, "../../../proto/file.proto")
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const fileProto = grpc.loadPackageDefinition(packageDefinition).file as any

// Initialize components
const db = new FileDatabase()
const storage = new FileStorage(process.env.FILE_STORAGE_PATH || "/tmp/files")
const replicationManager = new ReplicationManager(Number.parseInt(process.env.REPLICATION_FACTOR || "3"))

// Initialize storage
storage.initialize().then(() => {
  logger.info("File storage initialized")
})

// Mock available nodes (in production, this would come from node service)
replicationManager.setAvailableNodes(["node-1:50052", "node-2:50052", "node-3:50052"])

// gRPC service implementation
const fileService = {
  async UploadFile(call: any, callback: any) {
    try {
      const { filename, content, user_id, mime_type } = call.request
      logger.info("Upload file request", { filename, userId: user_id, size: content.length })

      // Save file to storage
      const fileId = await storage.saveFile(filename, Buffer.from(content))

      // Replicate file to other nodes
      const replicaNodes = await replicationManager.replicateFile(fileId, Buffer.from(content), {
        id: fileId,
        filename,
        userId: user_id,
        size: content.length,
        mimeType: mime_type,
        path: fileId,
        replicaNodes: [],
        createdAt: new Date(),
      })

      // Save metadata to database
      const file = await db.createFile(filename, user_id, content.length, mime_type, fileId, replicaNodes)

      callback(null, {
        file_id: file.id,
        message: "File uploaded successfully",
        success: true,
        replica_nodes: replicaNodes,
      })

      logger.info("File uploaded", { fileId: file.id, replicas: replicaNodes.length })
    } catch (error: any) {
      logger.error("Upload failed", { error: error.message })
      callback(null, {
        file_id: "",
        message: error.message,
        success: false,
        replica_nodes: [],
      })
    }
  },

  async DownloadFile(call: any, callback: any) {
    try {
      const { file_id, user_id } = call.request
      logger.info("Download file request", { fileId: file_id, userId: user_id })

      const file = await db.findById(file_id)
      if (!file) {
        callback(null, {
          filename: "",
          content: Buffer.from([]),
          mime_type: "",
          success: false,
        })
        return
      }

      // Check ownership
      if (file.userId !== user_id) {
        callback(null, {
          filename: "",
          content: Buffer.from([]),
          mime_type: "",
          success: false,
        })
        return
      }

      const content = await storage.getFile(file.path)

      callback(null, {
        filename: file.filename,
        content,
        mime_type: file.mimeType,
        success: true,
      })

      logger.info("File downloaded", { fileId: file_id })
    } catch (error: any) {
      logger.error("Download failed", { error: error.message })
      callback(null, {
        filename: "",
        content: Buffer.from([]),
        mime_type: "",
        success: false,
      })
    }
  },

  async DeleteFile(call: any, callback: any) {
    try {
      const { file_id, user_id } = call.request
      logger.info("Delete file request", { fileId: file_id, userId: user_id })

      const file = await db.findById(file_id)
      if (!file || file.userId !== user_id) {
        callback(null, {
          success: false,
          message: "File not found or unauthorized",
        })
        return
      }

      await storage.deleteFile(file.path)
      await db.deleteFile(file_id)

      callback(null, {
        success: true,
        message: "File deleted successfully",
      })

      logger.info("File deleted", { fileId: file_id })
    } catch (error: any) {
      logger.error("Delete failed", { error: error.message })
      callback(null, {
        success: false,
        message: error.message,
      })
    }
  },

  async ListFiles(call: any, callback: any) {
    try {
      const { user_id, page, limit } = call.request
      const { files, total } = await db.findByUserId(user_id, page || 1, limit || 10)

      const fileList = files.map((file) => ({
        file_id: file.id,
        filename: file.filename,
        user_id: file.userId,
        size: file.size,
        mime_type: file.mimeType,
        created_at: file.createdAt.toISOString(),
        replica_nodes: file.replicaNodes,
      }))

      callback(null, {
        files: fileList,
        total,
      })
    } catch (error: any) {
      logger.error("ListFiles failed", { error: error.message })
      callback(error)
    }
  },

  async GetFileMetadata(call: any, callback: any) {
    try {
      const { file_id } = call.request
      const file = await db.findById(file_id)

      if (!file) {
        callback(null, {
          metadata: null,
          success: false,
        })
        return
      }

      callback(null, {
        metadata: {
          file_id: file.id,
          filename: file.filename,
          user_id: file.userId,
          size: file.size,
          mime_type: file.mimeType,
          created_at: file.createdAt.toISOString(),
          replica_nodes: file.replicaNodes,
        },
        success: true,
      })
    } catch (error: any) {
      logger.error("GetFileMetadata failed", { error: error.message })
      callback(error)
    }
  },

  async ReplicateFile(call: any, callback: any) {
    try {
      const { file_id, target_node, content, metadata } = call.request
      logger.info("Replicate file request", { fileId: file_id, targetNode: target_node })

      // Save replicated file
      await storage.saveFile(file_id, Buffer.from(content))

      // Update metadata if file exists in database
      const existingFile = await db.findById(file_id)
      if (existingFile) {
        const updatedReplicas = [...existingFile.replicaNodes, target_node]
        await db.updateReplicaNodes(file_id, updatedReplicas)
      }

      callback(null, {
        success: true,
        message: "File replicated successfully",
      })

      logger.info("File replicated", { fileId: file_id })
    } catch (error: any) {
      logger.error("Replication failed", { error: error.message })
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
  server.addService(fileProto.FileService.service, fileService)

  const port = process.env.FILE_SERVICE_PORT || "50052"
  const host = "0.0.0.0"

  server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      logger.error("Failed to start server", { error: error.message })
      return
    }
    logger.info(`File Service started on port ${port}`)
  })
}

process.on("SIGINT", () => {
  logger.info("Shutting down File Service")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Shutting down File Service")
  process.exit(0)
})

startServer()

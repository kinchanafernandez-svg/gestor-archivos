export interface User {
  id: string
  username: string
  email: string
  password: string
  role: "admin" | "user" | "guest"
  createdAt: Date
  updatedAt: Date
}

export interface File {
  id: string
  filename: string
  userId: string
  size: number
  mimeType: string
  path: string
  replicaNodes: string[]
  createdAt: Date
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  status: "success" | "failure"
  details: string
  ipAddress: string
  timestamp: Date
}

export interface Node {
  id: string
  type: "user" | "file" | "auditor" | "security" | "loadbalancer"
  address: string
  port: number
  status: "active" | "inactive" | "failed"
  lastHeartbeat: Date
  metrics: NodeMetrics
}

export interface NodeMetrics {
  cpuUsage: number
  memoryUsage: number
  activeConnections: number
  requestsPerMinute: number
}

export interface JWTPayload {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}

export interface ServiceConfig {
  nodeId: string
  port: number
  grpcPort: number
  dbUrl: string
  jwtSecret: string
  replicationFactor: number
  heartbeatInterval: number
}

import { Logger } from "@distributed/utils"

interface Permission {
  resource: string
  actions: string[]
}

interface Role {
  name: string
  permissions: Permission[]
}

export class RBACManager {
  private logger: Logger
  private roles: Map<string, Role>
  private revokedTokens: Set<string>

  constructor() {
    this.logger = new Logger("RBACManager")
    this.roles = new Map()
    this.revokedTokens = new Set()
    this.initializeDefaultRoles()
  }

  private initializeDefaultRoles(): void {
    // Admin role - full access
    this.roles.set("admin", {
      name: "admin",
      permissions: [
        { resource: "user", actions: ["create", "read", "update", "delete", "list"] },
        { resource: "file", actions: ["upload", "download", "delete", "list", "replicate"] },
        { resource: "audit", actions: ["read", "list"] },
        { resource: "node", actions: ["register", "read", "list", "update"] },
        { resource: "security", actions: ["validate", "revoke", "manage"] },
      ],
    })

    // User role - limited access
    this.roles.set("user", {
      name: "user",
      permissions: [
        { resource: "user", actions: ["read", "update"] },
        { resource: "file", actions: ["upload", "download", "delete", "list"] },
        { resource: "audit", actions: ["read"] },
      ],
    })

    // Guest role - minimal access
    this.roles.set("guest", {
      name: "guest",
      permissions: [
        { resource: "user", actions: ["read"] },
        { resource: "file", actions: ["list"] },
      ],
    })

    this.logger.info("Default RBAC roles initialized", { roleCount: this.roles.size })
  }

  checkPermission(role: string, resource: string, action: string): boolean {
    const roleData = this.roles.get(role)
    if (!roleData) {
      this.logger.warn("Unknown role", { role })
      return false
    }

    const permission = roleData.permissions.find((p) => p.resource === resource)
    if (!permission) {
      return false
    }

    return permission.actions.includes(action)
  }

  getPermissions(role: string): Permission[] {
    const roleData = this.roles.get(role)
    return roleData ? roleData.permissions : []
  }

  revokeToken(token: string): void {
    this.revokedTokens.add(token)
    this.logger.info("Token revoked", { tokenPrefix: token.substring(0, 10) })
  }

  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token)
  }

  addRole(name: string, permissions: Permission[]): void {
    this.roles.set(name, { name, permissions })
    this.logger.info("Role added", { role: name })
  }
}

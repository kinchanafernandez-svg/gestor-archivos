import type { User } from "@distributed/types"
import { CryptoManager } from "@distributed/utils"

// In-memory database with replication support
export class UserDatabase {
  private users: Map<string, User>
  private emailIndex: Map<string, string>

  constructor() {
    this.users = new Map()
    this.emailIndex = new Map()
  }

  async createUser(username: string, email: string, password: string, role: "admin" | "user" | "guest"): Promise<User> {
    if (this.emailIndex.has(email)) {
      throw new Error("Email already exists")
    }

    const hashedPassword = await CryptoManager.hashPassword(password)
    const user: User = {
      id: CryptoManager.generateId(),
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.users.set(user.id, user)
    this.emailIndex.set(email, user.id)

    return user
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email)
    if (!userId) return null
    return this.users.get(userId) || null
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null
  }

  async updateUser(id: string, updates: Partial<Pick<User, "username" | "email">>): Promise<User | null> {
    const user = this.users.get(id)
    if (!user) return null

    if (updates.email && updates.email !== user.email) {
      if (this.emailIndex.has(updates.email)) {
        throw new Error("Email already exists")
      }
      this.emailIndex.delete(user.email)
      this.emailIndex.set(updates.email, id)
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    }

    this.users.set(id, updatedUser)
    return updatedUser
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = this.users.get(id)
    if (!user) return false

    this.emailIndex.delete(user.email)
    this.users.delete(id)
    return true
  }

  async listUsers(page = 1, limit = 10): Promise<{ users: User[]; total: number }> {
    const allUsers = Array.from(this.users.values())
    const start = (page - 1) * limit
    const end = start + limit
    const users = allUsers.slice(start, end)

    return { users, total: allUsers.length }
  }

  // Replication methods
  exportData(): User[] {
    return Array.from(this.users.values())
  }

  importData(users: User[]): void {
    users.forEach((user) => {
      this.users.set(user.id, user)
      this.emailIndex.set(user.email, user.id)
    })
  }
}

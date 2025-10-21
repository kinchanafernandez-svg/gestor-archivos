import type { File } from "@distributed/types"
import { CryptoManager } from "@distributed/utils"

export class FileDatabase {
  private files: Map<string, File>
  private userIndex: Map<string, Set<string>>

  constructor() {
    this.files = new Map()
    this.userIndex = new Map()
  }

  async createFile(
    filename: string,
    userId: string,
    size: number,
    mimeType: string,
    path: string,
    replicaNodes: string[],
  ): Promise<File> {
    const file: File = {
      id: CryptoManager.generateId(),
      filename,
      userId,
      size,
      mimeType,
      path,
      replicaNodes,
      createdAt: new Date(),
    }

    this.files.set(file.id, file)

    if (!this.userIndex.has(userId)) {
      this.userIndex.set(userId, new Set())
    }
    this.userIndex.get(userId)!.add(file.id)

    return file
  }

  async findById(id: string): Promise<File | null> {
    return this.files.get(id) || null
  }

  async findByUserId(userId: string, page = 1, limit = 10): Promise<{ files: File[]; total: number }> {
    const fileIds = this.userIndex.get(userId)
    if (!fileIds) {
      return { files: [], total: 0 }
    }

    const allFiles = Array.from(fileIds)
      .map((id) => this.files.get(id))
      .filter((f): f is File => f !== undefined)

    const start = (page - 1) * limit
    const end = start + limit
    const files = allFiles.slice(start, end)

    return { files, total: allFiles.length }
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = this.files.get(id)
    if (!file) return false

    this.files.delete(id)
    this.userIndex.get(file.userId)?.delete(id)

    return true
  }

  async updateReplicaNodes(id: string, replicaNodes: string[]): Promise<boolean> {
    const file = this.files.get(id)
    if (!file) return false

    file.replicaNodes = replicaNodes
    this.files.set(id, file)

    return true
  }

  exportData(): File[] {
    return Array.from(this.files.values())
  }

  importData(files: File[]): void {
    files.forEach((file) => {
      this.files.set(file.id, file)
      if (!this.userIndex.has(file.userId)) {
        this.userIndex.set(file.userId, new Set())
      }
      this.userIndex.get(file.userId)!.add(file.id)
    })
  }
}

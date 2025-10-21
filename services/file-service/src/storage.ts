import fs from "fs/promises"
import path from "path"

export class FileStorage {
  private storagePath: string

  constructor(storagePath: string) {
    this.storagePath = storagePath
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true })
    } catch (error) {
      console.error("Failed to initialize storage:", error)
    }
  }

  async saveFile(fileId: string, content: Buffer): Promise<string> {
    const filePath = path.join(this.storagePath, fileId)
    await fs.writeFile(filePath, content)
    return filePath
  }

  async getFile(fileId: string): Promise<Buffer> {
    const filePath = path.join(this.storagePath, fileId)
    return await fs.readFile(filePath)
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.storagePath, fileId)
      await fs.unlink(filePath)
      return true
    } catch (error) {
      return false
    }
  }

  async fileExists(fileId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.storagePath, fileId)
      await fs.access(filePath)
      return true
    } catch (error) {
      return false
    }
  }
}

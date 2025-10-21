import crypto from "crypto"
import bcrypt from "bcrypt"

export class CryptoManager {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  static generateId(): string {
    return crypto.randomUUID()
  }

  static generateToken(length = 32): string {
    return crypto.randomBytes(length).toString("hex")
  }

  static encrypt(text: string, key: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key.padEnd(32, "0").slice(0, 32)), iv)
    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")
    return iv.toString("hex") + ":" + encrypted
  }

  static decrypt(encryptedText: string, key: string): string {
    const parts = encryptedText.split(":")
    const iv = Buffer.from(parts[0], "hex")
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key.padEnd(32, "0").slice(0, 32)), iv)
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  }
}

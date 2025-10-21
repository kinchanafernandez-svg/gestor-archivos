import jwt from "jsonwebtoken"
import type { JWTPayload } from "@distributed/types"

export class JWTManager {
  private secret: string
  private expiresIn: string

  constructor(secret: string, expiresIn = "24h") {
    this.secret = secret
    this.expiresIn = expiresIn
  }

  generateToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn })
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.secret) as JWTPayload
    } catch (error) {
      return null
    }
  }

  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload
    } catch (error) {
      return null
    }
  }
}

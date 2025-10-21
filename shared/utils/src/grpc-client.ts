import * as grpc from "@grpc/grpc-js"
import { Logger } from "./logger"

export class GRPCClientManager {
  private logger: Logger
  private clients: Map<string, any>

  constructor(serviceName: string) {
    this.logger = new Logger(serviceName)
    this.clients = new Map()
  }

  createClient<T>(serviceName: string, serviceDefinition: any, address: string, useTLS = false): T {
    const clientKey = `${serviceName}:${address}`

    if (this.clients.has(clientKey)) {
      return this.clients.get(clientKey)
    }

    const credentials = useTLS ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()

    const client = new serviceDefinition(address, credentials)
    this.clients.set(clientKey, client)

    this.logger.info(`Created gRPC client for ${serviceName} at ${address}`)

    return client
  }

  closeAll() {
    this.clients.forEach((client, key) => {
      if (client.close) {
        client.close()
        this.logger.info(`Closed gRPC client: ${key}`)
      }
    })
    this.clients.clear()
  }
}

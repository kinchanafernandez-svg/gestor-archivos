import { createGrpcClient } from "@distributed/utils"

/**
 * Test client para demostrar el uso del sistema distribuido
 */
class DistributedSystemTestClient {
  private userClient: any
  private fileClient: any
  private auditorClient: any
  private nodeClient: any
  private securityClient: any
  private loadBalancerClient: any
  private token = ""

  constructor() {
    // Conectar a los servicios
    this.userClient = createGrpcClient("localhost:50051")
    this.fileClient = createGrpcClient("localhost:50052")
    this.auditorClient = createGrpcClient("localhost:50053")
    this.nodeClient = createGrpcClient("localhost:50054")
    this.securityClient = createGrpcClient("localhost:50055")
    this.loadBalancerClient = createGrpcClient("localhost:50056")
  }

  async testUserService() {
    console.log("\n=== Testing User Service ===")

    try {
      // Registrar usuario
      console.log("1. Registering user...")
      const registerResponse = await this.userClient.register({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        role: "user",
      })

      this.token = registerResponse.token
      console.log("✓ User registered successfully")
      console.log("  Token:", this.token.substring(0, 20) + "...")

      // Login
      console.log("\n2. Logging in...")
      const loginResponse = await this.userClient.login({
        username: "testuser",
        password: "password123",
      })

      console.log("✓ Login successful")
      console.log("  User ID:", loginResponse.user.id)

      // Obtener usuario
      console.log("\n3. Getting user info...")
      const userResponse = await this.userClient.getUser({
        userId: loginResponse.user.id,
        token: this.token,
      })

      console.log("✓ User info retrieved")
      console.log("  Username:", userResponse.user.username)
      console.log("  Email:", userResponse.user.email)
    } catch (error: any) {
      console.error("✗ User service test failed:", error.message)
    }
  }

  async testFileService() {
    console.log("\n=== Testing File Service ===")

    try {
      // Upload file
      console.log("1. Uploading file...")
      const fileContent = Buffer.from("Hello, distributed world!")
      const uploadResponse = await this.fileClient.uploadFile({
        filename: "test.txt",
        content: fileContent,
        userId: "user-1",
        token: this.token,
      })

      console.log("✓ File uploaded successfully")
      console.log("  File ID:", uploadResponse.fileId)

      // List files
      console.log("\n2. Listing files...")
      const listResponse = await this.fileClient.listFiles({
        userId: "user-1",
        token: this.token,
        page: 1,
        pageSize: 10,
      })

      console.log("✓ Files listed")
      console.log("  Total files:", listResponse.total)

      // Download file
      console.log("\n3. Downloading file...")
      const downloadResponse = await this.fileClient.downloadFile({
        fileId: uploadResponse.fileId,
        userId: "user-1",
        token: this.token,
      })

      console.log("✓ File downloaded")
      console.log("  Content:", downloadResponse.content.toString())
    } catch (error: any) {
      console.error("✗ File service test failed:", error.message)
    }
  }

  async testAuditorService() {
    console.log("\n=== Testing Auditor Service ===")

    try {
      // Log event
      console.log("1. Logging audit event...")
      await this.auditorClient.logEvent({
        userId: "user-1",
        action: "TEST_ACTION",
        resource: "test-resource",
        details: "Test audit log",
        token: this.token,
      })

      console.log("✓ Event logged")

      // Get logs
      console.log("\n2. Retrieving audit logs...")
      const logsResponse = await this.auditorClient.getLogs({
        userId: "user-1",
        token: this.token,
        page: 1,
        pageSize: 10,
      })

      console.log("✓ Logs retrieved")
      console.log("  Total logs:", logsResponse.total)

      // Get statistics
      console.log("\n3. Getting statistics...")
      const statsResponse = await this.auditorClient.getStatistics({
        token: this.token,
      })

      console.log("✓ Statistics retrieved")
      console.log("  Total events:", statsResponse.totalEvents)
    } catch (error: any) {
      console.error("✗ Auditor service test failed:", error.message)
    }
  }

  async testNodeService() {
    console.log("\n=== Testing Node Service ===")

    try {
      // Register node
      console.log("1. Registering node...")
      const registerResponse = await this.nodeClient.registerNode({
        address: "localhost:50051",
        serviceType: "user-service",
        metadata: { version: "1.0.0" },
      })

      console.log("✓ Node registered")
      console.log("  Node ID:", registerResponse.nodeId)

      // Get cluster status
      console.log("\n2. Getting cluster status...")
      const statusResponse = await this.nodeClient.getClusterStatus({
        token: this.token,
      })

      console.log("✓ Cluster status retrieved")
      console.log("  Total nodes:", statusResponse.nodes.length)
      console.log("  Leader:", statusResponse.leaderId)
    } catch (error: any) {
      console.error("✗ Node service test failed:", error.message)
    }
  }

  async testSecurityService() {
    console.log("\n=== Testing Security Service ===")

    try {
      // Validate token
      console.log("1. Validating token...")
      const validateResponse = await this.securityClient.validateToken({
        token: this.token,
      })

      console.log("✓ Token validated")
      console.log("  User ID:", validateResponse.userId)
      console.log("  Role:", validateResponse.role)

      // Check permission
      console.log("\n2. Checking permission...")
      const permissionResponse = await this.securityClient.checkPermission({
        token: this.token,
        resource: "files",
        action: "read",
      })

      console.log("✓ Permission checked")
      console.log("  Allowed:", permissionResponse.allowed)
    } catch (error: any) {
      console.error("✗ Security service test failed:", error.message)
    }
  }

  async testLoadBalancer() {
    console.log("\n=== Testing Load Balancer ===")

    try {
      // Get next node
      console.log("1. Getting next available node...")
      const nodeResponse = await this.loadBalancerClient.getNextNode({
        serviceType: "user-service",
      })

      console.log("✓ Node selected")
      console.log("  Node ID:", nodeResponse.nodeId)
      console.log("  Address:", nodeResponse.address)

      // Get load balancer stats
      console.log("\n2. Getting load balancer statistics...")
      const statsResponse = await this.loadBalancerClient.getStats({
        token: this.token,
      })

      console.log("✓ Statistics retrieved")
      console.log("  Total requests:", statsResponse.totalRequests)
    } catch (error: any) {
      console.error("✗ Load balancer test failed:", error.message)
    }
  }

  async runAllTests() {
    console.log("╔════════════════════════════════════════════════════════╗")
    console.log("║   Distributed System Test Client                      ║")
    console.log("╚════════════════════════════════════════════════════════╝")

    await this.testUserService()
    await this.testFileService()
    await this.testAuditorService()
    await this.testNodeService()
    await this.securityService()
    await this.testLoadBalancer()

    console.log("\n╔════════════════════════════════════════════════════════╗")
    console.log("║   All tests completed!                                 ║")
    console.log("╚════════════════════════════════════════════════════════╝\n")
  }
}

// Ejecutar tests
const client = new DistributedSystemTestClient()
client.runAllTests().catch(console.error)

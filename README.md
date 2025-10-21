# Sistema Distribuido - Node.js + TypeScript + gRPC

Sistema distribuido completo para gestión de usuarios, archivos y auditoría en múltiples servidores con acceso concurrente, replicación de datos, autenticación segura y recuperación ante fallos.

## Arquitectura del Sistema

### Servicios Distribuidos

1. **User Service** (Puerto 50051)
   - Gestión de usuarios (CRUD)
   - Autenticación con JWT
   - Roles: admin, user, guest

2. **File Service** (Puerto 50052)
   - Almacenamiento y gestión de archivos
   - Replicación automática entre nodos
   - Control de acceso por usuario

3. **Auditor Service** (Puerto 50053)
   - Registro de eventos del sistema
   - Auditoría de todas las operaciones
   - Replicación de logs

4. **Node Service** (Puerto 50054)
   - Registro y gestión de nodos
   - Monitoreo de salud (heartbeats)
   - Elección de líder (consenso)
   - Recuperación automática ante fallos

5. **Security Service** (Puerto 50055)
   - Validación de tokens JWT
   - Control de acceso basado en roles (RBAC)
   - Revocación de tokens

6. **Load Balancer Service** (Puerto 50056)
   - Balanceo de carga entre nodos
   - Estrategias: round-robin, least-connections, weighted
   - Monitoreo de salud de nodos

### Infraestructura

- **PostgreSQL**: Base de datos principal
- **Redis**: Caché y gestión de sesiones
- **gRPC**: Comunicación entre servicios
- **Docker**: Contenedorización de servicios

## Requisitos Previos

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (para desarrollo local)
- Make (opcional, para comandos simplificados)

## Instalación y Ejecución

### 1. Clonar el repositorio

\`\`\`bash
git clone <repository-url>
cd distributed-system-monorepo
\`\`\`

### 2. Configurar variables de entorno

\`\`\`bash
cp .env.example .env
# Editar .env con tus valores
\`\`\`

Variables importantes:
- \`JWT_SECRET\`: Clave secreta para JWT (cambiar en producción)
- \`DB_PASSWORD\`: Contraseña de PostgreSQL
- \`REPLICATION_FACTOR\`: Número de réplicas (default: 3)

### 3. Iniciar el sistema

#### Opción A: Usando Make (recomendado)

\`\`\`bash
make build    # Construir imágenes
make up       # Iniciar servicios
make logs     # Ver logs
\`\`\`

#### Opción B: Usando Docker Compose directamente

\`\`\`bash
docker-compose build
docker-compose up -d
docker-compose logs -f
\`\`\`

### 4. Verificar que los servicios están corriendo

\`\`\`bash
docker-compose ps
\`\`\`

Todos los servicios deben estar en estado "Up".

## Uso del Sistema

### Ejemplo: Registro y Login de Usuario

\`\`\`bash
# Usar grpcurl para interactuar con los servicios

# 1. Registrar un usuario
grpcurl -plaintext -d '{
  "username": "admin",
  "email": "admin@example.com",
  "password": "admin123",
  "role": "admin"
}' localhost:50051 user.UserService/Register

# 2. Login
grpcurl -plaintext -d '{
  "email": "admin@example.com",
  "password": "admin123"
}' localhost:50051 user.UserService/Login

# Respuesta incluye el token JWT
\`\`\`

### Ejemplo: Subir un Archivo

\`\`\`bash
# Subir archivo (requiere token JWT del login)
grpcurl -plaintext -d '{
  "filename": "document.pdf",
  "content": "base64_encoded_content",
  "user_id": "user-id-from-login",
  "mime_type": "application/pdf"
}' localhost:50052 file.FileService/UploadFile
\`\`\`

### Ejemplo: Consultar Logs de Auditoría

\`\`\`bash
# Obtener logs de auditoría
grpcurl -plaintext -d '{
  "page": 1,
  "limit": 10
}' localhost:50053 auditor.AuditorService/GetLogs
\`\`\`

## Escalabilidad Horizontal

### Agregar un Nuevo Nodo

1. **Modificar docker-compose.yml** para agregar una nueva instancia:

\`\`\`yaml
user-service-2:
  build:
    context: .
    dockerfile: services/user-service/Dockerfile
  container_name: user-service-2
  environment:
    - USER_SERVICE_PORT=50051
    - NODE_ID=user-node-2
  ports:
    - "50061:50051"
  networks:
    - distributed-network
\`\`\`

2. **Registrar el nodo** en el Node Service:

\`\`\`bash
grpcurl -plaintext -d '{
  "node_id": "user-node-2",
  "node_type": "user",
  "address": "user-service-2",
  "port": 50051
}' localhost:50054 node.NodeService/RegisterNode
\`\`\`

3. **El Load Balancer** automáticamente detectará el nuevo nodo y comenzará a distribuir carga.

## Replicación y Tolerancia a Fallos

### Replicación de Datos

- **Archivos**: Se replican automáticamente a N nodos (configurado por \`REPLICATION_FACTOR\`)
- **Logs de Auditoría**: Se replican a todos los nodos de auditoría
- **Usuarios**: Base de datos PostgreSQL con replicación nativa

### Recuperación ante Fallos

1. **Detección de Fallos**:
   - Node Service monitorea heartbeats cada 5 segundos
   - Si un nodo no responde en 15 segundos, se marca como "failed"

2. **Elección de Líder**:
   - Si el líder falla, se inicia automáticamente una nueva elección
   - El primer nodo activo se convierte en el nuevo líder

3. **Recuperación de Datos**:
   - Los archivos replicados están disponibles en otros nodos
   - Los logs de auditoría se sincronizan desde réplicas

### Simular Fallo de Nodo

\`\`\`bash
# Detener un servicio
docker-compose stop user-service

# Observar logs del Node Service
docker-compose logs -f node-service

# El sistema detectará el fallo y reasignará el líder si es necesario
\`\`\`

## Seguridad

### Autenticación y Autorización

- **JWT**: Tokens con expiración de 24 horas
- **RBAC**: Control de acceso basado en roles
  - **admin**: Acceso completo
  - **user**: Acceso a sus propios recursos
  - **guest**: Solo lectura

### Comunicación Segura

- **TLS**: Configurar \`USE_TLS=true\` en .env para habilitar
- **Certificados**: Colocar en \`/certs\` (ver \`.env.example\`)

### Mejores Prácticas

1. Cambiar \`JWT_SECRET\` en producción
2. Usar contraseñas fuertes para PostgreSQL
3. Habilitar TLS para comunicación entre servicios
4. Implementar rate limiting en el Load Balancer
5. Rotar tokens JWT regularmente

## Monitoreo y Logs

### Ver Logs de un Servicio Específico

\`\`\`bash
docker-compose logs -f user-service
docker-compose logs -f file-service
\`\`\`

### Estadísticas del Sistema

\`\`\`bash
# Estado de nodos
grpcurl -plaintext -d '{}' localhost:50054 node.NodeService/ListNodes

# Salud del Load Balancer
grpcurl -plaintext -d '{
  "service_type": "user"
}' localhost:50056 loadbalancer.LoadBalancerService/GetNodeHealth
\`\`\`

## Objetos Críticos para Continuidad

1. **Node Service**: Coordina el sistema y gestiona la elección de líder
2. **Security Service**: Valida autenticación y autorización
3. **PostgreSQL**: Almacena datos persistentes de usuarios
4. **Load Balancer**: Distribuye carga y detecta nodos saludables

Si alguno de estos falla, el sistema puede degradarse pero continuará operando con funcionalidad reducida gracias a la replicación.

## Desarrollo Local

### Instalar dependencias

\`\`\`bash
npm install
\`\`\`

### Compilar servicios

\`\`\`bash
npm run build --workspaces
\`\`\`

### Ejecutar un servicio individualmente

\`\`\`bash
cd services/user-service
npm run dev
\`\`\`

### Modo desarrollo con hot-reload

\`\`\`bash
make dev
\`\`\`

## Comandos Útiles

\`\`\`bash
# Ver estado de servicios
docker-compose ps

# Reiniciar un servicio
docker-compose restart user-service

# Ver logs en tiempo real
docker-compose logs -f

# Detener todos los servicios
make down

# Limpiar todo (contenedores, volúmenes, imágenes)
make clean

# Reconstruir y reiniciar
make build && make up
\`\`\`

## Estructura del Proyecto

\`\`\`
distributed-system-monorepo/
├── proto/                      # Definiciones gRPC
│   ├── user.proto
│   ├── file.proto
│   ├── auditor.proto
│   ├── node.proto
│   ├── security.proto
│   └── loadbalancer.proto
├── services/                   # Microservicios
│   ├── user-service/
│   ├── file-service/
│   ├── auditor-service/
│   ├── node-service/
│   ├── security-service/
│   └── loadbalancer-service/
├── shared/                     # Código compartido
│   ├── types/                  # Tipos TypeScript
│   └── utils/                  # Utilidades (JWT, Logger, etc.)
├── docker-compose.yml          # Orquestación de servicios
├── .env.example                # Variables de entorno
├── Makefile                    # Comandos simplificados
└── README.md                   # Esta documentación
\`\`\`

## Troubleshooting

### Los servicios no inician

\`\`\`bash
# Verificar logs
docker-compose logs

# Verificar que los puertos no están en uso
netstat -tulpn | grep 5005

# Reconstruir imágenes
docker-compose build --no-cache
\`\`\`

### Error de conexión a PostgreSQL

\`\`\`bash
# Verificar que PostgreSQL está corriendo
docker-compose ps postgres

# Verificar logs de PostgreSQL
docker-compose logs postgres

# Reiniciar PostgreSQL
docker-compose restart postgres
\`\`\`

### Problemas de permisos en archivos

\`\`\`bash
# Dar permisos al directorio de almacenamiento
sudo chown -R $USER:$USER ./data
\`\`\`

## Contribuir

1. Fork el repositorio
2. Crear una rama para tu feature (\`git checkout -b feature/nueva-funcionalidad\`)
3. Commit tus cambios (\`git commit -am 'Agregar nueva funcionalidad'\`)
4. Push a la rama (\`git push origin feature/nueva-funcionalidad\`)
5. Crear un Pull Request

## Licencia

MIT License - ver LICENSE para más detalles

## Soporte

Para reportar bugs o solicitar features, abrir un issue en GitHub.
\`\`\`

Este sistema distribuido está diseñado para ser escalable, tolerante a fallos y seguro, cumpliendo con todos los requisitos de un sistema distribuido de nivel empresarial.

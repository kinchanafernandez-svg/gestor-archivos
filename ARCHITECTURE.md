# Arquitectura del Sistema Distribuido

## Visión General

Este sistema implementa una arquitectura de microservicios distribuidos con las siguientes características:

- **Comunicación**: gRPC con Protocol Buffers
- **Autenticación**: JWT con RBAC
- **Replicación**: Automática con factor configurable
- **Tolerancia a Fallos**: Detección y recuperación automática
- **Escalabilidad**: Horizontal con load balancing

## Diagrama de Arquitectura

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer Service                    │
│                        (Port 50056)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│User Service │  │File Service │  │Auditor Svc  │
│ (Port 50051)│  │ (Port 50052)│  │ (Port 50053)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│Node Service │  │Security Svc │  │  PostgreSQL │
│ (Port 50054)│  │ (Port 50055)│  │  (Port 5432)│
└─────────────┘  └─────────────┘  └─────────────┘
\`\`\`

## Flujo de Datos

### 1. Autenticación de Usuario

\`\`\`
Cliente → User Service (Register/Login)
         ↓
User Service → Security Service (Generate JWT)
         ↓
User Service → Auditor Service (Log event)
         ↓
Cliente ← JWT Token
\`\`\`

### 2. Subida de Archivo

\`\`\`
Cliente → Load Balancer → File Service (Upload)
                           ↓
                    File Service → Storage (Save file)
                           ↓
                    File Service → Replication Manager
                           ↓
                    File Service → Node Service (Get replica nodes)
                           ↓
                    File Service → Replica Nodes (Replicate)
                           ↓
                    File Service → Auditor Service (Log event)
                           ↓
Cliente ← File ID + Replica locations
\`\`\`

### 3. Detección de Fallo de Nodo

\`\`\`
Node Service (Health Monitor) → Check heartbeats
         ↓
Node Service → Detect stale node
         ↓
Node Service → Mark node as failed
         ↓
Node Service → Leader Election (if leader failed)
         ↓
Load Balancer ← Update node status
\`\`\`

## Componentes Clave

### User Service
- **Responsabilidad**: Gestión de usuarios y autenticación
- **Base de datos**: In-memory con índices
- **Replicación**: Exporta/importa datos para sincronización
- **Dependencias**: Security Service, Auditor Service

### File Service
- **Responsabilidad**: Almacenamiento y gestión de archivos
- **Storage**: Sistema de archivos local
- **Replicación**: Automática a N nodos (configurable)
- **Dependencias**: Node Service (para obtener nodos), Auditor Service

### Auditor Service
- **Responsabilidad**: Registro de eventos del sistema
- **Base de datos**: In-memory con índices múltiples
- **Replicación**: Logs replicados a nodos secundarios
- **Consultas**: Por usuario, acción, estado, con paginación

### Node Service
- **Responsabilidad**: Gestión de nodos y coordinación
- **Health Monitoring**: Heartbeats cada 5 segundos
- **Leader Election**: Consenso simple (primer nodo activo)
- **Recuperación**: Automática ante fallos

### Security Service
- **Responsabilidad**: Autenticación y autorización
- **JWT**: Validación y revocación de tokens
- **RBAC**: Roles predefinidos (admin, user, guest)
- **Permisos**: Verificación granular por recurso y acción

### Load Balancer Service
- **Responsabilidad**: Distribución de carga
- **Estrategias**: Round-robin, least-connections, weighted
- **Health Checks**: Monitoreo continuo de nodos
- **Routing**: Selección inteligente de nodos

## Patrones de Diseño

### 1. Service Registry Pattern
- Node Service actúa como registro de servicios
- Servicios se registran al iniciar
- Heartbeats mantienen el estado actualizado

### 2. Leader Election Pattern
- Consenso simple basado en términos
- Elección automática ante fallos
- Un líder coordina operaciones críticas

### 3. Replication Pattern
- Replicación asíncrona de datos
- Factor de replicación configurable
- Consistencia eventual

### 4. Circuit Breaker Pattern
- Detección de nodos fallidos
- Marcado automático como "failed"
- Recuperación automática al recibir heartbeat

### 5. Load Balancing Pattern
- Múltiples estrategias de balanceo
- Selección basada en salud del nodo
- Distribución equitativa de carga

## Seguridad

### Capas de Seguridad

1. **Autenticación**: JWT con expiración
2. **Autorización**: RBAC con permisos granulares
3. **Comunicación**: TLS opcional entre servicios
4. **Auditoría**: Registro de todas las operaciones
5. **Revocación**: Tokens pueden ser revocados

### Roles y Permisos

\`\`\`
Admin:
  - user: create, read, update, delete, list
  - file: upload, download, delete, list, replicate
  - audit: read, list
  - node: register, read, list, update
  - security: validate, revoke, manage

User:
  - user: read, update (solo propio)
  - file: upload, download, delete, list (solo propios)
  - audit: read (solo propios)

Guest:
  - user: read
  - file: list
\`\`\`

## Escalabilidad

### Escalado Horizontal

1. **Agregar nodos**: Simplemente iniciar nuevas instancias
2. **Registro automático**: Nodos se registran en Node Service
3. **Load Balancing**: Automático por Load Balancer
4. **Replicación**: Se ajusta al número de nodos disponibles

### Límites de Escalabilidad

- **User Service**: Limitado por base de datos (usar PostgreSQL en producción)
- **File Service**: Limitado por almacenamiento (usar S3/MinIO en producción)
- **Auditor Service**: Limitado por memoria (usar base de datos en producción)
- **Node Service**: Puede manejar cientos de nodos
- **Load Balancer**: Puede distribuir a cientos de nodos

## Tolerancia a Fallos

### Tipos de Fallos Manejados

1. **Fallo de Nodo Individual**
   - Detección: Heartbeat timeout
   - Recuperación: Marca como failed, redirige tráfico

2. **Fallo de Líder**
   - Detección: Heartbeat timeout del líder
   - Recuperación: Nueva elección automática

3. **Fallo de Red Temporal**
   - Detección: Timeout en comunicación
   - Recuperación: Retry con backoff exponencial

4. **Pérdida de Datos**
   - Prevención: Replicación a múltiples nodos
   - Recuperación: Datos disponibles en réplicas

### Puntos Únicos de Fallo (SPOFs)

- **PostgreSQL**: Usar replicación nativa de PostgreSQL
- **Redis**: Usar Redis Sentinel o Cluster
- **Node Service**: Implementar múltiples instancias con Raft

## Monitoreo y Observabilidad

### Métricas Clave

- **Node Service**: Nodos activos, fallos detectados, elecciones de líder
- **Load Balancer**: Distribución de carga, salud de nodos
- **File Service**: Archivos almacenados, réplicas exitosas
- **Auditor Service**: Eventos por segundo, logs totales
- **Security Service**: Tokens validados, permisos denegados

### Logs Estructurados

Todos los servicios usan logging estructurado en JSON:

\`\`\`json
{
  "timestamp": "2025-01-20T10:30:00.000Z",
  "level": "INFO",
  "service": "UserService",
  "message": "User registered",
  "meta": {
    "userId": "uuid-here",
    "username": "john"
  }
}
\`\`\`

## Mejoras Futuras

1. **Persistencia**: Migrar a bases de datos reales (PostgreSQL, MongoDB)
2. **Caché Distribuido**: Implementar Redis para caché
3. **Message Queue**: Agregar RabbitMQ/Kafka para eventos
4. **Service Mesh**: Implementar Istio para comunicación avanzada
5. **Observabilidad**: Integrar Prometheus + Grafana
6. **Tracing**: Implementar OpenTelemetry
7. **API Gateway**: Agregar gateway unificado para clientes
8. **Rate Limiting**: Implementar límites de tasa por usuario
9. **Backup Automático**: Snapshots periódicos de datos
10. **Multi-región**: Replicación geográfica
\`\`\`

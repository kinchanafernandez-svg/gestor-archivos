# Testing Guide

Esta guía explica cómo probar el sistema distribuido.

## Pruebas Automatizadas

### Test Client

El sistema incluye un cliente de prueba que demuestra el uso de todos los servicios:

\`\`\`bash
npm run test:client
\`\`\`

Este script ejecutará pruebas para:
- ✅ User Service (registro, login, gestión de usuarios)
- ✅ File Service (upload, download, listado)
- ✅ Auditor Service (logging, consultas, estadísticas)
- ✅ Node Service (registro de nodos, cluster status)
- ✅ Security Service (validación de tokens, permisos)
- ✅ Load Balancer (selección de nodos, estadísticas)

## Pruebas Manuales

### 1. Verificar Salud del Sistema

\`\`\`bash
npm run health
\`\`\`

Este comando verifica que todos los servicios estén corriendo y respondiendo.

### 2. Probar User Service

\`\`\`bash
# Usando grpcurl (instalar: brew install grpcurl)

# Registrar usuario
grpcurl -plaintext -d '{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "role": "user"
}' localhost:50051 user.UserService/Register

# Login
grpcurl -plaintext -d '{
  "username": "testuser",
  "password": "password123"
}' localhost:50051 user.UserService/Login
\`\`\`

### 3. Probar File Service

\`\`\`bash
# Upload file
grpcurl -plaintext -d '{
  "filename": "test.txt",
  "content": "SGVsbG8gV29ybGQ=",
  "userId": "user-1",
  "token": "YOUR_JWT_TOKEN"
}' localhost:50052 file.FileService/UploadFile

# List files
grpcurl -plaintext -d '{
  "userId": "user-1",
  "token": "YOUR_JWT_TOKEN",
  "page": 1,
  "pageSize": 10
}' localhost:50052 file.FileService/ListFiles
\`\`\`

### 4. Probar Auditor Service

\`\`\`bash
# Log event
grpcurl -plaintext -d '{
  "userId": "user-1",
  "action": "TEST_ACTION",
  "resource": "test-resource",
  "details": "Test audit log",
  "token": "YOUR_JWT_TOKEN"
}' localhost:50053 auditor.AuditorService/LogEvent

# Get logs
grpcurl -plaintext -d '{
  "userId": "user-1",
  "token": "YOUR_JWT_TOKEN",
  "page": 1,
  "pageSize": 10
}' localhost:50053 auditor.AuditorService/GetLogs
\`\`\`

## Pruebas de Tolerancia a Fallos

### Simular Caída de Nodo

\`\`\`bash
# Detener un servicio específico
docker-compose stop user-service

# Verificar que el sistema sigue funcionando
npm run health

# El load balancer debería redirigir a otros nodos
# El sistema debería detectar el nodo caído

# Reiniciar el servicio
docker-compose start user-service
\`\`\`

### Simular Partición de Red

\`\`\`bash
# Desconectar un contenedor de la red
docker network disconnect distributed-system_default user-service-1

# Esperar a que el sistema detecte la falla
sleep 10

# Verificar elección de nuevo líder
docker-compose logs node-service

# Reconectar
docker network connect distributed-system_default user-service-1
\`\`\`

### Prueba de Replicación

\`\`\`bash
# 1. Subir un archivo
grpcurl -plaintext -d '{...}' localhost:50052 file.FileService/UploadFile

# 2. Verificar que se replicó en múltiples nodos
docker-compose exec file-service-1 ls /data/files
docker-compose exec file-service-2 ls /data/files
docker-compose exec file-service-3 ls /data/files

# Los archivos deberían existir en todos los nodos
\`\`\`

## Pruebas de Carga

### Usando Apache Bench

\`\`\`bash
# Instalar: brew install apache-bench

# Prueba de carga en User Service
ab -n 1000 -c 10 -p user.json -T application/json \
  http://localhost:50051/register
\`\`\`

### Usando k6

\`\`\`bash
# Instalar: brew install k6

# Crear script de prueba
cat > load-test.js << 'EOF'
import grpc from 'k6/net/grpc';
import { check } from 'k6';

const client = new grpc.Client();
client.load(['proto'], 'user.proto');

export default () => {
  client.connect('localhost:50051', { plaintext: true });

  const response = client.invoke('user.UserService/Login', {
    username: 'testuser',
    password: 'password123'
  });

  check(response, {
    'status is OK': (r) => r && r.status === grpc.StatusOK,
  });

  client.close();
};
EOF

# Ejecutar prueba
k6 run --vus 10 --duration 30s load-test.js
\`\`\`

## Monitoreo Durante Pruebas

### Ver Logs en Tiempo Real

\`\`\`bash
# Todos los servicios
npm run logs all

# Servicio específico
npm run logs user-service
\`\`\`

### Métricas del Sistema

\`\`\`bash
# CPU y memoria de contenedores
docker stats

# Logs de auditoría
docker-compose exec auditor-service cat /data/audit.log
\`\`\`

## Troubleshooting

### Servicios no inician

\`\`\`bash
# Verificar logs
docker-compose logs

# Reconstruir imágenes
docker-compose build --no-cache

# Limpiar y reiniciar
npm run clean
npm run start
\`\`\`

### Errores de conexión

\`\`\`bash
# Verificar puertos
netstat -an | grep LISTEN | grep 5005

# Verificar red de Docker
docker network ls
docker network inspect distributed-system_default
\`\`\`

### Problemas de replicación

\`\`\`bash
# Verificar estado del cluster
grpcurl -plaintext localhost:50054 node.NodeService/GetClusterStatus

# Verificar logs de nodos
docker-compose logs node-service

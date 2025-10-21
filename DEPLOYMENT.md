# Guía de Despliegue

## Despliegue en Producción

### Requisitos de Infraestructura

- **CPU**: Mínimo 4 cores por servicio
- **RAM**: Mínimo 2GB por servicio
- **Disco**: 50GB+ para almacenamiento de archivos
- **Red**: Baja latencia entre nodos (<10ms)

### Preparación

1. **Configurar variables de entorno de producción**

\`\`\`bash
# Copiar y editar .env
cp .env.example .env.production

# Variables críticas a cambiar:
JWT_SECRET=<generar-secreto-fuerte-aleatorio>
DB_PASSWORD=<contraseña-segura>
USE_TLS=true
\`\`\`

2. **Generar certificados TLS**

\`\`\`bash
# Crear directorio de certificados
mkdir -p certs

# Generar certificados (ejemplo con OpenSSL)
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key \
  -out certs/server.crt -days 365 -nodes
\`\`\`

### Despliegue con Docker Swarm

\`\`\`bash
# Inicializar Swarm
docker swarm init

# Desplegar stack
docker stack deploy -c docker-compose.yml distributed-system

# Verificar servicios
docker service ls
\`\`\`

### Despliegue con Kubernetes

Ver archivos en \`k8s/\` para manifiestos completos.

\`\`\`bash
# Aplicar configuraciones
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/services/
kubectl apply -f k8s/deployments/

# Verificar pods
kubectl get pods -n distributed-system
\`\`\`

## Configuración de Alta Disponibilidad

### PostgreSQL con Replicación

\`\`\`yaml
# docker-compose.ha.yml
postgres-primary:
  image: postgres:16-alpine
  environment:
    POSTGRES_REPLICATION_MODE: master

postgres-replica:
  image: postgres:16-alpine
  environment:
    POSTGRES_REPLICATION_MODE: slave
    POSTGRES_MASTER_HOST: postgres-primary
\`\`\`

### Redis Cluster

\`\`\`yaml
redis-cluster:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes
  deploy:
    replicas: 6
\`\`\`

## Monitoreo

### Prometheus + Grafana

\`\`\`bash
# Agregar a docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3000:3000"
\`\`\`

## Backup y Recuperación

### Backup Automático

\`\`\`bash
# Script de backup
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec distributed-postgres pg_dump -U postgres distributed_system > backup_$DATE.sql
tar -czf files_backup_$DATE.tar.gz /data/files
\`\`\`

### Recuperación

\`\`\`bash
# Restaurar base de datos
docker exec -i distributed-postgres psql -U postgres distributed_system < backup.sql

# Restaurar archivos
tar -xzf files_backup.tar.gz -C /data/
\`\`\`
\`\`\`

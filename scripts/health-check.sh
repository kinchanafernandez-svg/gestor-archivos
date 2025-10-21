#!/bin/bash

# Script para verificar la salud de todos los servicios

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Distributed System Health Check                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

SERVICES=("user-service:50051" "file-service:50052" "auditor-service:50053" "node-service:50054" "security-service:50055" "loadbalancer-service:50056")

for SERVICE in "${SERVICES[@]}"; do
    IFS=':' read -r NAME PORT <<< "$SERVICE"
    
    if nc -z localhost $PORT 2>/dev/null; then
        echo "✅ $NAME (port $PORT) - HEALTHY"
    else
        echo "❌ $NAME (port $PORT) - DOWN"
    fi
done

echo ""
echo "Docker containers status:"
docker-compose ps

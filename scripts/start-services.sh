#!/bin/bash

# Script para iniciar todos los servicios del sistema distribuido

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Starting Distributed System Services                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    exit 1
fi

# Limpiar contenedores anteriores
echo "🧹 Cleaning up old containers..."
docker-compose down -v

# Construir imágenes
echo ""
echo "🔨 Building Docker images..."
docker-compose build

# Iniciar servicios
echo ""
echo "🚀 Starting services..."
docker-compose up -d

# Esperar a que los servicios estén listos
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Verificar estado de los servicios
echo ""
echo "📊 Service Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose ps

echo ""
echo "✅ All services are running!"
echo ""
echo "Service URLs:"
echo "  • User Service:         localhost:50051"
echo "  • File Service:         localhost:50052"
echo "  • Auditor Service:      localhost:50053"
echo "  • Node Service:         localhost:50054"
echo "  • Security Service:     localhost:50055"
echo "  • Load Balancer:        localhost:50056"
echo ""
echo "To view logs: docker-compose logs -f [service-name]"
echo "To stop services: docker-compose down"

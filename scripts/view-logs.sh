#!/bin/bash

# Script para ver logs de los servicios

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "Usage: ./scripts/view-logs.sh [service-name]"
    echo ""
    echo "Available services:"
    echo "  • user-service"
    echo "  • file-service"
    echo "  • auditor-service"
    echo "  • node-service"
    echo "  • security-service"
    echo "  • loadbalancer-service"
    echo ""
    echo "Or use 'all' to view all logs"
    exit 1
fi

if [ "$SERVICE" = "all" ]; then
    docker-compose logs -f
else
    docker-compose logs -f $SERVICE
fi

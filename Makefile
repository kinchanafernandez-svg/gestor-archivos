.PHONY: help build up down logs clean test

help:
	@echo "Available commands:"
	@echo "  make build       - Build all Docker images"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make logs        - View logs from all services"
	@echo "  make clean       - Remove all containers, volumes, and images"
	@echo "  make test        - Run tests"
	@echo "  make dev         - Start services in development mode"

build:
	docker-compose build

up:
	docker-compose up -d
	@echo "Services started. Access them at:"
	@echo "  User Service:        localhost:50051"
	@echo "  File Service:        localhost:50052"
	@echo "  Auditor Service:     localhost:50053"
	@echo "  Node Service:        localhost:50054"
	@echo "  Security Service:    localhost:50055"
	@echo "  Load Balancer:       localhost:50056"

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v --rmi all
	rm -rf dist
	rm -rf node_modules
	rm -rf services/*/dist
	rm -rf services/*/node_modules
	rm -rf shared/*/dist
	rm -rf shared/*/node_modules

dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

test:
	npm test --workspaces

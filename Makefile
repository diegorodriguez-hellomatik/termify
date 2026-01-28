.PHONY: install dev build clean docker-up docker-down docker-logs db-push db-migrate

# Install dependencies
install:
	npm install

# Development
dev:
	npm run dev

# Build all packages
build:
	npm run build

# Clean build artifacts
clean:
	npm run clean

# Database commands
db-generate:
	npm run db:generate

db-push:
	npm run db:push

db-migrate:
	npm run db:migrate

# Docker commands
docker-up:
	docker compose -f docker/docker-compose.yml up -d

docker-down:
	docker compose -f docker/docker-compose.yml down

docker-logs:
	docker compose -f docker/docker-compose.yml logs -f

docker-build:
	docker compose -f docker/docker-compose.yml build

# Development with local services
dev-services:
	docker compose -f docker/docker-compose.yml up -d postgres redis

# Stop development services
dev-services-down:
	docker compose -f docker/docker-compose.yml stop postgres redis

# Full setup (install + services + db)
setup: install dev-services
	sleep 5
	npm run db:push
	@echo "Setup complete! Run 'make dev' to start development."

# Help
help:
	@echo "Available commands:"
	@echo "  make install       - Install dependencies"
	@echo "  make dev           - Start development servers"
	@echo "  make build         - Build all packages"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make db-generate   - Generate Prisma client"
	@echo "  make db-push       - Push schema to database"
	@echo "  make db-migrate    - Run database migrations"
	@echo "  make docker-up     - Start all Docker services"
	@echo "  make docker-down   - Stop all Docker services"
	@echo "  make docker-logs   - View Docker logs"
	@echo "  make docker-build  - Build Docker images"
	@echo "  make dev-services  - Start dev services (postgres, redis)"
	@echo "  make setup         - Full development setup"

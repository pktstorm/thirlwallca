.PHONY: help setup setup-fe setup-be dev dev-fe dev-be
.PHONY: db-up db-down db-migrate db-revision db-reset db-seed
.PHONY: build-fe deploy-fe deploy-be deploy deploy-frontend deploy-backend
.PHONY: lint lint-fe lint-be test test-fe test-be
.PHONY: invite-user list-users set-role
.PHONY: import-gedcom import-gedcom-dry

# AWS profile for this project (empty = default profile)
AWS_PROFILE :=
AWS_PROFILE_FLAG := $(if $(AWS_PROFILE),--profile $(AWS_PROFILE),)
AWS_REGION := us-east-1
AWS_FLAGS := --region $(AWS_REGION) $(AWS_FLAGS)
TF_DIR := terraform/environments/production

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================
# Setup
# ============================================================
setup: setup-fe setup-be ## Install all dependencies

setup-fe: ## Install frontend dependencies
	cd frontend && corepack enable && yarn install

setup-be: ## Install backend dependencies
	cd backend && poetry install

# ============================================================
# Development
# ============================================================
dev: ## Start frontend + backend concurrently
	@make dev-be &
	@make dev-fe

dev-fe: ## Start frontend dev server
	cd frontend && yarn dev

dev-be: ## Start backend dev server
	cd backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ============================================================
# Database
# ============================================================
db-up: ## Start PostgreSQL via Docker Compose
	docker compose -f docker/docker-compose.yml up -d postgres

db-down: ## Stop PostgreSQL
	docker compose -f docker/docker-compose.yml down

db-migrate: ## Run Alembic migrations
	cd backend && poetry run alembic upgrade head

db-revision: ## Create new Alembic migration (MSG required)
	@if [ -z "$(MSG)" ]; then echo "Usage: make db-revision MSG='add persons table'"; exit 1; fi
	cd backend && poetry run alembic revision --autogenerate -m "$(MSG)"

db-reset: ## Drop and recreate database (destructive!)
	@echo "WARNING: This will destroy all data!"
	@read -p "Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	cd backend && poetry run alembic downgrade base && poetry run alembic upgrade head

db-seed: ## Seed database with initial data
	cd backend && poetry run python -m scripts.seed_data

# ============================================================
# Build & Deploy
# ============================================================
build-fe: ## Build frontend for production
	cd frontend && yarn build

deploy-fe: build-fe ## Build and deploy frontend to S3 + CloudFront
	$(eval CF_DIST := $(shell cd $(TF_DIR) && terraform output -raw cloudfront_distribution_id))
	aws s3 sync frontend/dist/ s3://thirlwall-frontend/ --delete $(AWS_FLAGS)
	aws cloudfront create-invalidation \
		--distribution-id $(CF_DIST) \
		--paths "/*" $(AWS_FLAGS)

deploy-be: ## Deploy backend to EC2
	$(eval EC2_IP := $(shell cd $(TF_DIR) && terraform output -raw ec2_public_ip))
	rsync -avz -e "ssh -i ~/.ssh/thirlwall-key.pem" \
		--exclude='__pycache__' --exclude='.venv' --exclude='tests' --exclude='.env' \
		backend/ ec2-user@$(EC2_IP):~/app/
	ssh -i ~/.ssh/thirlwall-key.pem ec2-user@$(EC2_IP) '\
		cd ~/app && \
		poetry install --no-interaction --no-root && \
		poetry run alembic upgrade head && \
		sudo systemctl restart thirlwall-api'

deploy: deploy-fe deploy-be ## Deploy both frontend and backend

deploy-frontend: deploy-fe ## Alias for deploy-fe
deploy-backend: deploy-be ## Alias for deploy-be

# ============================================================
# Quality
# ============================================================
lint: lint-be lint-fe ## Run all linters

lint-fe: ## Lint frontend
	cd frontend && yarn lint

lint-be: ## Lint backend
	cd backend && poetry run ruff check .

test: test-be test-fe ## Run all tests

test-be: ## Run backend tests
	cd backend && poetry run pytest -v

test-fe: ## Run frontend tests
	cd frontend && yarn test

# ============================================================
# User Management (Cognito)
# ============================================================
invite-user: ## Invite user (EMAIL and ROLE required)
	@if [ -z "$(EMAIL)" ] || [ -z "$(ROLE)" ]; then \
		echo "Usage: make invite-user EMAIL=user@example.com ROLE=viewer"; \
		echo "Roles: admin, editor, viewer"; \
		exit 1; \
	fi
	$(eval POOL_ID := $(shell cd $(TF_DIR) && terraform output -raw cognito_user_pool_id))
	aws cognito-idp admin-create-user \
		--user-pool-id $(POOL_ID) \
		--username $(EMAIL) \
		--user-attributes Name=email,Value=$(EMAIL) Name=email_verified,Value=true Name=custom:role,Value=$(ROLE) \
		--desired-delivery-mediums EMAIL \
		$(AWS_FLAGS)

list-users: ## List all Cognito users
	$(eval POOL_ID := $(shell cd $(TF_DIR) && terraform output -raw cognito_user_pool_id))
	aws cognito-idp list-users \
		--user-pool-id $(POOL_ID) \
		$(AWS_FLAGS)

set-role: ## Change user role (EMAIL and ROLE required)
	@if [ -z "$(EMAIL)" ] || [ -z "$(ROLE)" ]; then \
		echo "Usage: make set-role EMAIL=user@example.com ROLE=admin"; \
		echo "Roles: admin, editor, viewer"; \
		exit 1; \
	fi
	$(eval POOL_ID := $(shell cd $(TF_DIR) && terraform output -raw cognito_user_pool_id))
	aws cognito-idp admin-update-user-attributes \
		--user-pool-id $(POOL_ID) \
		--username $(EMAIL) \
		--user-attributes Name=custom:role,Value=$(ROLE) \
		$(AWS_FLAGS)

# ============================================================
# GEDCOM Import
# ============================================================
import-gedcom: ## Import GEDCOM file (FILE required)
	@if [ -z "$(FILE)" ]; then echo "Usage: make import-gedcom FILE=/path/to/file.ged"; exit 1; fi
	cd backend && poetry run python -m scripts.import_gedcom $(FILE)

import-gedcom-dry: ## Dry-run GEDCOM import (FILE required)
	@if [ -z "$(FILE)" ]; then echo "Usage: make import-gedcom-dry FILE=/path/to/file.ged"; exit 1; fi
	cd backend && poetry run python -m scripts.import_gedcom $(FILE) --dry-run

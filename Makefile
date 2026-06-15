# VivaMama monorepo — one-command helpers for the polyglot stack.
# Run `make help` to list targets.

SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup install up down logs dev lint typecheck test build format clean ingest

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: install ## Install everything (JS workspaces + Python chatbot)
	cd services/chatbot && uv sync

install: ## Install JS/TS workspace dependencies
	pnpm install

up: ## Start the full stack (Mongo + Redis + backend + chatbot) via Docker
	docker compose up --build

down: ## Stop the stack and remove volumes
	docker compose down -v

logs: ## Tail the stack logs
	docker compose logs -f

dev: ## Run all dev servers via Turbo
	pnpm dev

lint: ## Lint everything (ESLint for JS/TS, Ruff for Python)
	pnpm lint

typecheck: ## Type-check the TS workspaces
	pnpm typecheck

test: ## Run unit tests
	pnpm test

build: ## Build all buildable packages
	pnpm build

format: ## Format the repo (Prettier for JS/TS, Ruff for Python)
	pnpm format
	cd services/chatbot && uvx ruff format .

clean: ## Remove build outputs and caches
	pnpm clean || true
	cd services/chatbot && rm -rf .ruff_cache .pytest_cache .local_vector_store

ingest: ## Build the chatbot's FAISS index from services/chatbot/data/raw
	cd services/chatbot && uv run python ingest_data.py

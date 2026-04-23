.PHONY: build run up dev stop down clean clobber help

help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  /'

PROFILES := --profile prod --profile dev
COMPOSE_PROJECT_LABEL := com.docker.compose.project=pdxhub

## build — build the production image
build:
	docker compose build app

## run — start the production container (foreground)
run:
	docker compose up --remove-orphans app

## up — build then start the production container
up:
	docker compose build app
	docker compose up --remove-orphans app

## dev — start the dev container with live reload (Compose watch)
dev:
	docker compose up --build --watch --remove-orphans app-dev

## stop — pause running containers without removing them
stop:
	docker compose $(PROFILES) stop

## down — remove project containers and network
down:
	docker compose $(PROFILES) down --remove-orphans

## clean — remove project containers, network, named volumes, and local images
clean:
	@if [ "$$SKIP_CLEAN_PROMPT" != "1" ]; then \
	  echo "[CLEAN] This will remove containers, volumes, and images. Type 'y' to confirm (10s timeout):"; \
	  read -t 10 ans; \
	  [ "$$ans" = "y" ] || { echo 'Aborted.'; exit 1; }; \
	fi
	docker compose $(PROFILES) down --remove-orphans --volumes --rmi local

## clobber — nuke project resources, buildx helpers, and all unused Docker resources
clobber:
	@echo "[CLOBBER] This will remove ALL containers, images, buildx helpers, and volumes. Type 'y' to confirm (10s timeout):"
	@read -t 10 ans; [ "$$ans" = "y" ] || { echo 'Aborted.'; exit 1; }
	@$(MAKE) clean SKIP_CLEAN_PROMPT=1
	@CONTAINERS=$$(docker ps -aq --filter "name=buildx_buildkit_"); \
	  [ -n "$$CONTAINERS" ] && docker rm -f $$CONTAINERS || true
	-docker buildx rm --all-inactive --force
	@VOLS=$$(docker volume ls -q --filter "label=$(COMPOSE_PROJECT_LABEL)"; \
	  docker volume ls -q --filter "name=buildx_buildkit_"); \
	  [ -n "$$VOLS" ] && docker volume rm -f $$VOLS || true
	docker system prune -af --volumes
	docker builder prune -af

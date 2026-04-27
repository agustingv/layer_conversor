.PHONY: help build up down shell install clean db-create db-migrate install-client generate-client

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build Docker images
	docker compose build --no-cache

up: ## Start containers
	docker compose up -d

down: ## Stop containers
	docker compose down

shell: ## Open shell in PHP container
	docker compose exec php sh

composer: ## Run composer command — usage: make composer cmd="require vendor/package"
	docker compose exec php composer $(cmd)

clean: ## Remove Symfony API files inside app/api/
	rm -rf app/api/bin app/api/composer.json app/api/composer.lock app/api/config \
	       app/api/public app/api/src app/api/var app/api/vendor app/api/migrations \
	       app/api/symfony.lock

install: ## Create Symfony API Platform project (Symfony 7 + API Platform 4)
	docker compose exec php sh -c " \
		rm -rf /tmp/api_app /tmp/api_bak && \
		mkdir /tmp/api_bak && \
		cp /var/www/html/docker-compose.yml /tmp/api_bak/ && \
		cp /var/www/html/Makefile /tmp/api_bak/ && \
		cp /var/www/html/.env /tmp/api_bak/ && \
		cp /var/www/html/.gitignore /tmp/api_bak/ && \
		composer create-project symfony/skeleton:'7.*' /tmp/api_app --no-interaction && \
		cp -r /tmp/api_app/. /var/www/html/ && \
		cp /tmp/api_bak/docker-compose.yml /var/www/html/ && \
		cp /tmp/api_bak/Makefile /var/www/html/ && \
		cp /tmp/api_bak/.env /var/www/html/ && \
		cp /tmp/api_bak/.gitignore /var/www/html/ && \
		rm -rf /tmp/api_app /tmp/api_bak && \
		composer require api-platform/symfony api-platform/doctrine-orm doctrine/orm doctrine/doctrine-bundle doctrine/doctrine-migrations-bundle symfony/twig-bundle --no-scripts --no-interaction && \
		composer require --dev symfony/maker-bundle --no-scripts --no-interaction && \
		php bin/console cache:clear \
	"
	@sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://app:secret@postgres:5432/app?serverVersion=17\&charset=utf8"|' .env
	@echo "Done. Run: make db-create && make db-migrate"

db-create: ## Create database
	docker compose exec php php bin/console doctrine:database:create --if-not-exists

db-migrate: ## Run migrations
	docker compose exec php php bin/console doctrine:migrations:migrate --no-interaction

db-diff: ## Generate migration from entity changes
	docker compose exec php php bin/console doctrine:migrations:diff

cc: ## Clear Symfony cache
	docker compose exec php php bin/console cache:clear

logs: ## Tail container logs
	docker compose logs -f

install-client: ## Bootstrap Next.js API Platform PWA client
	docker compose run --rm client sh -c " \
		npx create-next-app@latest . \
			--typescript \
			--tailwind \
			--eslint \
			--app \
			--no-src-dir \
			--import-alias '@/*' \
			--yes && \
		npm install @api-platform/api-doc-parser \
	"
	docker compose up -d client

generate-client: ## Generate CRUD components from API (run after install-client)
	docker run --rm \
		--network host \
		-v $(PWD)/app/client:/app \
		-w /app \
		node:22-alpine \
		sh -c "./node_modules/.bin/create-client http://localhost:$(NGINX_PORT:-8080)/api . --generator next"

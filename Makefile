PROJECT_ID   := sales-report-493809
REGION       := asia-northeast1
SERVICE_NAME := sales-report
REGISTRY     := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(SERVICE_NAME)/app
IMAGE_TAG    ?= latest

# ─────────────────────────────────────────────
# 開発
# ─────────────────────────────────────────────

.PHONY: dev
dev: ## Docker Compose で開発サーバーを起動
	docker compose up

.PHONY: dev-build
dev-build: ## イメージを再ビルドして開発サーバーを起動
	docker compose up --build

.PHONY: down
down: ## コンテナを停止・削除
	docker compose down

.PHONY: lint
lint: ## ESLint を実行
	docker compose exec app npm run lint

.PHONY: test
test: ## Vitest をウォッチモードで実行
	docker compose exec app npm run test

.PHONY: test-run
test-run: ## Vitest を単発実行（CI 向け）
	docker compose --profile test run --rm test

.PHONY: coverage
coverage: ## テストカバレッジを計測
	docker compose exec app npm run test:coverage

# ─────────────────────────────────────────────
# DB / Prisma
# ─────────────────────────────────────────────

.PHONY: migrate
migrate: ## Prisma マイグレーションを実行（開発）
	docker compose exec app npx prisma migrate dev

.PHONY: migrate-deploy
migrate-deploy: ## Prisma マイグレーションを適用（本番）
	docker compose exec app npx prisma migrate deploy

.PHONY: studio
studio: ## Prisma Studio を起動
	docker compose exec app npx prisma studio

# ─────────────────────────────────────────────
# ビルド / デプロイ
# ─────────────────────────────────────────────

.PHONY: build
build: ## 本番用 Docker イメージをビルド
	docker build \
		--tag $(REGISTRY):$(IMAGE_TAG) \
		--tag $(REGISTRY):latest \
		.

.PHONY: push
push: build ## イメージを Artifact Registry へプッシュ
	docker push $(REGISTRY):$(IMAGE_TAG)
	docker push $(REGISTRY):latest

.PHONY: deploy
deploy: push ## Cloud Run へデプロイ（ローカルから手動実行）
	gcloud run deploy $(SERVICE_NAME) \
		--image $(REGISTRY):$(IMAGE_TAG) \
		--region $(REGION) \
		--project $(PROJECT_ID) \
		--set-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest \
		--min-instances=0 \
		--max-instances=10 \
		--memory=512Mi \
		--cpu=1 \
		--timeout=30s \
		--concurrency=80 \
		--allow-unauthenticated

.PHONY: deploy-describe
deploy-describe: ## デプロイ済みサービスの情報を表示
	gcloud run services describe $(SERVICE_NAME) \
		--region $(REGION) \
		--project $(PROJECT_ID)

.PHONY: logs
logs: ## Cloud Run のログをストリーミング
	gcloud beta run services logs tail $(SERVICE_NAME) \
		--region $(REGION) \
		--project $(PROJECT_ID)

# ─────────────────────────────────────────────
# GCP セットアップ（初回のみ）
# ─────────────────────────────────────────────

.PHONY: gcp-setup
gcp-setup: ## Artifact Registry リポジトリを作成
	gcloud artifacts repositories create $(SERVICE_NAME) \
		--repository-format=docker \
		--location=$(REGION) \
		--project=$(PROJECT_ID)

# ─────────────────────────────────────────────
# ヘルプ
# ─────────────────────────────────────────────

.PHONY: help
help: ## コマンド一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Load .env.local if present (env vars already set take precedence) ──────────
# Copy .env.example to .env.local and customise for your environment.
if [[ -f "$ROOT/.env.local" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ROOT/.env.local"
  set +o allexport
fi

PORT=${PORT:-3001}
DYNAMO_IP=""

# ── Colours ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[local]${NC} $*"; }
warn() { echo -e "${YELLOW}[local]${NC} $*"; }

# ── Kill any previous SAM process on PORT ──────────────────────────────────────
if lsof -ti:"$PORT" &>/dev/null; then
  warn "Port $PORT in use — killing existing process"
  kill "$(lsof -ti:"$PORT")" 2>/dev/null || true
  sleep 1
fi

# ── Start DynamoDB Local ───────────────────────────────────────────────────────
info "Starting DynamoDB Local..."
docker compose up -d 2>&1

info "Waiting for DynamoDB Local to be healthy..."
for i in $(seq 1 20); do
  if docker inspect dynamodb-local --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 1
done

# ── Resolve DynamoDB container IP (for SAM Lambda containers) ─────────────────
DYNAMO_IP=$(docker inspect dynamodb-local --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -1)
if [[ -z "$DYNAMO_IP" ]]; then
  warn "Could not resolve dynamodb-local IP — falling back to host.docker.internal"
  DYNAMO_IP="host.docker.internal"
fi
info "DynamoDB reachable at $DYNAMO_IP:8000"

# ── Write local env-vars file with resolved IP ────────────────────────────────
cat > "$ROOT/infra/local-env.json" <<EOF
{
  "frontend-demo-backend": {
    "TABLE_NAME": "frontend-demo-table",
    "AWS_ACCESS_KEY_ID": "local",
    "AWS_SECRET_ACCESS_KEY": "local",
    "DYNAMODB_ENDPOINT": "http://${DYNAMO_IP}:8000"
  },
  "frontend-demo-middleware": {
    "BACKEND_FUNCTION_NAME": "frontend-demo-backend",
    "TABLE_NAME": "frontend-demo-table",
    "AWS_ACCESS_KEY_ID": "local",
    "AWS_SECRET_ACCESS_KEY": "local",
    "DYNAMODB_ENDPOINT": "http://${DYNAMO_IP}:8000"
  },
  "frontend-demo-authorizer": {
    "JWT_SECRET": "${JWT_SECRET:-local-dev-secret}"
  }
}
EOF
info "Wrote infra/local-env.json (DYNAMODB_ENDPOINT=http://${DYNAMO_IP}:8000)"

# ── Seed DynamoDB ──────────────────────────────────────────────────────────────
info "Seeding DynamoDB..."
cd "$ROOT" && pnpm seed

# ── CDK synth ─────────────────────────────────────────────────────────────────
info "Synthesising CDK stack..."
cd "$ROOT/infra" && pnpm cdk synth --quiet

# ── Get Docker network for SAM ─────────────────────────────────────────────────
DOCKER_NETWORK=$(docker network ls --filter name=frontend-demo --format '{{.Name}}' | head -1)
info "Using Docker network: ${DOCKER_NETWORK:-none}"

# ── Start SAM local ───────────────────────────────────────────────────────────
info "Starting SAM local API on port $PORT..."
NETWORK_FLAG=""
[[ -n "$DOCKER_NETWORK" ]] && NETWORK_FLAG="--docker-network $DOCKER_NETWORK"

sam local start-api \
  --template "$ROOT/infra/cdk.out/FrontendDemoStack.template.json" \
  --env-vars "$ROOT/infra/local-env.json" \
  --port "$PORT" \
  $NETWORK_FLAG

info "API running at http://127.0.0.1:$PORT"

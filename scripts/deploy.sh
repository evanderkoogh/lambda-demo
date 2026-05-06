#!/usr/bin/env bash
set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} $*"; }
error()   { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ── Pre-flight checks ──────────────────────────────────────────────────────────
info "Running pre-flight checks..."

if ! command -v aws &>/dev/null; then
  error "AWS CLI not found. Install it from https://aws.amazon.com/cli/"
  exit 1
fi

if ! aws sts get-caller-identity &>/dev/null; then
  error "Not authenticated with AWS. Run 'aws configure' or set AWS_PROFILE."
  exit 1
fi

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_DEFAULT_REGION:-ap-southeast-2}
info "Deploying to account ${ACCOUNT} in region ${REGION}"

# ── JWT Secret ─────────────────────────────────────────────────────────────────
if [[ -z "${JWT_SECRET:-}" ]]; then
  warn "JWT_SECRET not set. Generating a random secret for this deployment."
  warn "Set JWT_SECRET in your environment to use a stable value across deploys."
  export JWT_SECRET=$(openssl rand -base64 32)
fi

# ── Install dependencies ───────────────────────────────────────────────────────
info "Installing dependencies..."
pnpm install --frozen-lockfile

# ── Type-check ─────────────────────────────────────────────────────────────────
info "Type-checking..."
pnpm typecheck

# ── CDK bootstrap (idempotent) ─────────────────────────────────────────────────
info "Bootstrapping CDK environment (idempotent)..."
cd infra
pnpm cdk bootstrap "aws://${ACCOUNT}/${REGION}"

# ── Deploy ─────────────────────────────────────────────────────────────────────
info "Deploying stack..."
CDK_DEFAULT_ACCOUNT="${ACCOUNT}" \
CDK_DEFAULT_REGION="${REGION}" \
JWT_SECRET="${JWT_SECRET}" \
pnpm deploy

cd ..

info "Deployment complete."

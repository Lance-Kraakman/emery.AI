# Environment Setup Checklist

Use this checklist when setting up a new environment (staging/production) or verifying an existing one.

---

## Quick Reference: AWS Account IDs

| Environment | AWS Account ID | Secret Name |
|-------------|----------------|-------------|
| dev | 463735866328 | `emery-app-secrets/dev` |
| staging | 772302459598 | `emery-app-secrets/staging` |
| production | 034165313651 | `emery-app-secrets/production` |

---

## DEV Environment

### Secrets Manager: `emery-app-secrets/dev`

| Secret | Status | How to Get |
|--------|--------|------------|
| `NEXTAUTH_SECRET` | [x] Done | `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` | [x] Done | GitHub OAuth App (dev) |
| `GITHUB_CLIENT_SECRET` | [x] Done | GitHub OAuth App (dev) |
| `PIPEDREAM_PROJECT_ID` | [x] Done | Pipedream dashboard |
| `PIPEDREAM_CLIENT_ID` | [x] Done | Pipedream dashboard |
| `PIPEDREAM_CLIENT_SECRET` | [x] Done | Pipedream dashboard |
| `PIPEDREAM_API_KEY` | [x] Done | Pipedream dashboard |
| `OPENAI_API_KEY` | [x] Done | OpenAI dashboard |
| `HF_TOKEN` | [x] Done | Hugging Face settings |
| `GEMINI_API_KEY` | [x] Done | Google AI Studio |
| `RESEND_API_KEY` | [x] Done | Resend dashboard |
| `AWS_ACCESS_KEY_ID` | [x] Done | IAM user for S3 access |
| `AWS_SECRET_ACCESS_KEY` | [x] Done | IAM user for S3 access |
| `STRIPE_SECRET_KEY` | [x] Done | Stripe dashboard (test mode) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [x] Done | Stripe dashboard (test mode) |
| `STRIPE_PRO_PRODUCT_ID` | [x] Done | Stripe Products |
| `STRIPE_PRO_PRICE_ID_MONTHLY` | [x] Done | Stripe Prices |
| `STRIPE_PRO_PRICE_ID_YEARLY` | [x] Done | Stripe Prices |
| `STRIPE_MAX_PRODUCT_ID` | [x] Done | Stripe Products |
| `STRIPE_MAX_PRICE_ID_MONTHLY` | [x] Done | Stripe Prices |
| `STRIPE_MAX_PRICE_ID_YEARLY` | [x] Done | Stripe Prices |
| `STRIPE_ENTERPRISE_PRODUCT_ID` | [x] Done | Stripe Products |
| `STRIPE_WEBHOOK_SECRET` | [x] Done | Stripe Webhooks (endpoint: `https://dev.enhancd.ai/api/webhooks/stripe`) |
| `MODAL_TOKEN_ID` | [x] Done | Modal dashboard |
| `MODAL_TOKEN_SECRET` | [x] Done | Modal dashboard |
| `ENCRYPTION_KEY` | [x] Done | `openssl rand -base64 32` |
| `GRPC_CA_CERT` | [x] Done | Generated mTLS certs |
| `GRPC_SERVER_CERT` | [x] Done | Generated mTLS certs |
| `GRPC_SERVER_KEY` | [x] Done | Generated mTLS certs |
| `GRPC_CLIENT_CERT` | [x] Done | Generated mTLS certs |
| `GRPC_CLIENT_KEY` | [x] Done | Generated mTLS certs |
| `ADMIN_EMAILS` | [x] Done | `lancekraakman@outlook.com` |

---

## STAGING Environment

### Prerequisites
- [ ] Switch to staging AWS account: `export AWS_PROFILE=staging` or use account 772302459598

### Create Secrets Manager Secret
```bash
aws secretsmanager create-secret \
  --name emery-app-secrets/staging \
  --secret-string '{}' \
  --region ap-southeast-2
```

### Secrets Manager: `emery-app-secrets/staging`

| Secret | Status | How to Get |
|--------|--------|------------|
| `NEXTAUTH_SECRET` | [ ] TODO | `openssl rand -base64 32` (generate new) |
| `GITHUB_CLIENT_ID` | [ ] TODO | Create new GitHub OAuth App for `staging.enhancd.ai` |
| `GITHUB_CLIENT_SECRET` | [ ] TODO | From the OAuth App above |
| `PIPEDREAM_PROJECT_ID` | [ ] TODO | Same as dev OR create staging project |
| `PIPEDREAM_CLIENT_ID` | [ ] TODO | Same as dev OR create staging project |
| `PIPEDREAM_CLIENT_SECRET` | [ ] TODO | Same as dev OR create staging project |
| `PIPEDREAM_API_KEY` | [ ] TODO | Same as dev OR create staging project |
| `OPENAI_API_KEY` | [ ] TODO | Same as dev (shared API key) |
| `HF_TOKEN` | [ ] TODO | Same as dev (shared token) |
| `GEMINI_API_KEY` | [ ] TODO | Same as dev (shared API key) |
| `RESEND_API_KEY` | [ ] TODO | Same as dev (shared API key) |
| `AWS_ACCESS_KEY_ID` | [ ] TODO | Create IAM user in staging account |
| `AWS_SECRET_ACCESS_KEY` | [ ] TODO | From IAM user above |
| `STRIPE_SECRET_KEY` | [ ] TODO | Stripe TEST mode (same account, test keys) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [ ] TODO | Stripe TEST mode |
| `STRIPE_PRO_PRODUCT_ID` | [ ] TODO | Same test products as dev |
| `STRIPE_PRO_PRICE_ID_MONTHLY` | [ ] TODO | Same test prices as dev |
| `STRIPE_PRO_PRICE_ID_YEARLY` | [ ] TODO | Same test prices as dev |
| `STRIPE_MAX_PRODUCT_ID` | [ ] TODO | Same test products as dev |
| `STRIPE_MAX_PRICE_ID_MONTHLY` | [ ] TODO | Same test prices as dev |
| `STRIPE_MAX_PRICE_ID_YEARLY` | [ ] TODO | Same test prices as dev |
| `STRIPE_ENTERPRISE_PRODUCT_ID` | [ ] TODO | Same test products as dev |
| `STRIPE_WEBHOOK_SECRET` | [ ] TODO | Create webhook for `https://staging.enhancd.ai/api/webhooks/stripe` |
| `MODAL_TOKEN_ID` | [ ] TODO | Same as dev OR create staging workspace |
| `MODAL_TOKEN_SECRET` | [ ] TODO | Same as dev OR create staging workspace |
| `ENCRYPTION_KEY` | [ ] TODO | `openssl rand -base64 32` (generate new) |
| `GRPC_CA_CERT` | [ ] TODO | Generate new certs for staging |
| `GRPC_SERVER_CERT` | [ ] TODO | Generate new certs for staging |
| `GRPC_SERVER_KEY` | [ ] TODO | Generate new certs for staging |
| `GRPC_CLIENT_CERT` | [ ] TODO | Generate new certs for staging |
| `GRPC_CLIENT_KEY` | [ ] TODO | Generate new certs for staging |
| `ADMIN_EMAILS` | [ ] TODO | `lancekraakman@outlook.com` |

---

## PRODUCTION Environment

### Prerequisites
- [ ] Switch to production AWS account: `export AWS_PROFILE=production` or use account 034165313651

### Create Secrets Manager Secret
```bash
aws secretsmanager create-secret \
  --name emery-app-secrets/production \
  --secret-string '{}' \
  --region ap-southeast-2
```

### Secrets Manager: `emery-app-secrets/production`

| Secret | Status | How to Get |
|--------|--------|------------|
| `NEXTAUTH_SECRET` | [ ] TODO | `openssl rand -base64 32` (generate new - KEEP SECURE) |
| `GITHUB_CLIENT_ID` | [ ] TODO | Create new GitHub OAuth App for `enhancd.ai` |
| `GITHUB_CLIENT_SECRET` | [ ] TODO | From the OAuth App above |
| `PIPEDREAM_PROJECT_ID` | [ ] TODO | Create production Pipedream project |
| `PIPEDREAM_CLIENT_ID` | [ ] TODO | From production project |
| `PIPEDREAM_CLIENT_SECRET` | [ ] TODO | From production project |
| `PIPEDREAM_API_KEY` | [ ] TODO | From production project |
| `OPENAI_API_KEY` | [ ] TODO | Same as dev OR production-specific key |
| `HF_TOKEN` | [ ] TODO | Same as dev OR production-specific token |
| `GEMINI_API_KEY` | [ ] TODO | Same as dev OR production-specific key |
| `RESEND_API_KEY` | [ ] TODO | Same as dev OR production-specific key |
| `AWS_ACCESS_KEY_ID` | [ ] TODO | Create IAM user in production account |
| `AWS_SECRET_ACCESS_KEY` | [ ] TODO | From IAM user above |
| `STRIPE_SECRET_KEY` | [ ] TODO | Stripe LIVE mode keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [ ] TODO | Stripe LIVE mode keys |
| `STRIPE_PRO_PRODUCT_ID` | [ ] TODO | Create LIVE products in Stripe |
| `STRIPE_PRO_PRICE_ID_MONTHLY` | [ ] TODO | Create LIVE prices in Stripe |
| `STRIPE_PRO_PRICE_ID_YEARLY` | [ ] TODO | Create LIVE prices in Stripe |
| `STRIPE_MAX_PRODUCT_ID` | [ ] TODO | Create LIVE products in Stripe |
| `STRIPE_MAX_PRICE_ID_MONTHLY` | [ ] TODO | Create LIVE prices in Stripe |
| `STRIPE_MAX_PRICE_ID_YEARLY` | [ ] TODO | Create LIVE prices in Stripe |
| `STRIPE_ENTERPRISE_PRODUCT_ID` | [ ] TODO | Create LIVE product in Stripe |
| `STRIPE_WEBHOOK_SECRET` | [ ] TODO | Create webhook for `https://enhancd.ai/api/webhooks/stripe` |
| `MODAL_TOKEN_ID` | [ ] TODO | Create production Modal workspace |
| `MODAL_TOKEN_SECRET` | [ ] TODO | From production workspace |
| `ENCRYPTION_KEY` | [ ] TODO | `openssl rand -base64 32` (generate new - KEEP SECURE) |
| `GRPC_CA_CERT` | [ ] TODO | Generate new certs for production |
| `GRPC_SERVER_CERT` | [ ] TODO | Generate new certs for production |
| `GRPC_SERVER_KEY` | [ ] TODO | Generate new certs for production |
| `GRPC_CLIENT_CERT` | [ ] TODO | Generate new certs for production |
| `GRPC_CLIENT_KEY` | [ ] TODO | Generate new certs for production |
| `ADMIN_EMAILS` | [ ] TODO | `lancekraakman@outlook.com` |

---

## Service Setup Guides

### 1. GitHub OAuth App

For each environment, create a new OAuth App at https://github.com/settings/developers

| Environment | Homepage URL | Callback URL |
|-------------|--------------|--------------|
| dev | `https://dev.enhancd.ai` | `https://dev.enhancd.ai/api/auth/callback/github` |
| staging | `https://staging.enhancd.ai` | `https://staging.enhancd.ai/api/auth/callback/github` |
| production | `https://enhancd.ai` | `https://enhancd.ai/api/auth/callback/github` |

### 2. Stripe Setup

**For dev/staging (TEST mode):**
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy the test keys (start with `sk_test_` and `pk_test_`)
3. Products and prices can be shared across dev/staging

**For production (LIVE mode):**
1. Go to https://dashboard.stripe.com/apikeys (ensure toggle is on "Live")
2. Copy the live keys (start with `sk_live_` and `pk_live_`)
3. Create new products and prices in live mode:
   - Pro Plan (monthly + yearly)
   - Max Plan (monthly + yearly)
   - Enterprise Plan

**Webhook Setup:**
1. Go to https://dashboard.stripe.com/webhooks
2. Create endpoint for each environment
3. Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
4. Copy the signing secret (`whsec_...`)

### 3. Generate mTLS Certificates

Run this script to generate certificates for an environment:

```bash
ENV=staging  # or production
mkdir -p certs/$ENV && cd certs/$ENV

# Generate CA
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/CN=Emery $ENV CA"

# Generate server cert
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/CN=agent.emery.local"
cat > server.ext << EOF
subjectAltName = DNS:localhost, DNS:agent.emery.local, IP:127.0.0.1
EOF
openssl x509 -req -days 3650 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -extfile server.ext

# Generate client cert
openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr -subj "/CN=emery-nextjs-client"
openssl x509 -req -days 3650 -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt

# Output for Secrets Manager (copy these)
echo "GRPC_CA_CERT:"
cat ca.crt
echo ""
echo "GRPC_SERVER_CERT:"
cat server.crt
echo ""
echo "GRPC_SERVER_KEY:"
cat server.key
echo ""
echo "GRPC_CLIENT_CERT:"
cat client.crt
echo ""
echo "GRPC_CLIENT_KEY:"
cat client.key
```

### 4. Generate Encryption Key

```bash
openssl rand -base64 32
```

### 5. Generate NextAuth Secret

```bash
openssl rand -base64 32
```

---

## Bulk Secret Update Script

Use this to update multiple secrets at once:

```bash
# Set environment
ENV=staging  # or production
SECRET_NAME=emery-app-secrets/$ENV

# Create JSON with all secrets
cat > /tmp/secrets.json << 'EOF'
{
  "NEXTAUTH_SECRET": "YOUR_VALUE",
  "GITHUB_CLIENT_ID": "YOUR_VALUE",
  "GITHUB_CLIENT_SECRET": "YOUR_VALUE",
  ...
}
EOF

# Update secret
aws secretsmanager update-secret \
  --secret-id $SECRET_NAME \
  --secret-string file:///tmp/secrets.json

# Clean up
rm /tmp/secrets.json
```

---

## Verification

After deploying to an environment, verify secrets are injected:

```bash
# Get cluster and service names
CLUSTER=$(aws ecs list-clusters --query "clusterArns[?contains(@, 'EmeryStaging')]" --output text)
SERVICE=$(aws ecs list-services --cluster $CLUSTER --query "serviceArns[0]" --output text)

# Get running task
TASK=$(aws ecs list-tasks --cluster $CLUSTER --service-name $SERVICE --query "taskArns[0]" --output text)

# Check environment variables (will show secret ARNs, not values)
aws ecs describe-tasks --cluster $CLUSTER --tasks $TASK \
  --query "tasks[0].containers[0].environment"
```

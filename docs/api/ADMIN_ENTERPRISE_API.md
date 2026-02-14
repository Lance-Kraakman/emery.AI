# Admin Enterprise Provisioning API

## Overview

This API provides superuser/admin-only endpoints for managing Enterprise customer provisioning. Access is restricted to emails listed in the `ADMIN_EMAILS` environment variable.

## Authentication

All endpoints require:
1. Valid session cookie (authenticated user)
2. User email must be in `ADMIN_EMAILS` environment variable

### Setup

Add admin emails to `.env`:
```bash
ADMIN_EMAILS=your@email.com,cofounder@email.com,admin@yourcompany.com
```

## Endpoints

### GET /api/admin/enterprises

List all organizations with billing status.

**Auth:** Required (admin only)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Acme Corp",
      "plan": "free",
      "usageAllowanceCredits": 1000,
      "creditsUsedCurrentMonth": 450,
      "spendingLimitUsd": "0.00",
      "stripeCustomerId": "cus_xxxxx",
      "stripeSubscriptionId": null,
      "stripeSubscriptionStatus": null,
      "customPriceId": null,
      "billingEmail": "billing@acme.com",
      "currentPeriodStart": null,
      "currentPeriodEnd": null,
      "createdAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "name": "BigCorp Inc",
      "plan": "enterprise",
      "usageAllowanceCredits": 5000000,
      "creditsUsedCurrentMonth": 2300000,
      "spendingLimitUsd": "100.00",
      "stripeCustomerId": "cus_yyyyy",
      "stripeSubscriptionId": "sub_zzzzz",
      "stripeSubscriptionStatus": "active",
      "customPriceId": "price_custom_abc",
      "billingEmail": "finance@bigcorp.com",
      "currentPeriodStart": "2025-01-01T00:00:00Z",
      "currentPeriodEnd": "2025-02-01T00:00:00Z",
      "createdAt": "2024-12-01T08:15:00Z"
    }
  ],
  "total": 2
}
```

**Error Responses:**
- `403`: Unauthorized - Admin access required
- `500`: Server error

---

### POST /api/admin/enterprises/assign

Assign Enterprise plan with custom pricing to an organization.

**Auth:** Required (admin only)

**Request Body:**
```json
{
  "organizationId": 123,
  "monthlyPriceUsd": 999,
  "creditsAllowance": 5000000
}
```

**Fields:**
- `organizationId` (number, required): ID of the organization
- `monthlyPriceUsd` (number, required): Monthly subscription price in USD
- `creditsAllowance` (number, required): Monthly credit allowance

**What it does:**
1. Validates organization exists
2. Creates Stripe customer if doesn't exist
3. Creates custom Stripe price for this organization
4. Creates Stripe subscription with custom price
5. Updates organization in database:
   - Sets `plan = 'enterprise'`
   - Sets `customPriceId`
   - Sets `usageAllowanceCredits`
   - Sets `stripeSubscriptionId` and status
   - Sets billing period dates

**Response:**
```json
{
  "success": true,
  "data": {
    "organizationId": 123,
    "organizationName": "BigCorp Inc",
    "plan": "enterprise",
    "monthlyPriceUsd": 999,
    "creditsAllowance": 5000000,
    "stripePriceId": "price_custom_abc123",
    "stripeSubscriptionId": "sub_xyz456",
    "subscriptionStatus": "active"
  }
}
```

**Error Responses:**
- `400`: Missing required fields or invalid values
- `403`: Unauthorized - Admin access required
- `404`: Organization not found
- `500`: Server error or Stripe API error

---

## Usage Examples

### Using curl

#### 1. List all organizations

```bash
curl -X GET http://localhost:3000/api/admin/enterprises \
  -H "Cookie: authjs.session-token=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

#### 2. Assign Enterprise plan

```bash
curl -X POST http://localhost:3000/api/admin/enterprises/assign \
  -H "Cookie: authjs.session-token=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": 123,
    "monthlyPriceUsd": 999,
    "creditsAllowance": 5000000
  }'
```

### Using Postman

1. **Set up authentication:**
   - Login to your app in browser
   - Open DevTools → Application → Cookies
   - Copy the `authjs.session-token` value
   - In Postman, add Cookie header: `authjs.session-token=YOUR_TOKEN`

2. **GET request:**
   - URL: `http://localhost:3000/api/admin/enterprises`
   - Method: GET
   - Headers:
     - `Content-Type: application/json`
     - `Cookie: authjs.session-token=YOUR_TOKEN`

3. **POST request:**
   - URL: `http://localhost:3000/api/admin/enterprises/assign`
   - Method: POST
   - Headers:
     - `Content-Type: application/json`
     - `Cookie: authjs.session-token=YOUR_TOKEN`
   - Body (JSON):
     ```json
     {
       "organizationId": 123,
       "monthlyPriceUsd": 999,
       "creditsAllowance": 5000000
     }
     ```

### Using JavaScript/Fetch

```javascript
// Must be called from authenticated browser context
async function assignEnterprisePlan(orgId, price, credits) {
  const response = await fetch('/api/admin/enterprises/assign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organizationId: orgId,
      monthlyPriceUsd: price,
      creditsAllowance: credits,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to assign plan');
  }

  return await response.json();
}

// Usage
await assignEnterprisePlan(123, 999, 5000000);
```

---

## Workflow: Provisioning an Enterprise Customer

### Step 1: Sales/Contract Negotiation
- Agree on monthly price (e.g., $999/month)
- Agree on monthly credit allowance (e.g., 5,000,000 credits)

### Step 2: Find Organization ID
```bash
# List all organizations to find the ID
curl -X GET http://localhost:3000/api/admin/enterprises \
  -H "Cookie: authjs.session-token=YOUR_TOKEN"

# Look for the organization in the response
# Note the "id" field (e.g., 123)
```

### Step 3: Assign Enterprise Plan
```bash
curl -X POST http://localhost:3000/api/admin/enterprises/assign \
  -H "Cookie: authjs.session-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": 123,
    "monthlyPriceUsd": 999,
    "creditsAllowance": 5000000
  }'
```

### Step 4: Verify in Stripe Dashboard
1. Go to https://dashboard.stripe.com/subscriptions
2. Find the subscription for the customer
3. Verify the custom price is attached
4. Confirm billing is set up correctly

### Step 5: Notify Customer
- Send confirmation email with billing details
- Provide login credentials if needed
- Explain overage billing (if spending limit > $0)

---

## Troubleshooting

### "Unauthorized - Admin access required"
- Check that your email is in `ADMIN_EMAILS` environment variable
- Verify you're logged in (check session cookie)
- Restart server after updating `.env` file

### "Organization not found"
- Verify the organization ID exists
- Check the GET endpoint to see all organizations

### "STRIPE_ENTERPRISE_PRODUCT_ID not configured"
- Create an Enterprise product in Stripe Dashboard
- Add the product ID to `.env` file
- Restart server

### Stripe API errors
- Check Stripe API key is valid
- Verify Stripe account has proper permissions
- Check Stripe Dashboard for more details on the error

---

## Security Notes

1. **Admin access is critical** - Only add trusted developer/admin emails to `ADMIN_EMAILS`
2. **No UI = harder to exploit** - API-only access reduces attack surface
3. **Audit logs** - All requests are logged to console (consider adding to database)
4. **Rate limiting** - Consider adding rate limits for production
5. **HTTPS only** - Ensure all requests use HTTPS in production

---

## Future Enhancements

Potential additions for the future:

1. **Admin UI** - Build a simple admin dashboard for provisioning
2. **Audit logging** - Store all admin actions in database
3. **Bulk operations** - Update multiple organizations at once
4. **Custom allowance periods** - Support quarterly/annual billing cycles
5. **Invoice management** - View/void/regenerate invoices
6. **Usage analytics** - See Enterprise usage trends
7. **Contract tracking** - Attach contract PDFs to organizations

---

## Support

For issues or questions:
- Check server logs for error details
- Verify Stripe Dashboard for payment/subscription status
- Contact development team for access issues

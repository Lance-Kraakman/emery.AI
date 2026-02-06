# WAF Configuration & Next.js Server Actions

## Overview

The WAF (Web Application Firewall) is deployed to CloudFront to protect against common attacks. However, some AWS Managed Rules can cause false positives with Next.js Server Actions.

## The Problem: Server Actions vs WAF

### How Server Actions Work

Next.js Server Actions send POST requests to the same URL as the page:
```
POST /organization/settings/audit-log
Content-Type: text/plain;charset=UTF-8
Next-Action: 4044f67dbdb1af6a5867857141e2fda92c2bc09c65
Body: [serialized function arguments]
```

### Why WAF Blocks Them

AWS Managed Rules scan request bodies for attack patterns:
- **`CrossSiteScripting_BODY`** - flags XSS-like patterns in serialized payloads
- **`GenericRFI_BODY`** - flags URL-like strings (Remote File Inclusion)

These rules don't understand that Server Action payloads are legitimate application data.

### Symptoms

- 403 responses from CloudFront (not your app)
- `x-cache: Error from cloudfront` header
- 919-byte HTML error page (WAF block page)
- Works locally, fails in production

## Solution: WAF Rule Exclusions

We exclude specific rules that cause false positives:

```python
# infra/infra/waf_stack.py
excluded_rules=[
    "SizeRestrictions_BODY",      # Allow large uploads (5MB+)
    "CrossSiteScripting_BODY",    # Prevent false positives on Server Actions
    "GenericRFI_BODY",            # Prevent false positives on URLs in payloads
]
```

## Server Actions vs API Routes: When to Use Each

### Use Server Actions For:
- Form submissions
- Data mutations (create, update, delete)
- Actions triggered by user interaction
- When you want colocation of client/server code

**Pros:**
- Type-safe end-to-end
- No API boilerplate
- Automatic request deduplication
- Progressive enhancement (works without JS)

**Cons:**
- Can trigger WAF false positives (mitigated by exclusions)
- Less visibility in network tab (debugging harder)
- Tied to React component lifecycle

### Use API Routes (`/api/*`) For:
- Webhooks from external services
- Public APIs consumed by third parties
- Long-polling / streaming responses
- When you need explicit HTTP control

**Pros:**
- Standard REST semantics
- Easy to test with curl/Postman
- Clear separation of concerns
- No WAF issues (simpler payloads)

**Cons:**
- More boilerplate
- Manual type synchronization
- No automatic React integration

### Recommendation

**Keep using Server Actions for internal app operations.** The WAF exclusions handle the false positives, and you get better DX with type safety and colocation.

Use API routes for:
- `/api/webhooks/*` - external integrations
- `/api/health` - load balancer health checks
- `/api/audit` - if you need REST access for external tools

## Security Considerations

### Are the Exclusions Safe?

Yes, because:

1. **Defense in depth** - WAF is one layer; you also have:
   - Input validation in your Server Actions
   - Parameterized queries (no SQL injection)
   - React's automatic XSS escaping
   - Authentication/authorization checks

2. **Scope is limited** - Only these specific body-scanning rules are excluded:
   - XSS protection still applies to query params, headers, cookies
   - SQL injection rules remain active
   - Rate limiting remains active
   - IP reputation rules remain active

3. **Server Actions validate input** - Your `withAuthContext` and `requirePermission` wrappers already validate requests

### What's Still Protected

| Attack Vector | Protection Status |
|---------------|-------------------|
| SQL Injection | ✅ Active (AWSManagedRulesSQLiRuleSet) |
| Known Bad Inputs (Log4j) | ✅ Active (KnownBadInputsRuleSet) |
| Malicious IPs | ✅ Active (AmazonIpReputationList) |
| Rate Limiting | ✅ Active (custom rate rules) |
| XSS in Query/Headers | ✅ Active (only body excluded) |
| XSS in Body | ⚠️ Excluded - rely on React escaping |
| RFI in Body | ⚠️ Excluded - not applicable to your app |

## Debugging WAF Issues

### Check if WAF is blocking:
```bash
# Response headers will show:
# x-cache: Error from cloudfront
# server: CloudFront
# Content-Type: text/html (WAF block page)
```

### View WAF metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=WebACL,Value=EmeryDevWAF Name=Region,Value=CLOUDFRONT \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 --statistics Sum --region us-east-1
```

### Get sampled blocked requests:
```bash
aws wafv2 get-sampled-requests \
  --web-acl-arn "arn:aws:wafv2:us-east-1:ACCOUNT:global/webacl/EmeryDevWAF/ID" \
  --rule-metric-name "AWSManagedRulesCommonRuleSet" \
  --scope CLOUDFRONT \
  --time-window "StartTime=...,EndTime=..." \
  --max-items 10 --region us-east-1
```

## Adding New Exclusions

If you encounter new false positives:

1. Check response headers to confirm WAF is blocking
2. Identify the rule using sampled requests or trial exclusion
3. Add to `excluded_rules` in `waf_stack.py`
4. Document why the exclusion is safe
5. Deploy WAF stack: `cdk deploy Emery-WAF-Dev -c env=dev ...`

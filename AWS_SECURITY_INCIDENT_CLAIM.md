# AWS Security Incident Cost Claim

**Account ID:** 463735866328
**Incident Period:** December 13, 2025 - January 8, 2026
**Date Submitted:** January 12, 2026

---

## Summary

Our application was compromised via a critical Remote Code Execution vulnerability in Next.js (GHSA-9qr9-h5gf-34mp, CVSS 10.0). Attackers accessed AWS credentials and launched unauthorized resources.

**Total Claim: ~$800 USD**

---

## Vulnerability Details

| Field | Value |
|-------|-------|
| CVE | GHSA-9qr9-h5gf-34mp |
| CVSS Score | 10.0 (Critical) |
| Affected Version | next@15.4.5 |
| Fixed Version | 15.4.8+ |
| Attack Vector | React Flight protocol deserialization |

Reference: https://github.com/vercel/next.js/security/advisories/GHSA-9qr9-h5gf-34mp

---

## EVIDENCE 1: CloudTrail - Malicious IAM User Creation

Attacker created admin users using stolen DEV_USER credentials:

```
Event: CreateUser
Time: 2026-01-08T15:27:04Z
Source IP: 27.121.112.40 (Medan, Indonesia)
User Agent: Boto3/1.40.12 os/windows#11 lang/python#3.13.5
Created User: Predator-Admin-729
Request ID: 3d543836-7162-4ab6-9ad3-106b5a4f269b
```

```
Event: CreateUser
Time: 2026-01-04T04:46:38Z
Source IP: (attacker)
Created User: sysadmin-1727
Access Key Used: AKIAWX6GPYPMDUEVHTNL (compromised DEV_USER key)
```

**Additional malicious users created:**
- Predator-Admin-634
- Predator-Admin-827
- Predator-Admin-758
- Predator-Admin-585
- Predator-Admin-205
- VIK, VIK1
- AwsAdmin
- admins
- louisteloega

---

## EVIDENCE 2: CloudTrail - Unauthorized EC2 Launch Attempt

Attacker attempted to launch EC2 instances using stolen credentials:

```
Event: RunInstances
Time: 2026-01-06T17:06:42Z
Source IP: 41.226.17.17 (Tunisia)
Region: ap-southeast-2
User Agent: Boto3/1.42.19 os/windows#11 lang/python#3.13.9
Instance Type: t2.micro
AMI: ami-0c02fb55956c7d316 (US East AMI - doesn't exist in ap-southeast-2)
Error: Client.InvalidAMIID.NotFound
Access Key: AKIAWX6GPYPMDUEVHTNL (compromised)
```

---

## EVIDENCE 3: Cost Explorer - Unauthorized EC2 in us-west-2

We operate exclusively in ap-southeast-2. Attacker launched crypto mining instances in us-west-2:

```
Region: us-west-2
Period: December 2025

Service                                    | Cost (USD)
-------------------------------------------|------------
Amazon Elastic Compute Cloud - Compute     | $497.44
EC2 - Other                                | $2.55
Amazon Virtual Private Cloud               | $0.92
-------------------------------------------|------------
Total                                      | $500.91
```

**We have zero legitimate infrastructure in us-west-2.**

---

## EVIDENCE 4: ECS Auto-Scaling Activity Log

Malicious code injected via RCE caused CPU spike, triggering runaway auto-scaling:

```
Timestamp (UTC)           | Action
--------------------------|----------------------------------
2026-01-10 17:00:22       | Setting desired count to 20
2026-01-09 09:04:22       | Setting desired count to 19
2026-01-06 13:57:22       | Setting desired count to 18
2026-01-06 13:55:22       | Setting desired count to 17
2026-01-06 13:05:22       | Setting desired count to 16
2026-01-06 13:03:22       | Setting desired count to 15
2026-01-06 12:25:22       | Setting desired count to 14
2026-01-06 12:22:22       | Setting desired count to 13
2026-01-06 12:20:22       | Setting desired count to 12
2026-01-06 10:29:22       | Setting desired count to 11
2026-01-06 10:26:22       | Setting desired count to 10
2026-01-06 10:24:22       | Setting desired count to 9
2026-01-06 09:30:22       | Setting desired count to 8
2026-01-06 09:25:22       | Setting desired count to 6
2026-01-03 17:34:22       | Setting desired count to 4
2026-01-02 11:54:13       | Setting desired count to 3
2025-12-30 11:14:13       | Setting desired count to 2  (normal)
```

**Key observations:**
- Normal operation: 2 tasks
- Attack caused escalation to 20 tasks (10x normal)
- No corresponding increase in legitimate user traffic
- CPU at 77% constant from malicious code execution

---

## Cost Claim Summary

| Item | Amount | Evidence |
|------|--------|----------|
| Unauthorized EC2 (us-west-2) | $500.91 | Cost Explorer + we don't operate in us-west-2 |
| ECS over-scaling (20 vs 2 tasks) | ~$250 | Scaling logs + no user traffic |
| Network overhead | ~$50 | NAT/ELB from attack traffic |
| **Total** | **~$800** | |

---

## Attacker IPs Observed

| IP Address | Location | Activity |
|------------|----------|----------|
| 27.121.112.40 | Medan, Indonesia | Primary - IAM user creation |
| 41.226.17.17 | Tunisia | EC2 launch attempts |
| 45.92.211.26 | - | IAM activity |
| 45.92.210.91 | - | IAM activity |
| 45.92.211.126 | - | IAM activity |

---

## Remediation Completed

1. Upgraded Next.js 15.4.5 → 15.4.10 (patched)
2. Deleted all malicious IAM users
3. Reduced ECS auto-scaling max 20 → 2
4. Rotated AWS access keys
5. Force redeployed ECS containers
6. Enabled AWS WAF for web application protection
7. Enabled AWS Security Hub for centralized security monitoring
8. Enabled AWS GuardDuty for threat detection

---

## Contact

Please contact us if additional evidence is required.

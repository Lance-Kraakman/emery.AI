"""
AWS WAF Stack for CloudFront Protection

This stack must be deployed to us-east-1 (required for CloudFront WAF).
It creates a Web ACL with rate limiting and AWS managed security rules.
"""

from aws_cdk import (
    Stack,
    CfnOutput,
    aws_wafv2 as wafv2,
)
from constructs import Construct


class WAFStack(Stack):
    """
    WAF Stack for protecting CloudFront distribution.

    Must be deployed to us-east-1 for CloudFront scope.
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        env_name: str,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        prefix = env_name.capitalize()

        # Create Web ACL for CloudFront
        self.web_acl = wafv2.CfnWebACL(
            self,
            "WebACL",
            name=f"Emery{prefix}WAF",
            default_action=wafv2.CfnWebACL.DefaultActionProperty(allow={}),
            scope="CLOUDFRONT",  # Must be CLOUDFRONT for CloudFront distributions
            visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                cloud_watch_metrics_enabled=True,
                metric_name=f"Emery{prefix}WAF",
                sampled_requests_enabled=True
            ),
            rules=self._get_rules(prefix)
        )

        # Export ARN for cross-region reference
        CfnOutput(
            self,
            "WebACLArn",
            value=self.web_acl.attr_arn,
            description="WAF Web ACL ARN for CloudFront association"
        )

    def _get_rules(self, prefix: str) -> list:
        """Build the list of WAF rules."""
        return [
            # Priority 0: Auth endpoint rate limit (strict - brute force protection)
            self._rate_limit_rule(
                name="AuthRateLimit",
                priority=0,
                limit=100,  # 100 requests per 5 min = ~20/min (AWS WAF minimum)
                path_pattern="/api/auth",
                prefix=prefix
            ),
            # Priority 1: Chat endpoint rate limit (expensive operations)
            self._rate_limit_rule(
                name="ChatRateLimit",
                priority=1,
                limit=150,  # 150 requests per 5 min = ~30/min
                path_pattern="/api/chat",
                prefix=prefix
            ),
            # Priority 2: Files endpoint rate limit
            self._rate_limit_rule(
                name="FilesRateLimit",
                priority=2,
                limit=100,  # 100 requests per 5 min = ~20/min
                path_pattern="/api/files",
                prefix=prefix
            ),
            # Priority 3: Webhooks rate limit (higher for integrations)
            self._rate_limit_rule(
                name="WebhooksRateLimit",
                priority=3,
                limit=300,  # 300 requests per 5 min = ~60/min
                path_pattern="/api/webhooks",
                prefix=prefix
            ),
            # Priority 4: Global rate limit (catch-all)
            self._rate_limit_rule(
                name="GlobalRateLimit",
                priority=4,
                limit=2000,  # 2000 requests per 5 min = ~400/min
                path_pattern=None,  # No path filter = all requests
                prefix=prefix
            ),
            # Priority 5: AWS Managed - Amazon IP Reputation List
            # Blocks known malicious IPs from AWS threat intelligence
            self._managed_rule(
                name="AWSManagedRulesAmazonIpReputationList",
                priority=5,
                vendor_name="AWS",
                rule_group_name="AWSManagedRulesAmazonIpReputationList",
                prefix=prefix
            ),
            # Priority 6: AWS Managed - Anonymous IP List
            # Blocks VPNs/proxies commonly used by attackers
            self._managed_rule(
                name="AWSManagedRulesAnonymousIpList",
                priority=6,
                vendor_name="AWS",
                rule_group_name="AWSManagedRulesAnonymousIpList",
                prefix=prefix
            ),
            # Priority 7: AWS Managed - Common Rule Set (OWASP protections)
            # Exclude SizeRestrictions_BODY to allow large POST bodies (templates, file uploads up to 5MB)
            self._managed_rule(
                name="AWSManagedRulesCommonRuleSet",
                priority=7,
                vendor_name="AWS",
                rule_group_name="AWSManagedRulesCommonRuleSet",
                prefix=prefix,
                excluded_rules=["SizeRestrictions_BODY"]
            ),
            # Priority 8: AWS Managed - Known Bad Inputs (Log4j, etc.)
            self._managed_rule(
                name="AWSManagedRulesKnownBadInputsRuleSet",
                priority=8,
                vendor_name="AWS",
                rule_group_name="AWSManagedRulesKnownBadInputsRuleSet",
                prefix=prefix
            ),
            # Priority 9: AWS Managed - SQL Injection protection
            self._managed_rule(
                name="AWSManagedRulesSQLiRuleSet",
                priority=9,
                vendor_name="AWS",
                rule_group_name="AWSManagedRulesSQLiRuleSet",
                prefix=prefix
            ),
        ]

    def _rate_limit_rule(
        self,
        name: str,
        priority: int,
        limit: int,
        path_pattern: str | None,
        prefix: str
    ) -> wafv2.CfnWebACL.RuleProperty:
        """
        Create a rate-based rule.

        Args:
            name: Rule name
            priority: Rule priority (lower = evaluated first)
            limit: Max requests per 5-minute window per IP
            path_pattern: URI path prefix to match (None for all requests)
            prefix: Environment prefix for metrics
        """
        # Build the rate-based statement
        rate_statement = wafv2.CfnWebACL.RateBasedStatementProperty(
            limit=limit,
            aggregate_key_type="IP"
        )

        # If path pattern specified, scope down to that path
        if path_pattern:
            rate_statement = wafv2.CfnWebACL.RateBasedStatementProperty(
                limit=limit,
                aggregate_key_type="IP",
                scope_down_statement=wafv2.CfnWebACL.StatementProperty(
                    byte_match_statement=wafv2.CfnWebACL.ByteMatchStatementProperty(
                        search_string=path_pattern,
                        field_to_match=wafv2.CfnWebACL.FieldToMatchProperty(
                            uri_path={}
                        ),
                        text_transformations=[
                            wafv2.CfnWebACL.TextTransformationProperty(
                                priority=0,
                                type="LOWERCASE"
                            )
                        ],
                        positional_constraint="STARTS_WITH"
                    )
                )
            )

        return wafv2.CfnWebACL.RuleProperty(
            name=name,
            priority=priority,
            action=wafv2.CfnWebACL.RuleActionProperty(block={}),
            statement=wafv2.CfnWebACL.StatementProperty(
                rate_based_statement=rate_statement
            ),
            visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                cloud_watch_metrics_enabled=True,
                metric_name=f"{prefix}{name}",
                sampled_requests_enabled=True
            )
        )

    def _managed_rule(
        self,
        name: str,
        priority: int,
        vendor_name: str,
        rule_group_name: str,
        prefix: str,
        excluded_rules: list[str] | None = None
    ) -> wafv2.CfnWebACL.RuleProperty:
        """
        Create a managed rule group reference.

        Args:
            name: Rule name
            priority: Rule priority
            vendor_name: Vendor name (e.g., "AWS")
            rule_group_name: Name of the managed rule group
            prefix: Environment prefix for metrics
            excluded_rules: List of rule names to exclude from the managed group
        """
        rule_exclusions = []
        if excluded_rules:
            rule_exclusions = [
                wafv2.CfnWebACL.ExcludedRuleProperty(name=rule_name)
                for rule_name in excluded_rules
            ]

        return wafv2.CfnWebACL.RuleProperty(
            name=name,
            priority=priority,
            # Use override_action for managed rule groups (not action)
            override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
            statement=wafv2.CfnWebACL.StatementProperty(
                managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                    vendor_name=vendor_name,
                    name=rule_group_name,
                    excluded_rules=rule_exclusions if rule_exclusions else None
                )
            ),
            visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                cloud_watch_metrics_enabled=True,
                metric_name=f"{prefix}{name.replace('AWS', '')}",
                sampled_requests_enabled=True
            )
        )

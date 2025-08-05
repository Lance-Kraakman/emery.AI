"""
Gmail integration examples for Orchastrate Python client.
"""

import base64
import logging
from typing import Dict, Optional, Any

from .client import OrchastratePythonClient
from .types import ExecutionResult, ProxyResult


logger = logging.getLogger(__name__)


class GmailIntegration:
    """Gmail-specific integration examples."""
    
    def __init__(self, client: OrchastratePythonClient):
        """
        Initialize Gmail integration.
        
        Args:
            client: Configured OrchastratePythonClient instance
        """
        self.client = client
        logger.info("Initialized Gmail integration")
    
    def send_email(
        self, 
        to: str, 
        subject: str, 
        body: str, 
        cc: Optional[str] = None
    ) -> ExecutionResult:
        """
        Send an email via Gmail using Pipedream action.
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body text
            cc: Optional CC email address
            
        Returns:
            Execution result from the action
        """
        logger.info('📧 === Gmail: Send Email ===')
        
        props: Dict[str, Any] = {
            "to": to,
            "subject": subject,
            "body": body,
        }
        
        if cc:
            props["cc"] = cc
        
        return self.client.execute_action("gmail-send-email", props)
    
    def get_messages(
        self, 
        query: str = "is:unread", 
        max_results: int = 5
    ) -> ExecutionResult:
        """
        Get Gmail messages using Pipedream action.
        
        Args:
            query: Gmail search query
            max_results: Maximum number of messages to retrieve
            
        Returns:
            Execution result with messages data
        """
        logger.info('📬 === Gmail: Get Messages ===')
        
        return self.client.execute_action("gmail-get-messages", {
            "query": query,
            "maxResults": max_results,
        })
    
    def get_profile(self) -> ProxyResult:
        """
        Get Gmail profile via proxy API call.
        
        Returns:
            Proxy result with profile data
        """
        logger.info('👤 === Gmail: Get Profile via Proxy ===')
        
        return self.client.proxy_request("gmail", "/gmail/v1/users/me/profile")
    
    def search_messages(
        self, 
        query: str = "from:noreply", 
        max_results: int = 3
    ) -> ProxyResult:
        """
        Search messages via proxy API call.
        
        Args:
            query: Gmail search query
            max_results: Maximum number of results
            
        Returns:
            Proxy result with search results
        """
        logger.info('🔍 === Gmail: Search Messages via Proxy ===')
        
        return self.client.proxy_request(
            "gmail",
            "/gmail/v1/users/me/messages",
            params={"q": query, "maxResults": str(max_results)}
        )
    
    def send_email_via_proxy(
        self, 
        to: str, 
        subject: str, 
        body: str
    ) -> ProxyResult:
        """
        Send email via direct proxy call to Gmail API.
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body text
            
        Returns:
            Proxy result from Gmail API
        """
        logger.info('📮 === Gmail: Send Email via Proxy ===')
        
        # AIDEV-NOTE: Create RFC 2822 compliant email message
        email_content = f"""To: {to}
Subject: {subject}
Content-Type: text/plain; charset=UTF-8

{body}"""
        
        # Encode as base64url for Gmail API
        raw_message = base64.urlsafe_b64encode(email_content.encode()).decode()
        
        return self.client.proxy_request(
            "gmail",
            "/gmail/v1/users/me/messages/send",
            method="POST",
            data={"raw": raw_message}
        )
    
    def webhook_example(self) -> ExecutionResult:
        """
        Demonstrate webhook-based execution.
        
        Returns:
            Execution result (actual result delivered via webhook)
        """
        logger.info('🎣 === Gmail: Webhook Example ===')
        
        return self.client.execute_action("gmail-get-messages", {
            "query": "is:inbox",
            "maxResults": 1,
        }, use_webhook=True)
    
    def list_labels(self) -> ProxyResult:
        """
        List Gmail labels via proxy.
        
        Returns:
            Proxy result with labels data
        """
        logger.info('🏷️ === Gmail: List Labels ===')
        
        return self.client.proxy_request("gmail", "/gmail/v1/users/me/labels")
    
    def get_thread(self, thread_id: str) -> ProxyResult:
        """
        Get a specific Gmail thread via proxy.
        
        Args:
            thread_id: Gmail thread ID
            
        Returns:
            Proxy result with thread data
        """
        logger.info(f'🧵 === Gmail: Get Thread {thread_id} ===')
        
        return self.client.proxy_request(
            "gmail", 
            f"/gmail/v1/users/me/threads/{thread_id}"
        )
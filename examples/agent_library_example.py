"""
Example Agent Library - Customer Onboarding Agent

This shows how you would write agent libraries that use Emery OAuth proxy.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend', 'src'))

from emery_client.simple_client import EmeryPythonClient
from typing import Dict, Any


class CustomerOnboardingAgent:
    """
    Example agent library for customer onboarding automation.
    
    This agent:
    1. Sends welcome email via user's Gmail
    2. Creates customer Slack channel 
    3. Creates GitHub issues for setup tasks
    """
    
    def __init__(self, config: Dict[str, Any], oauth_proxy: EmeryPythonClient):
        """
        Initialize agent with config from frontend.
        
        Args:
            config: Configuration from Emery dashboard
            oauth_proxy: OAuth proxy client with agent API key
        """
        self.config = config
        self.oauth = oauth_proxy
        
    def onboard_customer(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Complete customer onboarding process.
        
        Args:
            customer_data: Customer information
            
        Returns:
            Onboarding results
        """
        results = {
            'customer_id': customer_data.get('id'),
            'steps_completed': [],
            'errors': []
        }
        
        try:
            # Step 1: Send welcome email using user's Gmail OAuth
            email_result = self._send_welcome_email(customer_data)
            results['steps_completed'].append('welcome_email')
            results['email_sent'] = email_result
            
        except Exception as e:
            results['errors'].append(f"Welcome email failed: {str(e)}")
        
        try:
            # Step 2: Create customer Slack channel using user's Slack OAuth
            slack_result = self._create_customer_channel(customer_data)
            results['steps_completed'].append('slack_channel')
            results['slack_channel'] = slack_result
            
        except Exception as e:
            results['errors'].append(f"Slack channel creation failed: {str(e)}")
        
        try:
            # Step 3: Create setup tasks in GitHub using user's GitHub OAuth
            github_result = self._create_setup_tasks(customer_data)
            results['steps_completed'].append('github_tasks')
            results['github_tasks'] = github_result
            
        except Exception as e:
            results['errors'].append(f"GitHub tasks creation failed: {str(e)}")
        
        return results
    
    def _send_welcome_email(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send personalized welcome email."""
        
        # Use config from frontend dashboard
        template = self.config.get('email_template', {})
        subject = template.get('subject', 'Welcome!').format(**customer_data)
        body = template.get('body', 'Welcome to our platform!').format(**customer_data)
        
        # Make OAuth call via proxy (uses user's Gmail tokens)
        return self.oauth.gmail.send_email(
            to=customer_data['email'],
            subject=subject,
            body=body,
            cc=self.config.get('cc_email')
        )
    
    def _create_customer_channel(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create dedicated Slack channel for customer."""
        
        channel_name = f"customer-{customer_data['company'].lower().replace(' ', '-')}"
        
        # Make OAuth call via proxy (uses user's Slack tokens)
        return self.oauth.slack.create_channel(
            name=channel_name,
            purpose=f"Support channel for {customer_data['company']}",
            is_private=self.config.get('private_channels', False)
        )
    
    def _create_setup_tasks(self, customer_data: Dict[str, Any]) -> list:
        """Create GitHub issues for customer setup tasks."""
        
        tasks = self.config.get('setup_tasks', [
            'Set up customer environment',
            'Configure integrations', 
            'Schedule onboarding call'
        ])
        
        results = []
        repo = self.config.get('github_repo', 'company/tasks')
        
        for task in tasks:
            # Make OAuth call via proxy (uses user's GitHub tokens)
            issue_result = self.oauth.github.create_issue(
                repo=repo,
                title=f"[{customer_data['company']}] {task}",
                body=f"Customer: {customer_data['company']}\nContact: {customer_data['email']}\n\nTask: {task}",
                labels=['customer-onboarding', customer_data.get('tier', 'standard')]
            )
            results.append(issue_result)
        
        return results


# Example usage (how you'd run the agent)
if __name__ == "__main__":
    # Configuration that would come from frontend dashboard
    config = {
        'email_template': {
            'subject': 'Welcome to Acme Corp, {company}!',
            'body': 'Hi {contact_name},\n\nWelcome to Acme Corp! We\'re excited to work with {company}.\n\nBest regards,\nThe Acme Team'
        },
        'cc_email': 'onboarding@acme.com',
        'github_repo': 'acme/customer-tasks',
        'private_channels': True,
        'setup_tasks': [
            'Create customer environment',
            'Set up integrations',
            'Schedule kickoff call',
            'Send welcome package'
        ]
    }
    
    # OAuth proxy with agent API key from dashboard
    oauth_proxy = EmeryPythonClient("orch_agent_2_abc123")
    
    # Initialize agent
    agent = CustomerOnboardingAgent(config, oauth_proxy)
    
    # Example customer data
    customer_data = {
        'id': 'cust_123',
        'company': 'Tech Startup Inc',
        'contact_name': 'John Smith', 
        'email': 'john@techstartup.com',
        'tier': 'enterprise'
    }
    
    # Run onboarding process
    try:
        results = agent.onboard_customer(customer_data)
        print("✅ Onboarding completed:")
        print(f"   Steps completed: {results['steps_completed']}")
        if results['errors']:
            print(f"   Errors: {results['errors']}")
        
    except Exception as e:
        print(f"❌ Onboarding failed: {e}")
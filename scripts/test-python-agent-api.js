#!/usr/bin/env node

/**
 * Test Script: Python Agent API Mock
 * 
 * This script mocks a Python backend application and demonstrates
 * how to securely use Orchastrate agents with OAuth credentials
 * for Gmail integration through Pipedream Connect.
 * 
 * Usage: node scripts/test-python-agent-api.js
 */

const fetch = require('node-fetch');
const express = require('express');
const crypto = require('crypto');

// Configuration
const ORCHASTRATE_API = process.env.ORCHASTRATE_API || 'http://localhost:3000';
const PYTHON_APP_PORT = process.env.PYTHON_APP_PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';

// Mock Python App Server for receiving webhooks
const app = express();
app.use(express.json());

// Store received webhooks for testing
const receivedWebhooks = [];

/**
 * Webhook endpoint to receive agent execution results
 */
app.post('/webhook/agent-result', (req, res) => {
  console.log('\n🎣 [WEBHOOK] Received agent execution result:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Verify webhook signature
  const signature = req.headers['x-orchastrate-signature'];
  const expectedSignature = generateWebhookSignature(req.body);
  
  if (signature !== expectedSignature) {
    console.log('❌ [WEBHOOK] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  console.log('✅ [WEBHOOK] Signature verified');
  receivedWebhooks.push(req.body);
  res.json({ status: 'received' });
});

/**
 * Generate HMAC signature for webhook verification
 */
function generateWebhookSignature(payload) {
  const message = JSON.stringify(payload);
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(message).digest('hex');
}

/**
 * Mock Python Agent Client Class
 */
class PythonAgentClient {
  constructor(apiUrl, agentId) {
    this.apiUrl = apiUrl;
    this.agentId = agentId;
    this.webhookUrl = `http://localhost:${PYTHON_APP_PORT}/webhook/agent-result`;
  }

  async getCapabilities() {
    console.log(`\n📋 Getting capabilities for agent ${this.agentId}...`);
    
    try {
      const response = await fetch(`${this.apiUrl}/api/agents/${this.agentId}/capabilities`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get capabilities');
      }
      
      console.log('✅ Agent capabilities retrieved:');
      console.log(`   • Agent: ${data.agent_name}`);
      console.log(`   • Connected Services: ${data.connected_services.map(s => s.service).join(', ')}`);
      console.log(`   • Available Actions: ${data.available_actions.length}`);
      
      return data;
    } catch (error) {
      console.error('❌ Error getting capabilities:', error.message);
      throw error;
    }
  }

  async executeAction(action, props, useWebhook = false) {
    console.log(`\n🚀 Executing action: ${action}`);
    console.log('   Props:', JSON.stringify(props, null, 2));
    
    try {
      const payload = {
        action,
        props,
        timeout: 30000,
      };
      
      if (useWebhook) {
        payload.webhook_url = this.webhookUrl;
        console.log(`   📡 Using webhook: ${this.webhookUrl}`);
      }
      
      const response = await fetch(`${this.apiUrl}/api/agents/${this.agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute action');
      }
      
      if (data.success) {
        console.log('✅ Action executed successfully');
        console.log(`   📄 Execution ID: ${data.execution_id}`);
        if (!useWebhook && data.result) {
          console.log('   📤 Result:', JSON.stringify(data.result, null, 2));
        }
      } else {
        console.log('❌ Action failed:', data.error);
      }
      
      return data;
    } catch (error) {
      console.error('❌ Error executing action:', error.message);
      throw error;
    }
  }

  async proxyRequest(service, endpoint, method = 'GET', data = null, params = null) {
    console.log(`\n🔗 Proxying ${method} request to ${service}${endpoint}`);
    
    try {
      const payload = {
        service,
        endpoint,
        method,
        data,
        params,
      };
      
      const response = await fetch(`${this.apiUrl}/api/agents/${this.agentId}/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Proxy request failed');
      }
      
      console.log('✅ Proxy request successful');
      console.log(`   📊 Status: ${result.status}`);
      console.log('   📤 Data:', JSON.stringify(result.data, null, 2));
      
      return result;
    } catch (error) {
      console.error('❌ Error with proxy request:', error.message);
      throw error;
    }
  }
}

/**
 * Gmail Integration Examples
 */
class GmailExamples {
  constructor(agentClient) {
    this.agent = agentClient;
  }

  async sendEmail() {
    console.log('\n📧 === Gmail: Send Email Example ===');
    
    return await this.agent.executeAction('gmail-send-email', {
      to: 'test@example.com',
      subject: 'Test Email from Orchastrate Agent',
      body: 'This email was sent by an Orchastrate agent using the owner\'s Gmail credentials!',
      cc: 'cc@example.com',
    });
  }

  async getMessages() {
    console.log('\n📬 === Gmail: Get Messages Example ===');
    
    return await this.agent.executeAction('gmail-get-messages', {
      query: 'is:unread',
      maxResults: 5,
    });
  }

  async getProfile() {
    console.log('\n👤 === Gmail: Get Profile via Proxy ===');
    
    return await this.agent.proxyRequest('gmail', '/gmail/v1/users/me/profile');
  }

  async searchMessages() {
    console.log('\n🔍 === Gmail: Search Messages via Proxy ===');
    
    return await this.agent.proxyRequest(
      'gmail', 
      '/gmail/v1/users/me/messages',
      'GET',
      null,
      { q: 'from:noreply', maxResults: '3' }
    );
  }

  async sendEmailViaProxy() {
    console.log('\n📮 === Gmail: Send Email via Proxy ===');
    
    const emailData = {
      raw: Buffer.from([
        'To: test@example.com',
        'Subject: Proxy Email Test',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        'This email was sent via proxy through the Orchastrate agent!'
      ].join('\n')).toString('base64'),
    };
    
    return await this.agent.proxyRequest(
      'gmail',
      '/gmail/v1/users/me/messages/send',
      'POST',
      emailData
    );
  }

  async webhookExample() {
    console.log('\n🎣 === Gmail: Webhook Example ===');
    
    return await this.agent.executeAction('gmail-get-messages', {
      query: 'is:inbox',
      maxResults: 1,
    }, true); // Use webhook
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Python Agent API Test Suite');
  console.log('='*50);
  
  // Start webhook server
  const server = app.listen(PYTHON_APP_PORT, () => {
    console.log(`📡 Mock Python app webhook server listening on port ${PYTHON_APP_PORT}`);
  });

  try {
    // Get agent ID from command line or use default
    const agentId = process.argv[2] || '1';
    console.log(`🤖 Testing with agent ID: ${agentId}`);
    
    // Initialize agent client
    const agentClient = new PythonAgentClient(ORCHASTRATE_API, agentId);
    const gmailExamples = new GmailExamples(agentClient);
    
    // Test 1: Get agent capabilities
    console.log('\n🧪 TEST 1: Agent Capabilities');
    console.log('-'.repeat(30));
    await agentClient.getCapabilities();
    
    // Test 2: Gmail Action Examples (with error handling)
    console.log('\n🧪 TEST 2: Gmail Actions');
    console.log('-'.repeat(30));
    
    try {
      await gmailExamples.getMessages();
    } catch (error) {
      console.log('⚠️  Gmail get messages failed (expected if no Gmail connected)');
    }
    
    try {
      await gmailExamples.sendEmail();
    } catch (error) {
      console.log('⚠️  Gmail send email failed (expected if no Gmail connected)');
    }
    
    // Test 3: Gmail Proxy Examples
    console.log('\n🧪 TEST 3: Gmail Proxy Requests');
    console.log('-'.repeat(30));
    
    try {
      await gmailExamples.getProfile();
    } catch (error) {
      console.log('⚠️  Gmail proxy request failed (expected if no Gmail connected)');
    }
    
    try {
      await gmailExamples.searchMessages();
    } catch (error) {
      console.log('⚠️  Gmail search proxy failed (expected if no Gmail connected)');
    }
    
    // Test 4: Webhook Example
    console.log('\n🧪 TEST 4: Webhook Integration');
    console.log('-'.repeat(30));
    
    try {
      await gmailExamples.webhookExample();
      
      // Wait a bit for webhook delivery
      console.log('⏳ Waiting for webhook delivery...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`📊 Received ${receivedWebhooks.length} webhooks`);
    } catch (error) {
      console.log('⚠️  Webhook test failed (expected if no Gmail connected)');
    }
    
    console.log('\n✅ Test suite completed!');
    console.log('\n📋 Summary:');
    console.log(`   • API Base URL: ${ORCHASTRATE_API}`);
    console.log(`   • Agent ID: ${agentId}`);
    console.log(`   • Webhook Server: http://localhost:${PYTHON_APP_PORT}`);
    console.log(`   • Webhooks Received: ${receivedWebhooks.length}`);
    
    console.log('\n💡 To test with a real agent:');
    console.log('   1. Create an agent in Orchastrate dashboard');
    console.log('   2. Connect Gmail via /dashboard/connections');
    console.log('   3. Run: node scripts/test-python-agent-api.js <agent_id>');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
  } finally {
    // Close webhook server
    server.close();
    console.log('\n👋 Mock Python app shutting down');
  }
}

// Export for use as module
module.exports = { PythonAgentClient, GmailExamples };

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}
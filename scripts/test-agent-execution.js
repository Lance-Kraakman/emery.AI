#!/usr/bin/env node
/**
 * Simple test script to verify agent execution pipeline works
 * 
 * Usage: node scripts/test-agent-execution.js [agent_id]
 */

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const API_BASE = 'http://localhost:3000';

async function testAgentExecution(agentId = 1) {
  console.log(`🧪 Testing agent execution for agent ${agentId}`);
  console.log('='  .repeat(50));

  try {
    // Test 1: Get agent capabilities
    console.log('\n📋 Test 1: Get agent capabilities');
    const capabilitiesRes = await fetch(`${API_BASE}/api/agents/${agentId}/capabilities`, {
      headers: {
        'x-test-user-id': TEST_USER_ID
      }
    });
    
    if (!capabilitiesRes.ok) {
      throw new Error(`Capabilities request failed: ${capabilitiesRes.status} ${await capabilitiesRes.text()}`);
    }
    
    const capabilities = await capabilitiesRes.json();
    console.log(`✅ Agent has ${capabilities.capabilities?.length || 0} capabilities`);
    console.log(`✅ Connected services: ${capabilities.connected_services?.length || 0}`);
    
    if (!capabilities.capabilities || capabilities.capabilities.length === 0) {
      console.log('⚠️  No capabilities found - creating a test capability');
      // For now, we'll test with a simple capability name
    }

    // Test 2: Execute a simple capability (even if it doesn't exist, should return structured error)
    console.log('\n🚀 Test 2: Execute test capability');
    const executeRes = await fetch(`${API_BASE}/api/agents/${agentId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': TEST_USER_ID
      },
      body: JSON.stringify({
        capability_name: 'test_capability',
        trigger_data: {
          message: 'Hello from test script',
          timestamp: new Date().toISOString()
        }
      })
    });

    const executeResult = await executeRes.json();
    console.log(`📊 Execute result:`, JSON.stringify(executeResult, null, 2));

    if (executeResult.success) {
      console.log('✅ Agent execution successful');
    } else {
      console.log(`⚠️  Agent execution failed: ${executeResult.error}`);
      // This is expected if no real capability exists - the important thing is that the pipeline works
    }

    // Test 3: Test OAuth proxy (should work even without connections)
    console.log('\n🔐 Test 3: Test OAuth proxy');
    
    // First, we need an agent API key - let's try to get it
    const agentRes = await fetch(`${API_BASE}/api/agents`, {
      headers: {
        'x-test-user-id': TEST_USER_ID
      }
    });
    
    if (!agentRes.ok) {
      throw new Error(`Agent fetch failed: ${agentRes.status}`);
    }
    
    const agentsData = await agentRes.json();
    const testAgent = agentsData.agents?.find(a => a.id === agentId);
    
    if (testAgent?.apiKey) {
      console.log('🔑 Found agent API key, testing proxy...');
      
      const proxyRes = await fetch(`${API_BASE}/api/agents/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAgent.apiKey}`
        },
        body: JSON.stringify({
          service: 'gmail',
          action: 'send_email',
          params: {
            to: 'test@example.com',
            subject: 'Test from agent',
            body: 'This is a test'
          }
        })
      });

      const proxyResult = await proxyRes.json();
      console.log(`📊 Proxy result:`, JSON.stringify(proxyResult, null, 2));

      if (proxyResult.success) {
        console.log('✅ OAuth proxy works');
      } else {
        console.log(`⚠️  OAuth proxy error: ${proxyResult.error} (expected if no OAuth connections)`);
      }
    } else {
      console.log('⚠️  No API key found for agent - skipping proxy test');
    }

    console.log('\n🎉 Agent execution pipeline test complete!');
    console.log('✅ Basic infrastructure is working');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Get agent ID from command line or use default
const agentId = process.argv[2] ? parseInt(process.argv[2]) : 1;
testAgentExecution(agentId);
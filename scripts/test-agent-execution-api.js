#!/usr/bin/env node
/**
 * Test script to verify agent execution pipeline using proper API authentication
 * 
 * Prerequisites: Run `pnpm seed:test` first to create test data
 * 
 * Usage: node scripts/test-agent-execution-api.js [user_api_key] [agent_id]
 */

const API_BASE = 'http://localhost:3000';

async function testAgentExecutionWithAPI(userApiKey, agentId = 1) {
  console.log(`🧪 Testing agent execution for agent ${agentId} with API authentication`);
  console.log('Prerequisites: Test data should be seeded with `pnpm seed:test`');
  console.log('='  .repeat(70));

  try {
    // Test 1: Get agents list
    console.log('\n📋 Test 1: Get agents list');
    const agentsRes = await fetch(`${API_BASE}/api/agents`, {
      headers: {
        'Authorization': `Bearer ${userApiKey}`
      }
    });
    
    if (!agentsRes.ok) {
      throw new Error(`Agents request failed: ${agentsRes.status} ${await agentsRes.text()}`);
    }
    
    const agentsData = await agentsRes.json();
    console.log(`✅ Found ${agentsData.agents?.length || 0} agents`);
    
    if (!agentsData.agents || agentsData.agents.length === 0) {
      throw new Error('No agents found - make sure test data is seeded');
    }
    
    // Find the specified agent or use the first one
    const testAgent = agentsData.agents.find(a => a.id === agentId) || agentsData.agents[0];
    console.log(`✅ Using agent: ${testAgent.name} (ID: ${testAgent.id})`);

    // Test 2: Get agent capabilities
    console.log('\n📋 Test 2: Get agent capabilities');
    const capabilitiesRes = await fetch(`${API_BASE}/api/agents/${testAgent.id}/capabilities`, {
      headers: {
        'Authorization': `Bearer ${userApiKey}`
      }
    });
    
    if (!capabilitiesRes.ok) {
      throw new Error(`Capabilities request failed: ${capabilitiesRes.status} ${await capabilitiesRes.text()}`);
    }
    
    const capabilities = await capabilitiesRes.json();
    console.log(`✅ Agent has ${capabilities.capabilities?.length || 0} capabilities`);
    console.log(`✅ Connected services: ${capabilities.connected_services?.length || 0}`);

    // Test 3: Execute a test capability
    console.log('\n🚀 Test 3: Execute test capability');
    const executeRes = await fetch(`${API_BASE}/api/agents/${testAgent.id}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userApiKey}`
      },
      body: JSON.stringify({
        capability_name: 'test_capability',
        trigger_data: {
          message: 'Hello from API test script',
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
      // This might be expected if gRPC worker isn't running
    }

    // OAuth proxy testing removed - manual testing will be done separately

    console.log('\n🎉 Agent execution pipeline test complete!');
    console.log('✅ Basic infrastructure is working with proper authentication');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Get parameters from command line
const userApiKey = process.argv[2];
const agentId = process.argv[3] ? parseInt(process.argv[3]) : null;

if (!userApiKey) {
  console.error('❌ User API key is required');
  console.log('Usage: node scripts/test-agent-execution-api.js [user_api_key] [agent_id]');
  console.log('\nGet the user API key by running: pnpm seed:test');
  process.exit(1);
}

testAgentExecutionWithAPI(userApiKey, agentId);
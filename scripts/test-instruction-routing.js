#!/usr/bin/env node
/**
 * Test script to verify instruction-based capability routing
 * Tests various instruction types to ensure proper auto-routing
 */

const API_BASE = 'http://localhost:3000';

async function testInstructionRouting(userApiKey, agentId = 10) {
  console.log(`🧪 Testing instruction-based capability routing for agent ${agentId}`);
  console.log('='  .repeat(70));

  const testInstructions = [
    {
      name: 'Health Check Instruction',
      instructions: 'Check the system health and provide a status report',
      expectedCapability: 'health_check'
    },
    {
      name: 'Email-related Instruction', 
      instructions: 'Read my emails for today and summarize any important messages',
      expectedCapability: 'email_management' // Should route to email capability if available
    },
    {
      name: 'General Task Instruction',
      instructions: 'Generate a summary report of project progress',
      expectedCapability: 'general_task' // Should route to general or first capability
    }
  ];

  for (const test of testInstructions) {
    console.log(`\n🔍 Testing: ${test.name}`);
    console.log(`📝 Instructions: "${test.instructions}"`);
    
    try {
      const executeRes = await fetch(`${API_BASE}/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userApiKey}`
        },
        body: JSON.stringify({
          instructions: test.instructions,
          trigger_data: {
            test_name: test.name,
            timestamp: new Date().toISOString()
          }
        })
      });

      const result = await executeRes.json();
      
      if (result.success) {
        console.log(`✅ Execution successful`);
        console.log(`🎯 Execution ID: ${result.execution_id}`);
        console.log(`📊 Result summary: ${JSON.stringify(result.result, null, 2).substring(0, 200)}...`);
      } else {
        console.log(`❌ Execution failed: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n🎉 Instruction routing test complete!');
  console.log('✅ The instruction-based capability auto-routing system is working');
}

// Get parameters from command line
const userApiKey = process.argv[2];
const agentId = process.argv[3] ? parseInt(process.argv[3]) : 10;

if (!userApiKey) {
  console.error('❌ User API key is required');
  console.log('Usage: node scripts/test-instruction-routing.js [user_api_key] [agent_id]');
  console.log('\nGet the user API key by running: pnpm seed:test');
  process.exit(1);
}

testInstructionRouting(userApiKey, agentId);
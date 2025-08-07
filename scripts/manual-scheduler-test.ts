/**
 * Manual scheduler test - simpler version to debug issues
 */

async function makeAPIRequest(endpoint: string, options: any = {}) {
  const baseUrl = 'http://localhost:3000';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': '550e8400-e29b-41d4-a716-446655440000',
      ...options.headers,
    },
    ...options,
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

async function testSchedulerAPIs() {
  console.log('🔍 Manual Scheduler API Test');
  console.log('============================\n');

  try {
    console.log('1️⃣  Testing scheduler status...');
    const status = await makeAPIRequest('/api/scheduler/status');
    console.log(`✅ Status: ${status.status}`);
    console.log(`   Running: ${status.data.scheduler?.isRunning}`);
    console.log(`   CRON Jobs: ${status.data.scheduler?.cronJobsCount}\n`);

    console.log('2️⃣  Testing simple agent creation...');
    const agent = await makeAPIRequest('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Simple Test Agent',
        organizationId: 1,
        trigger: { type: 'MANUAL' },
        capabilities: []
      })
    });
    console.log(`   Status: ${agent.status}`);
    console.log(`   Response: ${JSON.stringify(agent.data, null, 2)}\n`);

    if (agent.status === 200 || agent.status === 201) {
      console.log('3️⃣  Testing CRON agent creation...');
      const cronAgent = await makeAPIRequest('/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: 'CRON Test Agent',
          organizationId: 1,
          trigger: { type: 'CRON', cron: '*/2 * * * *' }, // Every 2 minutes
          capabilities: [{
            name: 'test_capability',
            description: 'Test capability',
            steps: [{
              id: 'step1',
              type: 'TOOL_STEP',
              instructions: 'Test step'
            }]
          }]
        })
      });
      console.log(`   Status: ${cronAgent.status}`);
      console.log(`   Response: ${JSON.stringify(cronAgent.data, null, 2)}\n`);
      
      if (cronAgent.status === 200 || cronAgent.status === 201) {
        console.log('4️⃣  Checking scheduler after CRON agent creation...');
        const newStatus = await makeAPIRequest('/api/scheduler/status');
        console.log(`   CRON Jobs After Creation: ${newStatus.data.scheduler?.cronJobsCount}`);
        console.log(`   Scheduler Running: ${newStatus.data.scheduler?.isRunning}\n`);
        
        console.log('5️⃣  Testing webhook agent creation...');
        const webhookAgent = await makeAPIRequest('/api/agents', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Webhook Test Agent',
            organizationId: 1,
            trigger: { type: 'WEBHOOK' },
            capabilities: [{
              name: 'test_webhook_capability',
              description: 'Test webhook capability',
              steps: [{
                id: 'step1',
                type: 'TOOL_STEP',
                instructions: 'Test webhook step'
              }]
            }]
          })
        });
        console.log(`   Status: ${webhookAgent.status}`);
        console.log(`   Response: ${JSON.stringify(webhookAgent.data, null, 2)}\n`);
        
        if (webhookAgent.status === 200 || webhookAgent.status === 201) {
          const agentId = webhookAgent.data.agent?.id || webhookAgent.data.id;
          console.log('6️⃣  Testing webhook info...');
          const webhookInfo = await makeAPIRequest(`/api/scheduler/webhook?agent_id=${agentId}`);
          console.log(`   Status: ${webhookInfo.status}`);
          console.log(`   Response: ${JSON.stringify(webhookInfo.data, null, 2)}\n`);
        }
      }
    }

    console.log('7️⃣  Testing table creation...');
    const table = await makeAPIRequest('/api/tables', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Table',
        description: 'Test table for scheduler',
        organizationId: 1
      })
    });
    console.log(`   Status: ${table.status}`);
    console.log(`   Response: ${JSON.stringify(table.data, null, 2)}\n`);

    console.log('✅ Manual test completed!');

  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
}

testSchedulerAPIs();
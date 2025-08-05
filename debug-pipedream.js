const { pipedreamClient, getExternalUserIdForAgent } = require('./lib/pipedream/client');

async function debugPipedream() {
  console.log('🔍 Debugging Pipedream Connect...');
  
  if (!pipedreamClient) {
    console.log('❌ Pipedream client not available');
    return;
  }
  
  console.log('✅ Pipedream client initialized');
  
  const lanceUserId = '0f4f8aa5-d5cb-4280-99ba-eb60f2fe06b1';
  const externalUserId = getExternalUserIdForAgent(lanceUserId);
  
  console.log(`User ID: ${lanceUserId}`);
  console.log(`External User ID: ${externalUserId}`);
  
  try {
    console.log('\n📋 Checking user accounts...');
    const accounts = await pipedreamClient.accounts.list({ 
      external_user_id: externalUserId 
    });
    console.log('Accounts:', JSON.stringify(accounts, null, 2));
    
  } catch (error) {
    console.log('❌ Failed to list accounts:', error.message);
    if (error.response) {
      console.log('Response:', error.response.status, error.response.data);
    }
  }
  
  try {
    console.log('\n🔧 Checking available actions...');
    // Try to list actions or components
    const components = await pipedreamClient.components.list();
    console.log('Available components:', components);
    
  } catch (error) {
    console.log('❌ Failed to list components:', error.message);
  }
  
  try {
    console.log('\n📧 Testing direct Gmail action...');
    // Try a standard Pipedream Gmail action
    const result = await pipedreamClient.actions.run({
      id: 'gmail_send_email', // Try different formats
      external_user_id: externalUserId,
      configured_props: {
        to: 'lance@aifactory.nz',
        subject: 'Test from Pipedream',
        body: 'Testing direct Pipedream action'
      }
    });
    console.log('✅ Gmail action result:', result);
    
  } catch (error) {
    console.log('❌ Gmail action failed:', error.message);
    if (error.response) {
      console.log('Response:', error.response.status, error.response.data);
    }
  }
}

debugPipedream().catch(console.error);
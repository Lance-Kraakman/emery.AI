// Quick test to see what external user ID we're generating
const { getExternalUserIdForAgent } = require('./lib/pipedream/client');

const lanceUserId = '0f4f8aa5-d5cb-4280-99ba-eb60f2fe06b1';
const externalUserId = getExternalUserIdForAgent(lanceUserId);

console.log('Lance User ID:', lanceUserId);
console.log('External User ID for Pipedream:', externalUserId);
console.log('This should match what appears in Pipedream Connect dashboard');
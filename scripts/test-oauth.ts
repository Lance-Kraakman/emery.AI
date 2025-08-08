/**
 * Test OAuth configuration
 */

console.log('🔐 OAUTH CONFIGURATION TEST');
console.log('============================\n');

console.log('Environment Variables:');
console.log(`GITHUB_CLIENT_ID: ${process.env.GITHUB_CLIENT_ID ? 'SET (' + process.env.GITHUB_CLIENT_ID + ')' : 'NOT SET'}`);
console.log(`GITHUB_CLIENT_SECRET: ${process.env.GITHUB_CLIENT_SECRET ? 'SET (***' + process.env.GITHUB_CLIENT_SECRET.slice(-4) + ')' : 'NOT SET'}`);
console.log(`NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? 'SET (***' + process.env.NEXTAUTH_SECRET.slice(-4) + ')' : 'NOT SET'}`);
console.log(`NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'NOT SET'}`);

console.log('\nExpected OAuth Callback URLs:');
console.log(`GitHub: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/github`);
console.log(`Google: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/google`);

console.log('\nNextAuth Endpoints:');
console.log(`Sign In: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/signin`);
console.log(`Sign Out: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/signout`);
console.log(`Session: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/session`);

async function testConnection() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/session`);
    console.log(`\n✅ NextAuth API accessible: ${response.status}`);
    
    const session = await response.json();
    console.log('Current session:', session);
  } catch (error) {
    console.log(`\n❌ NextAuth API not accessible:`, error);
  }
}

testConnection();
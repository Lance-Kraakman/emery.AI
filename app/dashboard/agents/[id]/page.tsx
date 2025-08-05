import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface AgentDetailsPageProps {
  params: { id: string };
}

export default async function AgentDetailsPage({ params }: AgentDetailsPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    return <div>Please sign in to view agent details.</div>;
  }

  const agentId = parseInt(params.id);
  if (isNaN(agentId)) {
    notFound();
  }

  // Get agent details
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    notFound();
  }

  // Verify ownership
  if (agent.ownerId !== session.user.id) {
    return <div>Access denied. You can only view agents you own.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/manage" className="text-blue-500 hover:underline">
          ← Back to Management
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-6">{agent.name}</h1>
        
        {/* Agent API Key Section */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
          <h2 className="text-xl font-semibold mb-3 flex items-center">
            🔑 Backend API Key
          </h2>
          <p className="text-gray-600 mb-3">
            Use this API key in your Python agent libraries to access OAuth services:
          </p>
          
          <div className="bg-white p-3 rounded border font-mono text-sm break-all">
            {agent.apiKey || 'No API key generated'}
          </div>
          
          <div className="mt-3 flex gap-2">
            <button 
              onClick={() => navigator.clipboard.writeText(agent.apiKey || '')}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              📋 Copy Key
            </button>
            <button className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600">
              🔄 Regenerate
            </button>
          </div>
        </div>

        {/* Usage Example */}
        <div className="mb-8 p-4 bg-blue-50 rounded-lg border">
          <h3 className="font-semibold mb-2">📖 Usage in Your Agent Code:</h3>
          <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
{`from orchastrate_client.simple_client import OrchastratePythonClient

# Initialize OAuth proxy
oauth_proxy = OrchastratePythonClient("${agent.apiKey}")

# Use any connected OAuth service
oauth_proxy.gmail.send_email(
    to="user@example.com",
    subject="Hello from agent!",
    body="This uses your OAuth tokens securely."
)

oauth_proxy.slack.post_message(
    channel="#general", 
    text="Agent completed task!"
)`}
          </pre>
        </div>

        {/* Agent Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-3">Agent Information</h3>
            <div className="space-y-2">
              <div><strong>ID:</strong> {agent.id}</div>
              <div><strong>Type:</strong> {agent.type}</div>
              <div><strong>Status:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {agent.status}
                </span>
              </div>
              <div><strong>Created:</strong> {agent.createdAt?.toLocaleDateString()}</div>
              {agent.lastUsedAt && (
                <div><strong>Last Used:</strong> {agent.lastUsedAt.toLocaleDateString()}</div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Capabilities</h3>
            <div className="space-y-2">
              {agent.capabilities && agent.capabilities.length > 0 ? (
                agent.capabilities.map((capability, index) => (
                  <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2 mb-2">
                    {capability}
                  </span>
                ))
              ) : (
                <div className="text-gray-500">No capabilities defined</div>
              )}
            </div>
          </div>
        </div>

        {/* OAuth Connections Section */}
        <div className="mt-8 p-4 bg-yellow-50 rounded-lg border">
          <h3 className="font-semibold mb-2">🔗 OAuth Service Connections</h3>
          <p className="text-gray-600 mb-3">
            Connect OAuth services to enable your agent to use Gmail, Slack, GitHub, etc.
          </p>
          <Link 
            href="/dashboard/connections"
            className="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Manage OAuth Connections →
          </Link>
        </div>

        {/* Next Steps */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold mb-2">🚀 Next Steps</h3>
          <ol className="list-decimal list-inside space-y-1 text-gray-700">
            <li>Connect OAuth services (Gmail, Slack, GitHub) in <Link href="/dashboard/connections" className="text-blue-500 hover:underline">Connections</Link></li>
            <li>Copy the API key above to use in your Python agent libraries</li>
            <li>Initialize <code className="bg-white px-1 rounded">OrchastratePythonClient</code> with the API key</li>
            <li>Call OAuth services: <code className="bg-white px-1 rounded">oauth_proxy.gmail.send_email(...)</code></li>
            <li>Your agent will automatically use your OAuth tokens securely!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
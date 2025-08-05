import Link from 'next/link'

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          🗂️ Welcome to Emery
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          A powerful Baserow-style database builder with dynamic tables, custom fields, and spreadsheet-like editing
        </p>
        
        <div className="space-y-4">
          <Link 
            href="/dashboard" 
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">📋 Dynamic Tables</h3>
              <p className="text-gray-600">Create tables instantly with custom schemas and field types</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">🎨 Rich Field Types</h3>
              <p className="text-gray-600">Text, numbers, emails, URLs, dates, checkboxes, and relations</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">⚡ Spreadsheet Interface</h3>
              <p className="text-gray-600">Edit data inline with a familiar spreadsheet experience</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
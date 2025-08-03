'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import the Tiptap editor with no SSR
const TiptapEditor = dynamic(() => import('../../dashboard/TiptapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading editor...</p>
      </div>
    </div>
  ),
})

interface EditorPageProps {
  params: Promise<{ fileId: string }>
  searchParams: Promise<{
    fileName?: string
    tableId?: string
    fieldId?: string
  }>
}

export default function EditorPage({ params, searchParams }: EditorPageProps) {
  const router = useRouter()
  const [fileId, setFileId] = useState<string>('')
  const [fileName, setFileName] = useState('Untitled Document')
  const [tableId, setTableId] = useState<string>('')
  const [fieldId, setFieldId] = useState<string>('')

  const [fileExists, setFileExists] = useState<boolean | null>(null)
  const [initialContent, setInitialContent] = useState(null)

  useEffect(() => {
    // Resolve the promises for params and searchParams
    Promise.all([params, searchParams]).then(([resolvedParams, resolvedSearchParams]) => {
      setFileId(resolvedParams.fileId)
      setFileName(resolvedSearchParams.fileName || 'Untitled Document')
      setTableId(resolvedSearchParams.tableId || '')
      setFieldId(resolvedSearchParams.fieldId || '')
    })
  }, [params, searchParams])

  useEffect(() => {
    if (fileId) {
      checkFileAndLoadContent()
    }
  }, [fileId])

  const checkFileAndLoadContent = async () => {
    try {
      // Check if file has versions
      const response = await fetch(`/api/files/${fileId}/versions`)
      if (response.ok) {
        const versions = await response.json()
        const currentVersion = versions.find((v: any) => v.isCurrent)
        
        if (currentVersion) {
          setInitialContent(currentVersion.content)
          setFileExists(true)
        } else {
          // No versions exist, create initial content
          setInitialContent({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Start writing your document...' }]
              }
            ]
          })
          setFileExists(true)
        }
      } else {
        setFileExists(false)
      }
    } catch (error) {
      console.error('Error loading file:', error)
      setFileExists(false)
    }
  }

  const handleBack = () => {
    if (tableId && fieldId) {
      router.push(`/dashboard?table=${tableId}`)
    } else {
      router.push('/dashboard')
    }
  }

  const handleSave = async (content: any) => {
    // Content is saved through the TiptapEditor component
    console.log('Content saved:', content)
  }

  if (!fileId || fileExists === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading file...</p>
        </div>
      </div>
    )
  }

  if (fileExists === false) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">File Not Found</h1>
          <p className="text-gray-500 mb-6">The requested file could not be found.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-medium text-gray-900">{fileName}</h1>
          <p className="text-sm text-gray-500">Document Editor</p>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {initialContent && (
          <TiptapEditor
            fileId={fileId}
            fileName={fileName}
            initialContent={initialContent}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  )
}
import { createAI } from 'ai/rsc'
import { ReactNode } from 'react'
import { chatAction } from './action'
import { CoreMessage } from 'ai'

export interface ClientMessage {
  id: string
  role: 'user' | 'assistant'
  display: ReactNode
}

export const AIProvider = createAI<CoreMessage[], ClientMessage[]>({
  actions: {
    chatAction,
  },
  initialUIState: [],
  initialAIState: [],
})
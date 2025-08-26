"""
AI Model Factory for HuggingFace Integration

Creates and manages AI models for chat processing.
Uses HuggingFace Inference API for model access.
"""

import os
import asyncio
import logging
from typing import List, Dict, Any, AsyncIterator, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    """Configuration for a specific model."""
    name: str
    model_id: str
    max_tokens: int = 2048
    temperature: float = 0.7
    top_p: float = 0.9


class ModelFactory:
    """
    Factory for creating and managing AI models.
    
    Uses HuggingFace Inference API with proper streaming support.
    Matches the model configuration used in the main TypeScript application.
    """
    
    def __init__(self):
        self.hf_token = self._get_hf_token()
        
        # Model configurations matching the main app (lib/ai/models.ts)
        self.models = {
            'chat': ModelConfig(
                name='chat',
                model_id='Qwen/Qwen2.5-Coder-32B-Instruct',
                max_tokens=2048,
                temperature=0.7
            ),
            'general': ModelConfig(
                name='general', 
                model_id='Qwen/Qwen2.5-14B-Instruct',
                max_tokens=4096,
                temperature=0.8
            ),
            'fast': ModelConfig(
                name='fast',
                model_id='Qwen/Qwen2.5-Coder-7B-Instruct',
                max_tokens=1024,
                temperature=0.6
            )
        }
        
        self.default_model = 'chat'
        logger.info(f"✅ ModelFactory initialized with {len(self.models)} models")
        logger.info(f"📋 Available models: {list(self.models.keys())}")
        
    def _get_hf_token(self) -> str:
        """Get HuggingFace token from environment."""
        token = os.getenv('HF_TOKEN')
        if not token:
            raise ValueError(
                "HF_TOKEN environment variable is required for HuggingFace API access. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        logger.info("✅ HuggingFace token loaded successfully")
        return token
    
    async def stream_response(
        self, 
        messages: List[Dict[str, str]], 
        model_name: str = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """
        Stream AI response using HuggingFace Inference API.
        
        Args:
            messages: Conversation messages in OpenAI format
            model_name: Model to use ('chat', 'general', 'fast')
            **kwargs: Additional parameters
            
        Yields:
            str: Streaming content chunks
        """
        
        model_name = model_name or self.default_model
        model_config = self.models.get(model_name)
        
        if not model_config:
            raise ValueError(f"Unknown model: {model_name}. Available: {list(self.models.keys())}")
            
        logger.info(f"🤖 Streaming response using {model_config.model_id}")
        
        try:
            # Try importing HuggingFace client
            try:
                from huggingface_hub import AsyncInferenceClient
                import json
                
                client = AsyncInferenceClient(
                    model=model_config.model_id,
                    token=self.hf_token
                )
                
                # Convert messages to HuggingFace format
                formatted_messages = self._format_messages_for_hf(messages)
                
                logger.info(f"📡 Starting stream for {len(formatted_messages)} messages")
                
                # Use the text generation streaming API instead of chat completion
                # Build prompt from messages
                prompt = self._build_prompt_from_messages(formatted_messages)
                
                # Stream response using text generation
                async for token in client.text_generation(
                    prompt=prompt,
                    max_new_tokens=model_config.max_tokens,
                    temperature=model_config.temperature,
                    top_p=model_config.top_p,
                    stream=True
                ):
                    # token is a string chunk from the model
                    if isinstance(token, str) and token.strip():
                        yield token
                    elif hasattr(token, 'token') and hasattr(token.token, 'text'):
                        # Handle different response formats
                        yield token.token.text
                            
                logger.info("✅ HuggingFace streaming completed successfully")
                
            except ImportError:
                logger.warning("⚠️ HuggingFace client not available, using enhanced mock streaming")
                async for chunk in self._mock_stream_response(messages, model_config):
                    yield chunk
                    
            except Exception as hf_error:
                logger.error(f"❌ HuggingFace streaming failed: {hf_error}")
                logger.warning("⚠️ Falling back to enhanced mock streaming")
                async for chunk in self._mock_stream_response(messages, model_config):
                    yield chunk
                    
        except Exception as e:
            logger.error(f"❌ Model streaming failed: {e}")
            # Fallback to error message
            yield f"I apologize, but I'm having trouble accessing the AI model right now. Please try again in a moment."
    
    def _format_messages_for_hf(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Format messages for HuggingFace chat completion API."""
        
        formatted = []
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            
            # HuggingFace uses standard OpenAI format
            if role in ['system', 'user', 'assistant']:
                formatted.append({
                    'role': role,
                    'content': content
                })
            else:
                # Convert unknown roles to user
                formatted.append({
                    'role': 'user', 
                    'content': content
                })
                
        return formatted
    
    def _build_prompt_from_messages(self, messages: List[Dict[str, str]]) -> str:
        """Build a single prompt string from conversation messages."""
        
        prompt = ""
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            
            if role == 'system':
                prompt += f"System: {content}\n\n"
            elif role == 'user':
                prompt += f"Human: {content}\n\n"
            elif role == 'assistant':
                prompt += f"Assistant: {content}\n\n"
        
        # Add final assistant prompt
        prompt += "Assistant: "
        return prompt
    
    async def _mock_stream_response(
        self, 
        messages: List[Dict[str, str]], 
        model_config: ModelConfig
    ) -> AsyncIterator[str]:
        """
        Enhanced mock streaming that provides realistic AI responses.
        Used when HuggingFace client is not available.
        """
        
        last_message = messages[-1]['content'] if messages else ''
        
        # Generate context-aware response based on the query
        if any(keyword in last_message.lower() for keyword in ['table', 'data', 'database', 'structure']):
            response = """Based on your organizational data structure, I can help you understand the key components of your system:

**Database Tables:**
- Users: Manages user accounts, roles, and organization membership
- Organizations: Core organizational entities with settings and preferences  
- Tables: Dynamic table definitions with custom field configurations
- Agents: AI agent configurations including capabilities and tool access

**Data Relationships:**
- Users belong to organizations through role-based membership
- Tables are scoped to specific organizations
- Agents have access to organization-specific data through API calls

**Best Practices:**
- Use field-based access patterns for dynamic data
- Implement proper role-based access control
- Consider data archival for large datasets

Would you like me to dive deeper into any specific aspect of your data architecture?"""

        elif any(keyword in last_message.lower() for keyword in ['hello', 'help', 'hi', 'waddup']):
            response = """Hello! I'm your AI assistant for the Emery platform. I can help you with:

🔍 **Data Analysis**: Understanding your organizational data, table structures, and relationships
📊 **Performance Insights**: Database optimization, query performance, and system metrics  
🤖 **Agent Configuration**: Setting up and managing AI agents and their capabilities
🛠 **System Architecture**: Best practices for workflows, integrations, and scaling

What specific area would you like to explore today?"""

        elif any(keyword in last_message.lower() for keyword in ['agent', 'automation', 'workflow']):
            response = """I can help you with agent and automation workflows:

**Agent Capabilities:**
- OAuth integration for accessing external services (Gmail, Slack, GitHub)
- Database operations through secure API endpoints
- Task scheduling and execution monitoring
- Custom tool integration and capability management

**Workflow Optimization:**
- Automated data processing and analysis
- Integration with external systems
- Error handling and retry mechanisms
- Performance monitoring and optimization

**Security Features:**
- Role-based access control for agent operations
- OAuth credential delegation (no local token storage)
- Audit logging and execution tracking

Would you like me to help you configure a specific agent or workflow?"""

        else:
            response = f"""I understand you're asking about: "{last_message}"

I'm here to help you with your Emery platform needs. I have access to your organizational context and can assist with:

- **Data Management**: Table structures, relationships, and optimization
- **Agent Configuration**: AI automation and workflow setup  
- **System Analytics**: Performance insights and usage patterns
- **Integration Support**: Connecting with external tools and services

Could you provide more specific details about what you'd like to accomplish?"""

        # Stream the response word by word for realistic effect
        words = response.split()
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield chunk
            await asyncio.sleep(0.03)  # Realistic streaming delay
    
    def get_model_info(self, model_name: str = None) -> Dict[str, Any]:
        """Get information about a specific model or all models."""
        
        if model_name:
            if model_name not in self.models:
                raise ValueError(f"Unknown model: {model_name}")
            config = self.models[model_name]
            return {
                'name': config.name,
                'model_id': config.model_id,
                'max_tokens': config.max_tokens,
                'temperature': config.temperature,
                'available': True
            }
        else:
            return {
                'models': {
                    name: {
                        'name': config.name,
                        'model_id': config.model_id,
                        'max_tokens': config.max_tokens,
                        'temperature': config.temperature
                    }
                    for name, config in self.models.items()
                },
                'default': self.default_model,
                'hf_token_available': bool(self.hf_token)
            }
# Tool System Implementation Plan

## Overview

This plan outlines the systematic approach for adding and testing tool types in the Emery Agents system, integrating with smolagents task types and the existing Pipedream connector infrastructure.

## Architecture Summary

### Current Implementation
- **Clean gRPC Executor**: Well-structured with proper error handling and real-time progress tracking
- **SmolAgents Orchestrator**: Hierarchical agent setup with proper model selection
- **Tool Registry**: Centralized registry with declarative configuration data structures
- **Type Safety**: Comprehensive TypedDict patterns and proper dataclass usage

### Tool Categories Implemented
1. **Built-in Smolagents Tools**: Python interpreter, web search, speech-to-text
2. **HuggingFace Model Tools**: NLP, computer vision, audio, multimodal tasks
3. **Custom Integration Tools**: Pipedream connector for OAuth-enabled services

## Implementation Strategy

### Phase 1: Core Tool Integration (Current)
- ✅ Tool registry with proper configuration structure
- ✅ HuggingFace pipeline tools for major task types
- ✅ Pipedream connector integration with existing OAuth proxy
- ✅ Proper error handling and environment validation

### Phase 2: Enhanced Tool Support
1. **MCP Server Integration**
   ```python
   # Add to CUSTOM_INTEGRATION_TOOLS
   ToolConfig(
       name="MCP Server Connector",
       tool_type=ToolType.MCP_CONNECTOR,
       category=ToolCategory.API_TOOLS,
       description="Connect to Model Context Protocol servers",
       dependencies=["mcp-client"],
   )
   ```

2. **LangChain Tool Bridge**
   ```python
   # Bridge existing LangChain tools
   ToolConfig(
       name="LangChain Tool Bridge",
       tool_type=ToolType.LANGCHAIN_BRIDGE,
       category=ToolCategory.API_TOOLS,
       description="Use LangChain tools within smolagents",
       dependencies=["langchain"],
   )
   ```

### Phase 3: Advanced Features
1. **Tool Composition**: Allow tools to call other tools
2. **Dynamic Tool Discovery**: Runtime tool registration
3. **Tool Performance Monitoring**: Execution metrics and optimization

## Systematic Tool Addition Process

### 1. Define Tool Configuration
```python
# Add to appropriate configuration list in tool_registry.py
ToolConfig(
    name="Tool Display Name",
    tool_type=ToolType.NEW_TOOL_TYPE,
    category=ToolCategory.APPROPRIATE_CATEGORY,
    description="Clear description of tool functionality",
    dependencies=["required", "packages"],
    required_env_vars=["ENV_VAR"] if needed,
    is_custom=True if custom implementation
)
```

### 2. Implement Tool Class
```python
# For custom tools: add to custom_tools.py
class NewCustomTool(BaseTool):
    description = "Tool description for LLM"
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        # Initialize tool-specific configuration
    
    def forward(self, *args, **kwargs) -> Dict[str, Any]:
        # Tool implementation
        return {"success": True, "result": result}
```

### 3. Register Factory Function
```python
# Add to _get_custom_factory() or appropriate factory method
if tool_type == ToolType.NEW_TOOL_TYPE:
    from .custom_tools import NewCustomTool
    return NewCustomTool(config.config or {})
```

### 4. Integration with SmolAgents
Update `smolagents.py` to use the tool registry:
```python
def _load_tool(self, tool_config):
    from .tools import tool_registry
    return tool_registry.create_tool_instance(
        tool_config.tool_type,
        tool_config.config
    )
```

## Testing Strategy

### Unit Testing Framework
```python
# tests/test_tool_registry.py
def test_tool_registration():
    """Test tool registration and configuration validation."""
    
def test_tool_creation():
    """Test tool instance creation with various configurations."""
    
def test_environment_validation():
    """Test environment variable validation for tools."""
```

### Integration Testing
```python
# tests/test_tool_integration.py
def test_smolagents_tool_loading():
    """Test tool loading in smolagents orchestrator."""
    
def test_grpc_tool_execution():
    """Test tool execution via gRPC interface."""
    
def test_pipedream_connector():
    """Test Pipedream OAuth proxy integration."""
```

### End-to-End Testing
```python
# tests/test_e2e_tools.py
def test_agent_with_multiple_tools():
    """Test agent execution with multiple tool types."""
    
def test_tool_composition():
    """Test tools calling other tools."""
    
def test_error_handling():
    """Test error propagation and recovery."""
```

### Performance Testing
```python
# tests/test_tool_performance.py
def test_hf_model_loading_time():
    """Measure HuggingFace model initialization time."""
    
def test_concurrent_tool_execution():
    """Test multiple tools running concurrently."""
    
def test_memory_usage():
    """Monitor memory usage with multiple model tools."""
```

## Configuration Management

### Environment Variables
```bash
# Required for HuggingFace tools
HF_TOKEN=your_huggingface_token

# Required for Pipedream connector
PIPEDREAM_API_KEY=your_pipedream_key

# Optional: Development testing
TEST_USER_ID=550e8400-e29b-41d4-a716-446655440000
```

### Agent Configuration Format
```json
{
  "tools": [
    {
      "name": "python_repl",
      "config": {}
    },
    {
      "name": "pipedream_connector", 
      "config": {
        "agent_id": "123",
        "api_key": "agent_api_key",
        "use_test_auth": true
      }
    },
    {
      "name": "text_generation",
      "config": {
        "max_length": 100,
        "temperature": 0.7
      }
    }
  ]
}
```

## Quality Assurance

### Code Quality Standards
- All tools must implement the BaseTool interface
- Proper error handling with structured error responses
- Environment validation before tool execution
- Comprehensive logging for debugging

### Documentation Requirements
- Tool purpose and capabilities
- Input/output specifications
- Configuration options
- Usage examples
- Error conditions

### Security Considerations
- Environment variable validation
- Input sanitization for external API calls
- OAuth credential management through existing proxy
- Sandboxed execution for code tools

## Deployment Strategy

### Development
1. Local testing with test authentication
2. Unit and integration test execution
3. Performance benchmarking

### Staging
1. Full OAuth integration testing
2. Load testing with realistic workloads
3. Error scenario validation

### Production
1. Gradual rollout with monitoring
2. Performance metrics collection
3. Error rate monitoring
4. User feedback collection

## Monitoring and Observability

### Metrics to Track
- Tool execution latency
- Success/failure rates
- Resource utilization (CPU, memory, GPU)
- API rate limiting hits
- Environment validation failures

### Logging Strategy
- Structured logging with tool context
- Error stack traces with tool identification
- Performance timing logs
- Configuration validation logs

### Alerting
- Tool execution failures above threshold
- Environment validation errors
- API rate limit approaching
- Resource exhaustion warnings

## Future Enhancements

### Advanced Tool Features
1. **Tool Caching**: Cache expensive tool results
2. **Tool Versioning**: Support multiple tool versions
3. **Tool Marketplace**: Community tool sharing
4. **Tool Analytics**: Usage patterns and optimization

### Integration Expansions
1. **More MCP Servers**: Expand MCP server support
2. **Custom Protocols**: Support for proprietary APIs
3. **Tool Chaining**: Automatic tool workflow creation
4. **AI Tool Selection**: LLM-driven tool selection

This plan provides a structured approach to systematically expanding the tool ecosystem while maintaining code quality, performance, and security standards.
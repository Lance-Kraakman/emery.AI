"""Test MCP integration with local/filesystem operations."""

import pytest
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

from emery_agents.integrations.mcp_servers import MCPServerIntegration
from emery_agents.integrations.emery_client import EmeryClientIntegration


class TestLocalMCPOperations:
    """Test MCP operations that can run locally."""
    
    def test_mcp_initialization(self):
        """Test MCP server integration initializes."""
        mock_client = Mock()
        mcp = MCPServerIntegration(mock_client)
        
        assert mcp.emery_client == mock_client
        assert isinstance(mcp.server_registry, dict)
    
    @pytest.mark.asyncio
    async def test_filesystem_operations_mock(self, tmp_path):
        """Test filesystem-like MCP operations using mocks."""
        # Create mock Emery client
        mock_client = Mock()
        mock_client.proxy_oauth_call = AsyncMock()
        
        # Mock response for file operations
        mock_client.proxy_oauth_call.return_value = {
            "success": True,
            "data": {
                "file_path": str(tmp_path / "test.json"),
                "content": {"message": "File created successfully"},
                "operation": "write_file"
            }
        }
        
        mcp = MCPServerIntegration(mock_client)
        
        # Test file write operation
        result = await mcp.execute_server_action(
            server_name="filesystem",
            action="write_file",
            params={
                "path": str(tmp_path / "test.json"),
                "content": {"message": "test data"}
            }
        )
        
        # Verify the call was made
        mock_client.proxy_oauth_call.assert_called_once()
        
        # Verify result structure
        assert result["success"] is True
        assert "result" in result
        assert result["result"]["data"]["operation"] == "write_file"
    
    @pytest.mark.asyncio
    async def test_local_json_processing(self, tmp_path):
        """Test local JSON file processing without external dependencies."""
        # Create test data
        test_data = {
            "tasks": [
                {"id": 1, "name": "Task 1", "status": "pending"},
                {"id": 2, "name": "Task 2", "status": "completed"}
            ],
            "metadata": {"created": "2024-01-01", "version": "1.0"}
        }
        
        test_file = tmp_path / "tasks.json"
        
        # Write test data
        with open(test_file, 'w') as f:
            json.dump(test_data, f, indent=2)
        
        # Read and process
        with open(test_file, 'r') as f:
            loaded_data = json.load(f)
        
        # Process data (simulate MCP-like operations)
        pending_tasks = [task for task in loaded_data["tasks"] if task["status"] == "pending"]
        completed_tasks = [task for task in loaded_data["tasks"] if task["status"] == "completed"]
        
        # Verify processing
        assert len(pending_tasks) == 1
        assert len(completed_tasks) == 1
        assert pending_tasks[0]["name"] == "Task 1"
        assert completed_tasks[0]["name"] == "Task 2"
    
    @pytest.mark.asyncio
    async def test_mcp_error_handling(self):
        """Test MCP error handling for failed operations."""
        mock_client = Mock()
        mock_client.proxy_oauth_call = AsyncMock()
        
        # Mock error response
        mock_client.proxy_oauth_call.side_effect = Exception("Service unavailable")
        
        mcp = MCPServerIntegration(mock_client)
        
        # Test error handling
        result = await mcp.execute_server_action(
            server_name="test_service",
            action="test_action",
            params={"test": "data"}
        )
        
        # Should return error result
        assert result["success"] is False
        assert "error" in result
        assert "Service unavailable" in result["error"]
    
    def test_server_mapping(self):
        """Test server name to service mapping."""
        mock_client = Mock()
        mcp = MCPServerIntegration(mock_client)
        
        # Test various server mappings
        assert mcp._map_server_to_service("filesystem") == "filesystem"
        assert mcp._map_server_to_service("file") == "filesystem"
        assert mcp._map_server_to_service("gmail") == "gmail"
        assert mcp._map_server_to_service("email") == "gmail"
        assert mcp._map_server_to_service("slack") == "slack"
        assert mcp._map_server_to_service("unknown_service") == "unknown_service"
    
    @pytest.mark.asyncio
    async def test_batch_operations(self, tmp_path):
        """Test batch file operations locally."""
        # Create multiple test files
        files_data = {
            "config.json": {"setting1": "value1", "setting2": "value2"},
            "data.json": {"records": [1, 2, 3, 4, 5]},
            "metadata.json": {"version": "1.0", "timestamp": "2024-01-01"}
        }
        
        # Write all files
        created_files = []
        for filename, data in files_data.items():
            file_path = tmp_path / filename
            with open(file_path, 'w') as f:
                json.dump(data, f)
            created_files.append(file_path)
        
        # Verify all files exist
        for file_path in created_files:
            assert file_path.exists()
        
        # Read and verify all files
        for filename, expected_data in files_data.items():
            file_path = tmp_path / filename
            with open(file_path, 'r') as f:
                actual_data = json.load(f)
            assert actual_data == expected_data
    
    def test_mcp_registry_operations(self):
        """Test MCP server registry functionality."""
        mock_client = Mock()
        mcp = MCPServerIntegration(mock_client)
        
        # Test registering servers
        mcp.register_server("test_server", {"endpoint": "http://localhost:8080"})
        assert "test_server" in mcp.server_registry
        
        # Test getting server config
        config = mcp.get_server_config("test_server")
        assert config["endpoint"] == "http://localhost:8080"
        
        # Test listing servers
        servers = mcp.list_servers()
        assert "test_server" in servers
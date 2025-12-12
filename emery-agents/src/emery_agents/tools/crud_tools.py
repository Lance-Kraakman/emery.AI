"""
CRUD Tools Module

AIDEV-NOTE: Comprehensive CRUD tools for Emery organization data management.
Provides create, read, update, delete, and list operations for agents, documents,
files, tables, and teams. Uses internal authentication and calls emery-api with RLS context.
"""

import os
import json
import httpx
import asyncio
import logging
import threading
import time
import uuid
from typing import Any, Dict, Optional, Union
from smolagents import Tool
from ..grpc.generated.agent_worker_pb2 import ToolConfig

logger = logging.getLogger(__name__)

class AsyncHTTPManager:
    """Manages non-blocking HTTP operations with shared event loop."""

    def __init__(self):
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._client: Optional[httpx.AsyncClient] = None
        self._ready = threading.Event()
        self._start_event_loop_thread()

    def _start_event_loop_thread(self):
        """Start event loop in dedicated thread for non-blocking operations."""
        def run_loop():
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._client = httpx.AsyncClient(timeout=30.0)
            self._ready.set()
            self._loop.run_forever()

        self._thread = threading.Thread(target=run_loop, daemon=True)
        self._thread.start()
        self._ready.wait()

    def cleanup(self):
        """Cleanup HTTP manager resources."""
        if self._client and not self._client.is_closed:
            # Schedule client close in event loop
            if self._loop and self._loop.is_running():
                asyncio.run_coroutine_threadsafe(self._client.aclose(), self._loop)

        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)
    
    def make_request(self, endpoint: str, method: str, data: Optional[Dict],
                    auth_token: Optional[str], organization_id: Optional[str],
                    deadline_ms: Optional[int], base_url: str) -> Dict[str, Any]:
        """Thread-safe entry point using asyncio.run_coroutine_threadsafe."""
        if not self._loop or not self._client:
            return {"success": False, "error": "AsyncHTTPManager not initialized"}
        
        coro = self._make_request(endpoint, method, data, auth_token, organization_id, deadline_ms, base_url)
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        
        timeout = 30.0
        if deadline_ms:
            timeout = min(deadline_ms / 1000.0, 30.0)
        
        try:
            return future.result(timeout=timeout)
        except Exception as e:
            return {"success": False, "error": f"Request failed: {str(e)}"}
    
    async def _make_request(self, endpoint: str, method: str, data: Optional[Dict],
                           auth_token: Optional[str], organization_id: Optional[str],
                           deadline_ms: Optional[int], base_url: str) -> Dict[str, Any]:
        """Core async HTTP method with deadline propagation."""
        call_id = str(uuid.uuid4())[:8]
        start_time = time.time()

        logger.info(f"[TOOL-HTTP] {method} {endpoint} - call_id: {call_id}")
        logger.debug(f"[TOOL-HTTP] Request details - call_id: {call_id}, data_preview: {str(data)[:100] if data else 'None'}")

        url = f"{base_url}/{endpoint.lstrip('/')}"
        headers = {}

        # Add authentication headers
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        # Add organization context for RLS
        if organization_id:
            headers["X-Organization-ID"] = str(organization_id)

        # Add tracking headers
        headers["X-Call-ID"] = call_id
        headers["X-Source"] = "async_manager"
        if deadline_ms:
            headers["X-Deadline-MS"] = str(deadline_ms)
        
        # Calculate timeout from deadline
        timeout = 25.0
        if deadline_ms:
            timeout = min(deadline_ms / 1000 - 5, 25.0)
        
        # Add content type for JSON requests
        if data is not None:
            headers["Content-Type"] = "application/json"
        
        try:
            if self._client is None:
                return {"success": False, "error": "HTTP client not initialized"}
                
            response = await self._client.request(
                method=method,
                url=url,
                headers=headers,
                json=data if data else None,
                timeout=timeout
            )
            
            total_time = time.time() - start_time

            # Handle HTTP errors
            if response.status_code >= 400:
                error_detail = f"HTTP {response.status_code}"
                try:
                    error_body = response.json()
                    if "error" in error_body:
                        error_detail = error_body["error"]
                    elif "message" in error_body:
                        error_detail = error_body["message"]
                except:
                    error_detail = response.text[:200] if response.text else error_detail

                logger.error(f"[TOOL-HTTP] ❌ {method} {endpoint} - call_id: {call_id}, status: {response.status_code}, duration: {total_time:.2f}s")
                return {
                    "success": False,
                    "error": f"API request failed: {error_detail}",
                    "status_code": response.status_code,
                    "call_id": call_id,
                    "total_time": total_time
                }

            # Parse JSON response
            try:
                logger.info(f"[TOOL-HTTP] ✅ {method} {endpoint} - call_id: {call_id}, status: {response.status_code}, duration: {total_time:.2f}s")
                return {
                    "success": True,
                    "data": response.json(),
                    "status_code": response.status_code,
                    "call_id": call_id,
                    "total_time": total_time
                }
            except json.JSONDecodeError:
                logger.info(f"[ASYNC_MANAGER] ✅ {method} {endpoint} - {response.status_code} ({total_time:.2f}s)")
                return {
                    "success": True,
                    "data": response.text,
                    "status_code": response.status_code,
                    "call_id": call_id,
                    "total_time": total_time
                }
                
        except httpx.TimeoutException:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_MANAGER] ❌ TIMEOUT - call_id: {call_id}, timeout: {timeout}s")
            return {
                "success": False,
                "error": f"Request timeout after {timeout} seconds",
                "call_id": call_id,
                "total_time": total_time
            }
        except httpx.RequestError as e:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_MANAGER] ❌ REQUEST ERROR - call_id: {call_id}, error: {str(e)}")
            return {
                "success": False,
                "error": f"HTTP request failed: {str(e)}",
                "call_id": call_id,
                "total_time": total_time
            }
        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_MANAGER] ❌ UNEXPECTED ERROR - call_id: {call_id}, error: {str(e)}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "call_id": call_id,
                "total_time": total_time
            }

# Global AsyncHTTPManager instance
_async_manager = AsyncHTTPManager()

# Register cleanup handler for graceful shutdown
import atexit
def _cleanup_async_manager():
    """Cleanup handler for AsyncHTTPManager shutdown."""
    _async_manager.cleanup()
    logger.info("AsyncHTTPManager shut down")

atexit.register(_cleanup_async_manager)

class BaseCrudTool(Tool):
    """Base class for all CRUD tools with common functionality."""

    def __init__(self, resource_type: str, method: str):
        super().__init__()
        self.resource_type = resource_type
        self.method = method
        # AIDEV-NOTE: Use Next.js base URL from environment, append /api path
        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        self.base_url = f"{nextjs_base}/api"

    def _make_api_request(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None,
                         auth_token: Optional[str] = None, organization_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Make authenticated API request to emery-api with RLS context using AsyncHTTPManager.

        Args:
            endpoint: API endpoint path
            method: HTTP method (GET, POST, PUT, DELETE)
            data: Request body data for POST/PUT
            auth_token: Internal API authentication token
            organization_id: Organization ID for RLS context

        Returns:
            API response as dictionary
        """
        return _async_manager.make_request(
            endpoint=endpoint,
            method=method,
            data=data,
            auth_token=auth_token,
            organization_id=organization_id,
            deadline_ms=None,
            base_url=self.base_url
        )

    async def _make_async_api_request(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None,
                                    auth_token: Optional[str] = None, organization_id: Optional[str] = None,
                                    deadline_ms: Optional[int] = None) -> Dict[str, Any]:
        """
        Make async API request with deadline propagation to prevent circular dependency deadlocks.
        """
        import time
        import uuid
        import threading
        
        # Generate unique call ID for tracking
        call_id = f"{str(uuid.uuid4())[:8]}"
        start_time = time.time()
        
        logger.debug(f"[ASYNC_HTTP] START - call_id: {call_id}, endpoint: {endpoint}, method: {method}")
        
        if deadline_ms:
            logger.debug(f"[ASYNC_HTTP] Deadline provided - call_id: {call_id}, deadline_ms: {deadline_ms}")
        
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {}

        # Add authentication headers
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        # Add organization context for RLS
        if organization_id:
            headers["X-Organization-ID"] = str(organization_id)

        # Add tracking headers
        headers["X-Call-ID"] = call_id
        headers["X-Source"] = "python_tool_async"
        headers["X-Thread-ID"] = str(threading.get_ident())
        if deadline_ms:
            headers["X-Deadline-MS"] = str(deadline_ms)

        # Calculate timeout from deadline
        timeout = 25.0  # Default 25s
        if deadline_ms:
            timeout = min(deadline_ms / 1000 - 5, 25.0)  # 5s buffer

        # Add content type for JSON requests
        if data is not None:
            headers["Content-Type"] = "application/json"

        try:
            logger.debug(f"[ASYNC_HTTP] Making async request - call_id: {call_id}, timeout: {timeout}s")
            request_start = time.time()
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=data if data else None
                )
                
                total_time = time.time() - start_time
                
                # Handle HTTP errors
                if response.status_code >= 400:
                    error_detail = f"HTTP {response.status_code}"
                    try:
                        error_body = response.json()
                        if "error" in error_body:
                            error_detail = error_body["error"]
                        elif "message" in error_body:
                            error_detail = error_body["message"]
                    except:
                        error_detail = response.text[:200] if response.text else error_detail

                    logger.error(f"[ASYNC_HTTP] HTTP error response - call_id: {call_id}, status: {response.status_code}, error: {error_detail}")
                    return {
                        "success": False,
                        "error": f"API request failed: {error_detail}",
                        "status_code": response.status_code,
                        "call_id": call_id,
                        "total_time": total_time
                    }

                # Parse JSON response
                try:
                    logger.info(f"[ASYNC_HTTP] ✅ {method} {endpoint} - {response.status_code} ({total_time:.2f}s)")
                    return {
                        "success": True,
                        "data": response.json(),
                        "status_code": response.status_code,
                        "call_id": call_id,
                        "total_time": total_time
                    }
                except json.JSONDecodeError:
                    logger.info(f"[ASYNC_HTTP] ✅ {method} {endpoint} - {response.status_code} ({total_time:.2f}s)")
                    return {
                        "success": True,
                        "data": response.text,
                        "status_code": response.status_code,
                        "call_id": call_id,
                        "total_time": total_time
                    }
                    
        except httpx.TimeoutException:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_HTTP] ❌ TIMEOUT - call_id: {call_id}, timeout: {timeout}s, total_time: {total_time:.2f}s")
            return {
                "success": False,
                "error": f"Request timeout after {timeout} seconds",
                "call_id": call_id,
                "total_time": total_time
            }
        except httpx.RequestError as e:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_HTTP] ❌ REQUEST ERROR - call_id: {call_id}, error: {str(e)}, total_time: {total_time:.2f}s")
            return {
                "success": False,
                "error": f"HTTP request failed: {str(e)}",
                "call_id": call_id,
                "total_time": total_time
            }
        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_HTTP] ❌ UNEXPECTED ERROR - call_id: {call_id}, error: {str(e)}, total_time: {total_time:.2f}s")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "call_id": call_id,
                "total_time": total_time
            }

    def _make_api_request_with_deadline(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None,
                                    auth_token: Optional[str] = None, organization_id: Optional[str] = None,
                                    deadline_ms: Optional[int] = None) -> Dict[str, Any]:
        """
        Execute async HTTP request using AsyncHTTPManager with deadline propagation.
        """
        return _async_manager.make_request(
            endpoint=endpoint,
            method=method,
            data=data,
            auth_token=auth_token,
            organization_id=organization_id,
            deadline_ms=deadline_ms,
            base_url=self.base_url
        )


def load_agent_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Any:
    """Load Agent CRUD tool with method-specific routing."""

    class AgentCrudTool(BaseCrudTool):
        """CRUD operations for Emery agents."""

        name = "agent_crud"
        description = "Create, read, update, delete, and list agents in your organization. Requires authentication and organization context."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "agent_id": {"type": "string", "description": "Agent ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Agent data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("agent", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   agent_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute agent CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Agent data is required for create operation"}

                return self._make_api_request_with_deadline(
                    endpoint="agents",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not agent_id:
                    return {"success": False, "error": "Agent ID is required for read operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"agents/{agent_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not agent_id:
                    return {"success": False, "error": "Agent ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Agent data is required for update operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"agents/{agent_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not agent_id:
                    return {"success": False, "error": "Agent ID is required for delete operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"agents/{agent_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "agents"
                if filters:
                    # Convert filters to query parameters
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return AgentCrudTool()


def load_document_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Any:
    """Load Document CRUD tool with method-specific routing."""

    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class DocumentCrudTool(BaseCrudTool):
        """CRUD operations for Emery documents."""

        name = "document_crud"
        description = "Create, read, update, and list documents. Use 'create' to make new documents, 'list' to find documents, 'read' to get content, 'update' to modify content."
        # AIDEV-NOTE: tableId and fieldId accept both string and integer (like skill_crud)
        inputs = {
            "method": {"type": "string", "description": "Operation: create, read, update, list"},
            "document_id": {"type": "string", "description": "Document ID (required for read/update)", "nullable": True},
            "table_id": {"type": ["string", "integer"], "description": "Table ID containing the document field (required for create/read/update)", "nullable": True},
            "field_id": {"type": ["string", "integer"], "description": "Field ID of document column (required for create/read/update)", "nullable": True},
            "row_id": {"type": "string", "description": "Row ID to add document to (optional for create). If omitted, creates a new row.", "nullable": True},
            "title": {"type": "string", "description": "Document title (required for create)", "nullable": True},
            "data": {
                "type": "object",
                "description": """Document content for update. JSON structure:
{
  "type": "doc",
  "content": [
    {"type": "paragraph", "content": [{"type": "text", "text": "Plain text here"}]},
    {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Section Title"}]},
    {"type": "bulletList", "content": [
      {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Item 1"}]}]}
    ]}
  ]
}
Node types: paragraph, heading (level 1-6), bulletList, orderedList, listItem, blockquote, codeBlock, image, table, tableRow, tableCell, horizontalRule, hardBreak
Marks (inline formatting): {"type": "text", "text": "bold", "marks": [{"type": "bold"}]}
Available marks: bold, italic, underline, strike, code, link (with href attr), highlight""",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("document", "crud")

        def forward(self, method: str, document_id: Optional[str] = None,
                   table_id: Optional[Union[str, int]] = None,
                   field_id: Optional[Union[str, int]] = None,
                   row_id: Optional[str] = None,
                   title: Optional[str] = None,
                   data: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute document CRUD operation."""

            # AIDEV-NOTE: Coerce table_id and field_id to strings for URL params
            table_id_str = str(table_id) if table_id is not None else None
            field_id_str = str(field_id) if field_id is not None else None

            if method == "create":
                if not table_id or not field_id:
                    return {"success": False, "error": "table_id and field_id are required for create operation"}
                if not title:
                    return {"success": False, "error": "title is required for create operation"}

                create_data: Dict[str, Any] = {
                    "tableId": int(table_id),
                    "fieldId": int(field_id),
                    "title": title
                }
                if row_id:  # Optional: add to existing row
                    create_data["rowId"] = row_id
                if data:  # Optional initial content
                    create_data["initialContent"] = data

                return self._make_api_request_with_deadline(
                    endpoint="documents",
                    method="POST",
                    data=create_data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "read":
                if not document_id:
                    return {"success": False, "error": "document_id is required for read operation"}
                if not table_id_str or not field_id_str:
                    return {"success": False, "error": "table_id and field_id are required for read operation. First call document_crud(method='list') to find documents and their location."}

                return self._make_api_request_with_deadline(
                    endpoint=f"documents/{document_id}?tableId={table_id_str}&fieldId={field_id_str}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "update":
                if not document_id:
                    return {"success": False, "error": "document_id is required for update operation"}
                if not table_id_str or not field_id_str:
                    return {"success": False, "error": "table_id and field_id are required for update operation. First call document_crud(method='list') to find documents and their location."}
                if not data:
                    return {"success": False, "error": "data (TipTap content) is required for update operation"}

                # Wrap content in tiptapContent for the API
                update_data = {"tiptapContent": data}

                return self._make_api_request_with_deadline(
                    endpoint=f"documents/{document_id}?tableId={table_id_str}&fieldId={field_id_str}",
                    method="PUT",
                    data=update_data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "list":
                return self._make_api_request_with_deadline(
                    endpoint="documents",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, list, read, update"}

    return DocumentCrudTool()


def load_file_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Any:
    """Load File CRUD tool with method-specific routing.

    AIDEV-NOTE: Files are stored as field values in table rows, not as standalone entities.
    Context params (tableId, rowId, fieldId) are required to locate the file.
    """

    class FileCrudTool(BaseCrudTool):
        """CRUD operations for Emery files."""

        name = "file_crud"
        description = "Create, read, update, and delete files in your organization. Supports file upload, download, and metadata management. Files are stored in table row fields, so context params (table_id, row_id, field_id) are required for read/update/delete."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete"},
            "file_id": {"type": "string", "description": "File ID for read, update, delete operations", "nullable": True},
            "table_id": {"type": "string", "description": "Table ID containing the file field (required for read/update/delete)", "nullable": True},
            "row_id": {"type": "string", "description": "Row ID containing the file (required for read/update/delete)", "nullable": True},
            "field_id": {"type": "string", "description": "Field ID of the file column (required for read/update/delete)", "nullable": True},
            "data": {"type": "object", "description": "File data for create and update operations", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("file", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   file_id: Optional[str] = None, table_id: Optional[str] = None,
                   row_id: Optional[str] = None, field_id: Optional[str] = None,
                   data: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute file CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "File data is required for create operation"}

                return self._make_api_request_with_deadline(
                    endpoint="files/upload",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not file_id:
                    return {"success": False, "error": "File ID is required for read operation"}
                if not table_id or not row_id or not field_id:
                    return {"success": False, "error": "Context params (table_id, row_id, field_id) required for read operation"}

                # Pass context as query params
                endpoint = f"files/{file_id}?tableId={table_id}&rowId={row_id}&fieldId={field_id}"
                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not file_id:
                    return {"success": False, "error": "File ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "File data is required for update operation"}
                if not table_id or not row_id or not field_id:
                    return {"success": False, "error": "Context params (table_id, row_id, field_id) required for update operation"}

                # Pass context as query params
                endpoint = f"files/{file_id}?tableId={table_id}&rowId={row_id}&fieldId={field_id}"
                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not file_id:
                    return {"success": False, "error": "File ID is required for delete operation"}
                if not table_id or not row_id or not field_id:
                    return {"success": False, "error": "Context params (table_id, row_id, field_id) required for delete operation"}

                # Pass context as query params
                endpoint = f"files/{file_id}?tableId={table_id}&rowId={row_id}&fieldId={field_id}"
                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete"}

    return FileCrudTool()


def load_table_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Any:
    """
    Load comprehensive Table CRUD tool with table and row operations.

    AIDEV-NOTE: Supports 9 operations total:
    - Table operations (5): create_table, read_table, update_table, delete_table, list_tables
    - Row operations (4): create_row, get_rows, update_row, delete_row

    For reference tools (e.g., emery-read-table from @ mentions), config.config may contain
    pre-configured table_id from the frontend ToolDTO.

    AIDEV-NOTE: Auth is captured in closure variables (_auth_token, _org_id) - NOT exposed in inputs.
    This prevents the LLM from seeing auth params and trying to provide placeholder values.
    """
    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    # Extract pre-configured table_id from config if present (for reference tools)
    # Frontend passes this as table_id when user selects a specific table from @ dropdown
    _preconfigured_table_id = config.config.get("table_id") if config.config else None

    class TableCrudTool(BaseCrudTool):
        """Comprehensive CRUD operations for Emery tables and rows."""

        name = "table_crud"
        description = "Comprehensive table and row management. Table operations: create_table (create new table), read_table (get table details), update_table (modify metadata), delete_table (remove table), list_tables (list all tables). Row operations: create_row (add row), get_rows (query with pagination), update_row (modify row), delete_row (remove row)."
        inputs = {
            "method": {"type": "string", "description": "Operation: create_table, read_table, update_table, delete_table, list_tables, create_row, get_rows, update_row, delete_row"},
            "table_id": {"type": "string", "description": "Table ID (required for most operations)", "nullable": True},
            "row_id": {"type": "string", "description": "Row ID (required for update_row, delete_row)", "nullable": True},
            "data": {"type": "object", "description": "Data payload. For create_table: {name, databaseId, description}. For create_row/update_row: field values {field_1: value1, field_2: value2}. For update_table: {name, description}", "nullable": True},
            "limit": {"type": "integer", "description": "Max rows to return for get_rows (default: 100)", "nullable": True},
            "offset": {"type": "integer", "description": "Pagination offset for get_rows (default: 0)", "nullable": True},
            "order_by": {"type": "string", "description": "Field to sort by for get_rows", "nullable": True},
            "order_direction": {"type": "string", "description": "Sort direction: ASC or DESC", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for queries", "nullable": True}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("table", "crud")

        def forward(self, method: str, table_id: Optional[str] = None, row_id: Optional[str] = None,
                   data: Optional[Dict] = None, limit: Optional[int] = None,
                   offset: Optional[int] = None, order_by: Optional[str] = None,
                   order_direction: Optional[str] = None, filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute table or row CRUD operation."""

            # Pre-configured table_id takes priority over LLM-provided (for reference tools)
            # This ensures @table:DatabaseName/TableName uses the numeric ID from frontend config
            effective_table_id = _preconfigured_table_id or table_id

            # ============================================================
            # TABLE OPERATIONS
            # ============================================================

            if method == "create_table":
                if not data:
                    return {"success": False, "error": "Table data is required for create_table. Provide {name, databaseId, description}"}

                return self._make_api_request_with_deadline(
                    endpoint="tables",
                    method="POST",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "read_table":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for read_table operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"tables/{effective_table_id}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "update_table":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for update_table operation"}
                if not data:
                    return {"success": False, "error": "Table data is required for update_table. Provide {name, description, metadata}"}

                return self._make_api_request_with_deadline(
                    endpoint=f"tables/{effective_table_id}",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "delete_table":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for delete_table operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"tables/{effective_table_id}",
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "list_tables":
                endpoint = "tables"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            # ============================================================
            # ROW OPERATIONS
            # ============================================================

            elif method == "create_row":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for create_row operation"}
                if not data:
                    return {"success": False, "error": "Row data is required for create_row. Provide field values {field_1: value1, field_2: value2}"}

                return self._make_api_request_with_deadline(
                    endpoint="rows",
                    method="POST",
                    data={"tableId": int(effective_table_id), "data": data},
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "get_rows":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for get_rows operation"}

                # Build query parameters
                query_params = [f"tableId={effective_table_id}"]

                # Add pagination parameters
                if limit is not None:
                    query_params.append(f"limit={limit}")
                else:
                    query_params.append("limit=100")  # Default to 100

                if offset is not None:
                    query_params.append(f"offset={offset}")
                else:
                    query_params.append("offset=0")  # Default to 0

                # Add sorting parameters
                if order_by:
                    query_params.append(f"orderBy={order_by}")
                if order_direction:
                    query_params.append(f"orderDirection={order_direction}")

                endpoint = "rows?" + "&".join(query_params)

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "update_row":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for update_row operation"}
                if not row_id:
                    return {"success": False, "error": "Row ID is required for update_row operation"}
                if not data:
                    return {"success": False, "error": "Row data is required for update_row. Provide updated field values"}

                return self._make_api_request_with_deadline(
                    endpoint="rows",
                    method="PUT",
                    data={"tableId": int(effective_table_id), "rowId": row_id, "data": data},
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "delete_row":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for delete_row operation"}
                if not row_id:
                    return {"success": False, "error": "Row ID is required for delete_row operation"}

                endpoint = f"rows?tableId={effective_table_id}&rowId={row_id}"

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            else:
                return {
                    "success": False,
                    "error": f"Unknown method: {method}. Supported: create_table, read_table, update_table, delete_table, list_tables, create_row, get_rows, update_row, delete_row"
                }

    return TableCrudTool()


def load_team_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Any:
    """Load Team CRUD tool with method-specific routing."""

    class TeamCrudTool(BaseCrudTool):
        """CRUD operations for Emery teams."""

        name = "team_crud"
        description = "Create, read, update, delete, and list teams in your organization. Supports team membership and permission management."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "team_id": {"type": "string", "description": "Team ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Team data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("team", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   team_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute team CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Team data is required for create operation"}

                return self._make_api_request_with_deadline(
                    endpoint="teams",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not team_id:
                    return {"success": False, "error": "Team ID is required for read operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"teams/{team_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not team_id:
                    return {"success": False, "error": "Team ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Team data is required for update operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"teams/{team_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not team_id:
                    return {"success": False, "error": "Team ID is required for delete operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"teams/{team_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "teams"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return TeamCrudTool()


def load_database_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Any:
    """Load Database CRUD tool with method-specific routing."""

    class DatabaseCrudTool(BaseCrudTool):
        """CRUD operations for Emery databases."""

        name = "database_crud"
        description = "Create, read, update, delete, and list databases in your organization. Supports database configuration and connection management."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "database_id": {"type": "string", "description": "Database ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Database data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("database", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   database_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute database CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Database data is required for create operation"}

                return self._make_api_request_with_deadline(
                    endpoint="databases",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for read operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"databases/{database_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Database data is required for update operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"databases/{database_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for delete operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"databases/{database_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "databases"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return DatabaseCrudTool()


def load_skill_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Any:
    """
    Load Skill CRUD tool with method-specific routing.

    AIDEV-NOTE: Supports read, update, list operations for skills.
    Skills can be agent-scoped (agentId set) or organization-scoped (agentId null).
    Auth is captured in closure variables - NOT exposed to LLM via inputs schema.
    """
    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class SkillCrudTool(BaseCrudTool):
        """CRUD operations for Emery skills."""

        name = "skill_crud"
        description = "Read, update, and list skills. Skills have: name, description, instructions, inputs, outputs, tools, model. Use 'read' to get skill details, 'update' to modify a skill, 'list' to see all skills."
        # AIDEV-NOTE: skill_id and agent_id accept both string and integer because LLMs often
        # pass integers (e.g., skill_id=42 instead of skill_id="42"). smolagents validates
        # types before calling forward(), so we must accept both in the schema.
        inputs = {
            "method": {"type": "string", "description": "Operation: read, update, list"},
            "skill_id": {"type": ["string", "integer"], "description": "Skill ID (required for read/update)", "nullable": True},
            "agent_id": {"type": ["string", "integer"], "description": "Agent ID to filter skills (optional for list)", "nullable": True},
            "data": {
                "type": "object",
                "description": """Skill data for update. Structure:
{
  "name": "string - skill display name",
  "description": "string - what the skill does",
  "instructions": "string - THE ACTUAL PROMPT TEXT that defines what the AI does when running this skill",
  "inputs": [{"name": "string", "type": "string|number|boolean", "required": true|false, "description": "string"}],
  "outputs": [{"name": "string", "type": "string", "description": "string"}],
  "tools": ["tool_name_1", "tool_name_2"],
  "model": "string or null"
}
IMPORTANT - In instructions:
- Reference inputs using {input_name} syntax, e.g. "Summarize the following: {email_content}"
- Set outputs as variables, e.g. "{summary} = 'Your generated summary here'"
Only include fields you want to change (partial updates allowed).""",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("skill", "crud")

        def forward(self, method: str, skill_id: Optional[Union[str, int]] = None,
                   agent_id: Optional[Union[str, int]] = None, data: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute skill CRUD operation."""

            # AIDEV-NOTE: Coerce skill_id and agent_id to strings - LLMs often pass integers
            if skill_id is not None:
                skill_id = str(skill_id)
            if agent_id is not None:
                agent_id = str(agent_id)

            # Validate skill_id is numeric for methods that require it
            # This catches when model passes skill name instead of numeric ID
            if method in ("read", "update", "delete") and skill_id:
                if not skill_id.isdigit():
                    return {
                        "success": False,
                        "error": f"skill_id must be a NUMBER (e.g., 42), not '{skill_id}'. "
                                 f"First call skill_crud(method='list') to find all skills and their numeric IDs, "
                                 f"then use the matching skill's numeric ID for read/update/delete operations."
                    }

            if method == "read":
                if not skill_id:
                    return {"success": False, "error": "Skill ID is required for read operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"skills/{skill_id}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "update":
                if not skill_id:
                    return {"success": False, "error": "Skill ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Skill data is required for update operation. Provide: name, description, instructions, inputs, outputs, tools, or model"}

                # Check if skill is a system skill (cannot be edited)
                read_result = self._make_api_request_with_deadline(
                    endpoint=f"skills/{skill_id}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
                if read_result.get("success") and read_result.get("data", {}).get("isSystem"):
                    return {
                        "success": False,
                        "error": "System skills cannot be edited. Duplicate this skill to create your own version."
                    }

                return self._make_api_request_with_deadline(
                    endpoint=f"skills/{skill_id}",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "list":
                endpoint = "skills"
                if agent_id:
                    endpoint += f"?agent_id={agent_id}"

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: read, update, list"}

    return SkillCrudTool()


# Registry of CRUD tools
# AIDEV-NOTE: Tool names match category names directly (agents, tables, etc.)
# This eliminates need for complex category mapping in seeding
CRUD_TOOLS = {
    "agents": load_agent_crud,
    "documents": load_document_crud,
    "files": load_file_crud,
    "tables": load_table_crud,
    "teams": load_team_crud,
    "databases": load_database_crud,
    "skills": load_skill_crud,
}
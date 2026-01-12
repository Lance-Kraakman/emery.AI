"""CRUD tools for agents, documents, files, tables, and teams."""

import os
import json
import httpx
import asyncio
import logging
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Union
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

            # Handle HTTP errors - return explicit error STRING so model can't miss it
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
                # AIDEV-NOTE: Return explicit error STRING instead of dict so small models can't miss it
                # The model kept hallucinating success when seeing {"success": False, "error": "..."}
                return f"❌ ERROR: {error_detail}. This operation FAILED. Do NOT claim success - report this error to the user."

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
            return f"❌ ERROR: Request timeout after {timeout} seconds. This operation FAILED. Do NOT claim success."
        except httpx.RequestError as e:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_MANAGER] ❌ REQUEST ERROR - call_id: {call_id}, error: {str(e)}")
            return f"❌ ERROR: HTTP request failed: {str(e)}. This operation FAILED. Do NOT claim success."
        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[ASYNC_MANAGER] ❌ UNEXPECTED ERROR - call_id: {call_id}, error: {str(e)}")
            return f"❌ ERROR: Unexpected error: {str(e)}. This operation FAILED. Do NOT claim success."

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
        """Make async API request with deadline propagation."""
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
                
                # Handle HTTP errors - return explicit error STRING so model can't miss it
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
                    return f"❌ ERROR: {error_detail}. This operation FAILED. Do NOT claim success - report this error to the user."

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


def load_agent_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
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


def load_document_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
    """Load Document CRUD tool with method-specific routing."""

    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class DocumentCrudTool(BaseCrudTool):
        """CRUD operations for Emery documents."""

        name = "document_crud"
        description = "Create, read, and modify documents. Use high-level methods (append_text, update_text, etc.) that handle formatting automatically."
        # AIDEV-NOTE: tableId and fieldId accept both string and integer (like skill_crud)
        inputs = {
            "method": {"type": "string", "description": "Operation: create, read, list, append_text, append_heading, append_list, update_text, update_heading"},
            "document_id": {"type": "string", "description": "Document ID (required for read/update/append/modify)", "nullable": True},
            "table_id": {"type": ["string", "integer"], "description": "Table ID containing the document field", "nullable": True},
            "field_id": {"type": ["string", "integer"], "description": "Field ID of document column", "nullable": True},
            "row_id": {"type": "string", "description": "Row ID (optional for create)", "nullable": True},
            "title": {"type": "string", "description": "Document title (required for create)", "nullable": True},
            "text": {"type": "string", "description": "Text content for append_text, append_heading, update_text, update_heading", "nullable": True},
            "level": {"type": "integer", "description": "Heading level 1-6 for append_heading, update_heading", "nullable": True},
            "items": {"type": "array", "description": "List items for append_list", "nullable": True},
            "position": {"type": "integer", "description": "Block index (0-based) for update_text, update_heading", "nullable": True},
            "bold": {"type": "boolean", "description": "Make text bold", "nullable": True},
            "italic": {"type": "boolean", "description": "Make text italic", "nullable": True},
            "ordered": {"type": "boolean", "description": "Use ordered list instead of bullets", "nullable": True},
            "data": {"type": "object", "description": "Full TipTap JSON for 'update' method (low-level)", "nullable": True}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("document", "crud")

        def _build_paragraph(self, text: str, bold: bool = False, italic: bool = False) -> Dict:
            """Build a paragraph node with optional formatting."""
            marks = []
            if bold:
                marks.append({"type": "bold"})
            if italic:
                marks.append({"type": "italic"})

            text_node: Dict[str, Any] = {"type": "text", "text": text}
            if marks:
                text_node["marks"] = marks

            return {"type": "paragraph", "content": [text_node]}

        def _build_heading(self, text: str, level: int) -> Dict:
            """Build a heading node."""
            return {
                "type": "heading",
                "attrs": {"level": level},
                "content": [{"type": "text", "text": text}]
            }

        def _build_list(self, items: List[str], ordered: bool = False) -> Dict:
            """Build a bullet or ordered list node."""
            list_items = [
                {
                    "type": "listItem",
                    "content": [
                        {"type": "paragraph", "content": [{"type": "text", "text": item}]}
                    ]
                }
                for item in items
            ]
            return {
                "type": "orderedList" if ordered else "bulletList",
                "content": list_items
            }

        def _modify_content(self, doc_id: str, table_id: str, field_id: str,
                           node: Dict, position: Optional[int] = None) -> Dict[str, Any]:
            """Read document, append or replace at position, save."""
            # 1. Read current document
            read_result = self._make_api_request_with_deadline(
                endpoint=f"documents/{doc_id}?tableId={table_id}&fieldId={field_id}",
                method="GET",
                auth_token=_auth_token,
                organization_id=_org_id
            )

            if isinstance(read_result, str) or not read_result.get("success"):
                return read_result if isinstance(read_result, dict) else {"success": False, "error": read_result}

            # 2. Get current content (API response is double-nested: data.data.tiptapContent)
            inner_data = read_result.get("data", {}).get("data", {})
            current = inner_data.get("tiptapContent", {})
            content = current.get("content", [])

            # 3. Modify content
            if position is not None:
                # Update: replace at position
                if 0 <= position < len(content):
                    content[position] = node
                else:
                    return {"success": False, "error": f"Position {position} out of range (0-{len(content)-1})"}
            else:
                # Append
                content.append(node)

            # 4. Save updated document
            updated = {"type": "doc", "content": content}
            return self._make_api_request_with_deadline(
                endpoint=f"documents/{doc_id}?tableId={table_id}&fieldId={field_id}",
                method="PUT",
                data={"tiptapContent": updated},
                auth_token=_auth_token,
                organization_id=_org_id
            )

        def forward(self, method: str, document_id: Optional[str] = None,
                   table_id: Optional[Union[str, int]] = None,
                   field_id: Optional[Union[str, int]] = None,
                   row_id: Optional[str] = None,
                   title: Optional[str] = None,
                   text: Optional[str] = None,
                   level: Optional[int] = None,
                   items: Optional[List[str]] = None,
                   position: Optional[int] = None,
                   bold: Optional[bool] = None,
                   italic: Optional[bool] = None,
                   ordered: Optional[bool] = None,
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

            elif method == "list":
                return self._make_api_request_with_deadline(
                    endpoint="documents",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            # High-level append methods
            elif method == "append_text":
                if not document_id:
                    return {"success": False, "error": "document_id is required"}
                if not table_id_str or not field_id_str:
                    return {"success": False, "error": "table_id and field_id are required"}
                if not text:
                    return {"success": False, "error": "text is required for append_text"}
                node = self._build_paragraph(text, bold=bool(bold), italic=bool(italic))
                return self._modify_content(document_id, table_id_str, field_id_str, node)

            elif method == "append_heading":
                if not document_id:
                    return {"success": False, "error": "document_id is required"}
                if not table_id_str or not field_id_str:
                    return {"success": False, "error": "table_id and field_id are required"}
                if not text:
                    return {"success": False, "error": "text is required for append_heading"}
                heading_level = level if level and 1 <= level <= 6 else 2
                node = self._build_heading(text, heading_level)
                return self._modify_content(document_id, table_id_str, field_id_str, node)

            elif method == "append_list":
                if not document_id:
                    return {"success": False, "error": "document_id is required"}
                if not table_id_str or not field_id_str:
                    return {"success": False, "error": "table_id and field_id are required"}
                if not items or not isinstance(items, list):
                    return {"success": False, "error": "items (array of strings) is required for append_list"}
                node = self._build_list(items, ordered=bool(ordered))
                return self._modify_content(document_id, table_id_str, field_id_str, node)

            # High-level update methods
            elif method == "update_text":
                if not document_id:
                    return {"success": False, "error": "document_id is required"}
                if not table_id_str or not field_id_str:
                    return {"success": False, "error": "table_id and field_id are required"}
                if position is None:
                    return {"success": False, "error": "position is required for update_text"}
                if not text:
                    return {"success": False, "error": "text is required for update_text"}
                node = self._build_paragraph(text, bold=bool(bold), italic=bool(italic))
                return self._modify_content(document_id, table_id_str, field_id_str, node, position)

            elif method == "update_heading":
                if not document_id:
                    return {"success": False, "error": "document_id is required"}
                if not table_id_str or not field_id_str:
                    return {"success": False, "error": "table_id and field_id are required"}
                if position is None:
                    return {"success": False, "error": "position is required for update_heading"}
                if not text:
                    return {"success": False, "error": "text is required for update_heading"}
                heading_level = level if level and 1 <= level <= 6 else 2
                node = self._build_heading(text, heading_level)
                return self._modify_content(document_id, table_id_str, field_id_str, node, position)

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, list, read, append_text, append_heading, append_list, update_text, update_heading"}

    return DocumentCrudTool()


def load_file_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
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


def load_team_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
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


def load_database_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
    """
    Load Database CRUD tool with method-specific routing.

    AIDEV-NOTE: Auth is captured in closure variables (_auth_token, _org_id) - NOT exposed in inputs.
    This matches the pattern used by field_crud, table_crud, row_crud.
    """
    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class DatabaseCrudTool(BaseCrudTool):
        """CRUD operations for Emery databases."""

        name = "database_crud"
        description = "Database management: list (get all databases), read (get database details), create_database, update_database, delete_database."
        inputs = {
            "method": {"type": "string", "description": "Operation: list, read, create, update, delete"},
            "database_id": {"type": "string", "description": "Database ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Database data for create/update: {name, description}", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("database", "crud")

        def forward(self, method: str, database_id: Optional[str] = None,
                   data: Optional[Dict] = None, filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute database CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Database data is required for create operation. Provide {name, description}"}

                return self._make_api_request_with_deadline(
                    endpoint="databases",
                    method="POST",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "read":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for read operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"databases/{database_id}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
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
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "delete":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for delete operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"databases/{database_id}",
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
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
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: list, read, create, update, delete"}

    return DatabaseCrudTool()


def load_skill_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
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


# Import split tools from new modules
from .table_tools import load_table_crud
from .row_tools import load_row_crud
from .field_tools import load_field_crud

# Registry of CRUD tools
# AIDEV-NOTE: Tool names match category names directly (agents, tables, etc.)
# Table/row/field operations have been split into separate modules for maintainability.
CRUD_TOOLS = {
    "agents": load_agent_crud,
    "documents": load_document_crud,
    "files": load_file_crud,
    "tables": load_table_crud,   # Table operations (from table_tools.py)
    "rows": load_row_crud,       # Row operations (from row_tools.py)
    "fields": load_field_crud,   # Field/column operations (from field_tools.py)
    "teams": load_team_crud,
    "databases": load_database_crud,
    "skills": load_skill_crud,
}
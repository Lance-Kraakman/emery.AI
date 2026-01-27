"""
Agent Session Manager - Stateful Sessions for Persistent Agent Memory

Manages persistent agent sessions for stateful conversations.
Sessions are identified by chat_id and maintain agent memory across messages.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Any, List, TYPE_CHECKING
from dataclasses import dataclass, field

from ..execution.state_machine import CoordinatorStateMachine, Phase

if TYPE_CHECKING:
    from ...grpc.agents.agent_models import ChatAgent
    from ...entities.models.plan import Plan
    from ...infrastructure.workspace_sync import WorkspaceSync

logger = logging.getLogger(__name__)

@dataclass
class SessionMetadata:
    """Metadata for agent session."""
    session_id: str
    organization_id: int
    user_id: str
    created_at: datetime
    last_activity: datetime
    message_count: int = 0
    restored_from_history: bool = False
    history_message_count: int = 0
    # Error tracking for recovery
    consecutive_errors: int = 0
    last_error_type: Optional[str] = None
    last_error_timestamp: Optional[datetime] = None
    # File attachments accumulated during session (for skill context injection)
    attachments: List[Any] = field(default_factory=list)
    # Workspace tracking for filesystem-based agent execution
    workspace_path: Optional[Path] = None  # Local path to extracted workspace
    workspace_id: Optional[str] = None  # ID for S3 (user_id or agent_id)
    workspace_prefix: Optional[str] = None  # S3 prefix ("workspaces/users" or "workspaces/agents")


class SessionManager:
    """
    Manages stateful agent sessions with automatic cleanup.

    Features:
    - In-memory session storage (agent instances persist between messages)
    - Automatic idle timeout (default 30 min)
    - Maximum lifetime limit (default 4 hours)
    - Per-session locking for concurrency safety
    - Background cleanup task
    - History restoration for session recovery

    Session Lifecycle:
    1. First message → Create agent, restore from history if available
    2. Subsequent messages → Reuse agent (agent.memory persists)
    3. After idle timeout → Session removed from memory
    4. After restart → Recreate agent, restore from database history
    """

    def __init__(
        self,
        idle_timeout: int = 1800,
        max_lifetime: int = 14400,
        workspace_sync: Optional['WorkspaceSync'] = None
    ):
        """
        Initialize session manager.

        Args:
            idle_timeout: Seconds of inactivity before cleanup (default 30 min)
            max_lifetime: Maximum session lifetime in seconds (default 4 hours)
            workspace_sync: WorkspaceSync instance for S3 workspace persistence
        """
        self.agents: Dict[str, 'ChatAgent'] = {}
        self.metadata: Dict[str, SessionMetadata] = {}
        self.locks: Dict[str, asyncio.Lock] = {}
        self.state_machines: Dict[str, CoordinatorStateMachine] = {}
        self.idle_timeout = idle_timeout
        self.max_lifetime = max_lifetime
        self.workspace_sync = workspace_sync
        # Plan generation sessions (for HITL question/answer flow)
        self._plan_sessions: Dict[str, Dict[str, Any]] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        logger.info(
            f"SessionManager initialized: "
            f"idle_timeout={idle_timeout}s, max_lifetime={max_lifetime}s, "
            f"workspace_sync={'enabled' if workspace_sync else 'disabled'}"
        )

    def start_cleanup_task(self):
        """Start background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("🧹 Session cleanup task started")

    async def _cleanup_loop(self):
        """Background task to cleanup idle/expired sessions."""
        while True:
            try:
                await asyncio.sleep(300)  # Check every 5 minutes
                await self._cleanup_idle_sessions()
            except asyncio.CancelledError:
                logger.info("Session cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Session cleanup error: {e}", exc_info=True)

    async def _cleanup_idle_sessions(self):
        """Remove idle and expired sessions, uploading workspaces first."""
        now = datetime.now()
        sessions_to_remove = []

        for session_id, meta in list(self.metadata.items()):
            # Check idle timeout
            idle_time = (now - meta.last_activity).total_seconds()
            if idle_time > self.idle_timeout:
                sessions_to_remove.append((session_id, f"idle timeout ({idle_time:.0f}s)"))
                continue

            # Check max lifetime
            lifetime = (now - meta.created_at).total_seconds()
            if lifetime > self.max_lifetime:
                sessions_to_remove.append((session_id, f"max lifetime ({lifetime:.0f}s)"))

        for session_id, reason in sessions_to_remove:
            # Upload workspace to S3 before removing session
            meta = self.metadata.get(session_id)
            if meta and self.workspace_sync and meta.workspace_id and meta.workspace_prefix:
                try:
                    self.workspace_sync.upload(meta.workspace_id, prefix=meta.workspace_prefix)
                    self.workspace_sync.cleanup(meta.workspace_id)
                    logger.info(f"📤 Uploaded workspace for session {session_id} before cleanup")
                except Exception as e:
                    logger.error(f"Failed to upload workspace for session {session_id}: {e}")

            await self.remove_session(session_id, reason)

        if sessions_to_remove:
            logger.info(
                f"🧹 Cleaned up {len(sessions_to_remove)} idle/expired sessions. "
                f"Active sessions: {len(self.agents)}"
            )

    def _get_lock(self, session_id: str) -> asyncio.Lock:
        """Get or create lock for session."""
        if session_id not in self.locks:
            self.locks[session_id] = asyncio.Lock()
        return self.locks[session_id]

    def get_agent(self, session_id: str) -> Optional['ChatAgent']:
        """
        Get existing agent for session if in memory.

        Args:
            session_id: Unique session identifier

        Returns:
            ChatAgent if session exists, None otherwise
        """
        logger.info(f"🔍 [SESSION-MANAGER] Looking up session: {session_id}")
        logger.info(f"🔍 [SESSION-MANAGER] Active sessions: {list(self.agents.keys())}")

        if session_id in self.agents:
            # Update activity timestamp
            self.metadata[session_id].last_activity = datetime.now()
            self.metadata[session_id].message_count += 1

            logger.info(
                f"♻️  [SESSION-MANAGER] Found session {session_id} "
                f"(msg #{self.metadata[session_id].message_count})"
            )
            return self.agents[session_id]

        logger.info(f"❌ [SESSION-MANAGER] Session {session_id} not found in memory")
        return None

    def register_agent(
        self,
        session_id: str,
        agent: 'ChatAgent',
        organization_id: int,
        user_id: str,
        restored_from_history: bool = False,
        history_message_count: int = 0,
        workspace_path: Optional[Path] = None,
        workspace_id: Optional[str] = None,
        workspace_prefix: Optional[str] = None,
    ):
        """
        Register new agent in session manager.

        Args:
            session_id: Unique session identifier
            agent: ToolCallingAgent instance
            organization_id: Organization ID (for multi-tenant isolation)
            user_id: User ID
            restored_from_history: Whether agent was restored from history
            history_message_count: Number of messages restored from history
            workspace_path: Local path to extracted workspace
            workspace_id: ID for S3 (user_id or agent_id)
            workspace_prefix: S3 prefix ("workspaces/users" or "workspaces/agents")
        """
        self.agents[session_id] = agent
        self.metadata[session_id] = SessionMetadata(
            session_id=session_id,
            organization_id=organization_id,
            user_id=user_id,
            created_at=datetime.now(),
            last_activity=datetime.now(),
            message_count=1,
            restored_from_history=restored_from_history,
            history_message_count=history_message_count,
            workspace_path=workspace_path,
            workspace_id=workspace_id,
            workspace_prefix=workspace_prefix,
        )

        logger.info(
            f"✨ Created session {session_id} "
            f"(org={organization_id}, user={user_id}, "
            f"restored={restored_from_history}, history_msgs={history_message_count}, "
            f"workspace={'enabled' if workspace_path else 'disabled'})"
        )

    async def restore_agent_from_history(
        self,
        agent: 'ChatAgent',
        conversation_history: List[Any]
    ) -> int:
        """
        Restore agent memory from conversation history.

        Converts database conversation history to simple MemoryStep objects:
        - User messages → MemoryStep(role="user")
        - Assistant messages → MemoryStep(role="assistant")

        AIDEV-NOTE: Using simple MemoryStep instead of smolagents types.
        The DSPy executor handles conversation context differently.

        Args:
            agent: ChatAgent to restore memory into
            conversation_history: List of HistoryMessage protobuf objects

        Returns:
            Number of messages restored
        """
        from ..grpc.agents.agent_models import MemoryStep

        restored_count = 0

        for i, msg in enumerate(conversation_history):
            # Extract text content from MessagePart array
            # HistoryMessage has content_parts (list of MessagePart), not content (string)
            text_content = self._extract_text_from_content_parts(msg.content_parts)

            logger.info(f"📚 [RESTORE-DEBUG] Message {i}: role={msg.role}, text_length={len(text_content)}, preview={text_content[:50]}...")

            # Create simple MemoryStep for both user and assistant messages
            step = MemoryStep(
                role=msg.role,
                content=text_content,
                step_number=restored_count + 1,
            )
            agent.memory.steps.append(step)
            restored_count += 1
            logger.info(f"✅ [RESTORE-DEBUG] Added MemoryStep ({msg.role}): {text_content[:30]}...")

        if restored_count > 0:
            logger.info(f"📚 Restored {restored_count} messages to agent memory (user + assistant)")

        return restored_count

    def _extract_text_from_content_parts(self, content_parts: List[Any]) -> str:
        """
        Extract text content from protobuf MessagePart array.

        Args:
            content_parts: List of MessagePart protobuf objects

        Returns:
            Combined text string
        """
        text_parts = []

        for part in content_parts:
            if part.HasField('text'):
                text_parts.append(part.text.text)
            # TODO: Handle images in future - for now just extract text

        return " ".join(text_parts).strip() if text_parts else ""

    def extract_file_attachments_from_history(
        self,
        conversation_history: List[Any]
    ) -> List[Any]:
        """
        Extract file attachments from conversation history content_parts.

        Used during cold-path session restoration to make files from previous
        messages available to skills.

        NOTE: URLs may be expired for old chats (presigned URLs last 1 hour).
        Next.js should regenerate URLs before sending history for best results.

        Args:
            conversation_history: List of HistoryMessage protobuf objects

        Returns:
            List of FileAttachment protobuf objects
        """
        from ..grpc.generated import agent_worker_pb2

        attachments = []
        seen_urls = set()  # Avoid duplicates

        for msg in conversation_history:
            if not hasattr(msg, 'content_parts'):
                continue

            for part in msg.content_parts:
                if part.HasField('file'):
                    url = part.file.url
                    if url and url not in seen_urls:
                        attachment = agent_worker_pb2.FileAttachment(
                            url=url,
                            mime_type=part.file.mime_type if hasattr(part.file, 'mime_type') else ''
                        )
                        attachments.append(attachment)
                        seen_urls.add(url)

        if attachments:
            logger.info(f"📎 Extracted {len(attachments)} file attachments from history")

        return attachments

    async def remove_session(self, session_id: str, reason: str = "explicit"):
        """
        Remove session and cleanup resources.

        Args:
            session_id: Session to remove
            reason: Reason for removal (for logging)
        """
        async with self._get_lock(session_id):
            if session_id in self.agents:
                del self.agents[session_id]
            if session_id in self.metadata:
                meta = self.metadata[session_id]
                logger.info(
                    f"🗑️  Removed session {session_id} "
                    f"(reason: {reason}, msgs: {meta.message_count})"
                )
                del self.metadata[session_id]
            if session_id in self.state_machines:
                del self.state_machines[session_id]
            if session_id in self.locks:
                del self.locks[session_id]

    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session metadata (for debugging/monitoring).

        Args:
            session_id: Session identifier

        Returns:
            Dictionary with session metadata or None if not found
        """
        if session_id not in self.metadata:
            return None

        meta = self.metadata[session_id]
        agent = self.agents.get(session_id)

        return {
            "session_id": session_id,
            "organization_id": meta.organization_id,
            "user_id": meta.user_id,
            "created_at": meta.created_at.isoformat(),
            "last_activity": meta.last_activity.isoformat(),
            "message_count": meta.message_count,
            "restored_from_history": meta.restored_from_history,
            "history_message_count": meta.history_message_count,
            "memory_steps": len(agent.memory.steps) if agent else 0,
            "idle_time_seconds": (datetime.now() - meta.last_activity).total_seconds(),
            "lifetime_seconds": (datetime.now() - meta.created_at).total_seconds(),
            "consecutive_errors": meta.consecutive_errors,
            "last_error_type": meta.last_error_type,
            "last_error_timestamp": meta.last_error_timestamp.isoformat() if meta.last_error_timestamp else None
        }

    def list_active_sessions(self) -> List[Dict[str, Any]]:
        """
        List all active sessions (for monitoring).

        Returns:
            List of session metadata dictionaries
        """
        return [
            self.get_session_info(sid)
            for sid in list(self.metadata.keys())
        ]

    # ============================================================
    # Attachment Management Methods
    # ============================================================

    def add_attachments(self, session_id: str, attachments: List[Any]) -> None:
        """
        Add file attachments to session storage.

        Attachments persist across messages in the same session, allowing skills
        to access files uploaded in previous messages.

        Args:
            session_id: Session identifier
            attachments: List of FileAttachment protobuf objects
        """
        if session_id not in self.metadata:
            logger.warning(f"Cannot add attachments - session {session_id} not found")
            return

        for att in attachments:
            # Avoid duplicates by URL
            existing_urls = {a.url for a in self.metadata[session_id].attachments}
            if att.url not in existing_urls:
                self.metadata[session_id].attachments.append(att)

        logger.info(
            f"📎 Session {session_id}: {len(self.metadata[session_id].attachments)} total attachments"
        )

    def get_attachments(self, session_id: str) -> List[Any]:
        """
        Get all file attachments for session.

        Returns attachments from all messages in the session.

        Args:
            session_id: Session identifier

        Returns:
            List of FileAttachment protobuf objects
        """
        if session_id in self.metadata:
            return self.metadata[session_id].attachments
        return []

    # ============================================================
    # Error Management Methods
    # ============================================================

    def reset_agent_memory(self, session_id: str) -> bool:
        """
        Clear agent memory for soft reset after recoverable errors.

        Used for RECOVERABLE errors where we want to keep the session
        but clear the corrupted agent state.

        Args:
            session_id: Session to reset

        Returns:
            True if agent memory was reset, False if session not found
        """
        if session_id not in self.agents:
            logger.warning(f"Cannot reset memory - session {session_id} not found")
            return False

        agent = self.agents[session_id]

        # Clear agent memory steps (removes corrupted state)
        agent.memory.steps.clear()

        logger.info(f"🔄 Reset agent memory for session {session_id}")
        return True

    def increment_error_count(self, session_id: str, error_type: str) -> int:
        """
        Increment error count for session and track error type.

        Args:
            session_id: Session identifier
            error_type: Type of error that occurred

        Returns:
            Current consecutive error count after increment
        """
        if session_id not in self.metadata:
            logger.warning(f"Cannot increment error count - session {session_id} not found")
            return 0

        meta = self.metadata[session_id]
        meta.consecutive_errors += 1
        meta.last_error_type = error_type
        meta.last_error_timestamp = datetime.now()

        logger.warning(
            f"⚠️  Session {session_id} error count: {meta.consecutive_errors} "
            f"(last error: {error_type})"
        )

        return meta.consecutive_errors

    def reset_error_count(self, session_id: str):
        """
        Reset error count after successful message processing.

        Should be called after successful agent execution to clear error state.

        Args:
            session_id: Session identifier
        """
        if session_id not in self.metadata:
            return

        meta = self.metadata[session_id]
        if meta.consecutive_errors > 0:
            logger.info(f"✅ Clearing error count for session {session_id}")
            meta.consecutive_errors = 0
            meta.last_error_type = None
            meta.last_error_timestamp = None

    def should_remove_session_on_error(self, session_id: str, threshold: int = 5) -> bool:
        """
        Check if session should be removed due to excessive errors.

        Args:
            session_id: Session identifier
            threshold: Maximum consecutive errors before removal (default: 5)

        Returns:
            True if session should be removed
        """
        if session_id not in self.metadata:
            return False

        meta = self.metadata[session_id]
        should_remove = meta.consecutive_errors >= threshold

        if should_remove:
            logger.warning(
                f"🚨 Session {session_id} exceeded error threshold "
                f"({meta.consecutive_errors} >= {threshold})"
            )

        return should_remove

    async def remove_session_on_error(self, session_id: str, error_type: str):
        """
        Remove session due to fatal error or error threshold.

        Wrapper around remove_session() with error-specific logging.

        Args:
            session_id: Session to remove
            error_type: Error type that triggered removal
        """
        reason = f"fatal_error:{error_type}"
        await self.remove_session(session_id, reason)

    # ============================================================
    # State Machine Methods (Unified coordinator state)
    # ============================================================

    def get_state_machine(self, session_id: str) -> Optional[CoordinatorStateMachine]:
        """
        Get existing state machine for session.

        Args:
            session_id: Session identifier

        Returns:
            CoordinatorStateMachine if exists, None otherwise
        """
        return self.state_machines.get(session_id)

    def get_or_create_state_machine(self, session_id: str) -> CoordinatorStateMachine:
        """
        Get or create state machine for session.

        Creates a new state machine in IDLE phase if one doesn't exist.

        Args:
            session_id: Session identifier

        Returns:
            CoordinatorStateMachine (existing or newly created)
        """
        if session_id not in self.state_machines:
            self.state_machines[session_id] = CoordinatorStateMachine(session_id)
            logger.info(f"📊 Created state machine for session {session_id}")
        return self.state_machines[session_id]

    # ============================================================
    # Plan Generation Session Methods (for HITL question/answer flow)
    # ============================================================

    async def store_plan_session(self, session_id: str, context: Dict[str, Any]) -> None:
        """
        Store plan generation session context for later resume.

        Used when plan generation pauses to ask clarification questions.
        The context is stored so generation can resume after user answers.

        Args:
            session_id: Unique session identifier for the plan generation
            context: Session context including instructions, partial state, etc.
        """
        context["stored_at"] = datetime.now().isoformat()
        self._plan_sessions[session_id] = context
        logger.info(f"📋 Stored plan session {session_id} for resume")

    async def get_plan_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get stored plan generation session context.

        Args:
            session_id: Session identifier

        Returns:
            Session context dict if found, None otherwise
        """
        context = self._plan_sessions.get(session_id)
        if context:
            logger.info(f"📋 Retrieved plan session {session_id}")
        else:
            logger.warning(f"📋 Plan session {session_id} not found (may have expired)")
        return context

    async def remove_plan_session(self, session_id: str) -> None:
        """
        Remove plan generation session after completion or timeout.

        Args:
            session_id: Session identifier to remove
        """
        if session_id in self._plan_sessions:
            del self._plan_sessions[session_id]
            logger.info(f"📋 Removed plan session {session_id}")


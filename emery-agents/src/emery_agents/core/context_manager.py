"""
Context management system for multi-step agent execution.
Handles persistence of execution context between smolagents .run() calls.
"""

import json
import os
import tempfile
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from .types import Task, ExecutionContext, Agent

logger = logging.getLogger(__name__)


class ExecutionContextManager:
    """
    Manages execution context persistence between agent steps.
    
    Each execution gets a temporary working directory with:
    - context.json: Current execution variables and state
    - step_outputs/: Individual step output files
    - step_{id}_context.json: Step-specific context snapshots
    - execution_log.json: Execution progress log
    """
    
    def __init__(self, task: Task, agent: Agent):
        self.task = task
        self.agent = agent
        # Create execution context
        from .types import CapabilityConfig  # Avoid circular import
        capability = None
        for cap in agent.capabilities:
            if cap.name == task.capabilityName:
                capability = cap
                break
        self.context = ExecutionContext(
            agent=agent,
            task=task,
            capability=capability
        )
        self.base_dir = None
        self.context_file = None
        self.step_outputs_dir = None
        self.execution_log_file = None
        
        # Initialize working directory
        self._setup_working_directory()
        
        logger.info(f"Context manager initialized for task execution {self.task.id}")
    
    def _setup_working_directory(self):
        """Create temporary working directory for this execution."""
        # Create base temp directory
        self.base_dir = Path(tempfile.mkdtemp(
            prefix=f"emery_agent_{self.agent.id}_{self.task.id}_"
        ))
        
        # Create subdirectories
        self.step_outputs_dir = self.base_dir / "step_outputs"
        self.step_outputs_dir.mkdir(exist_ok=True)
        
        # Define file paths
        self.context_file = self.base_dir / "context.json"
        self.execution_log_file = self.base_dir / "execution_log.json"
        
        # Initialize context file with task execution data
        initial_context = {
            "execution_id": self.task.id,
            "agent_id": self.agent.id,
            "capability_name": self.task.capabilityName,
            "started_at": self.task.startedAt.isoformat() if self.task.startedAt else None,
            "variables": self.task.payload.copy(),
            "step_outputs": {},
            "current_step": None,
            "completed_steps": []
        }
        
        self._write_context(initial_context)
        
        # Initialize execution log
        initial_log = {
            "execution_id": self.task.id,
            "agent_name": self.agent.name,
            "capability_name": self.task.capabilityName,
            "started_at": datetime.now().isoformat(),
            "steps": [],
            "status": "in_progress"
        }
        
        self._write_execution_log(initial_log)
        
        logger.info(f"Working directory created: {self.base_dir}")
    
    def get_context(self) -> Dict[str, Any]:
        """
        Read current execution context from disk.
        
        Returns:
            Dict with current execution context
        """
        try:
            with open(self.context_file, 'r') as f:
                context = json.load(f)
            
            logger.debug(f"Context loaded: {len(context.get('variables', {}))} variables")
            return context
            
        except FileNotFoundError:
            logger.error(f"Context file not found: {self.context_file}")
            return {"variables": {}, "step_outputs": {}}
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode context file: {e}")
            return {"variables": {}, "step_outputs": {}}
    
    def update_context(self, updates: Dict[str, Any]) -> None:
        """
        Update execution context and save to disk.
        
        Args:
            updates: Dictionary of updates to merge into context
        """
        context = self.get_context()
        
        # Deep merge updates
        for key, value in updates.items():
            if key == "variables" and isinstance(value, dict):
                context.setdefault("variables", {}).update(value)
            elif key == "step_outputs" and isinstance(value, dict):
                context.setdefault("step_outputs", {}).update(value)
            else:
                context[key] = value
        
        self._write_context(context)
        logger.debug(f"Context updated with keys: {list(updates.keys())}")
    
    def save_step_output(self, step_id: str, output_data: Dict[str, Any]) -> None:
        """
        Save output from a specific step.
        
        Args:
            step_id: ID of the step
            output_data: Data produced by the step
        """
        # Save to step-specific file
        step_file = self.step_outputs_dir / f"{step_id}.json"
        with open(step_file, 'w') as f:
            json.dump({
                "step_id": step_id,
                "timestamp": datetime.now().isoformat(),
                "output_data": output_data
            }, f, indent=2)
        
        # Update main context
        self.update_context({
            "step_outputs": {step_id: output_data},
            "variables": output_data  # Merge step outputs into variables
        })
        
        logger.info(f"Step output saved: {step_id}")
    
    def get_step_context_for_smolagents(self, step_id: str) -> Dict[str, Any]:
        """
        Get context formatted for smolagents .run() call.
        
        Args:
            step_id: Current step ID
            
        Returns:
            Dict with variables and previous step outputs formatted for smolagents
        """
        context = self.get_context()
        
        # Prepare context for smolagents
        smolagents_context = {
            # Current variables (includes previous step outputs)
            **context.get("variables", {}),
            
            # Execution metadata
            "execution_id": self.task.id,
            "agent_id": self.agent.id,
            "capability_name": self.task.capabilityName,
            "current_step": step_id,
            
            # Previous step outputs (if agents need specific access)
            "previous_steps": context.get("step_outputs", {}),
            
            # Completed steps list
            "completed_steps": context.get("completed_steps", [])
        }
        
        logger.debug(f"Context prepared for step {step_id}: {len(smolagents_context)} items")
        return smolagents_context
    
    def mark_step_completed(self, step_id: str) -> None:
        """Mark a step as completed in the context."""
        context = self.get_context()
        completed_steps = context.get("completed_steps", [])
        
        if step_id not in completed_steps:
            completed_steps.append(step_id)
            
        self.update_context({
            "completed_steps": completed_steps,
            "current_step": None
        })
        
        # Log step completion
        self._log_step_event(step_id, "completed")
    
    def mark_step_started(self, step_id: str) -> None:
        """Mark a step as started in the context."""
        self.update_context({
            "current_step": step_id
        })
        
        # Log step start
        self._log_step_event(step_id, "started")
    
    def _write_context(self, context: Dict[str, Any]) -> None:
        """Write context to disk."""
        with open(self.context_file, 'w') as f:
            json.dump(context, f, indent=2)
    
    def _write_execution_log(self, log_data: Dict[str, Any]) -> None:
        """Write execution log to disk."""
        with open(self.execution_log_file, 'w') as f:
            json.dump(log_data, f, indent=2)
    
    def _log_step_event(self, step_id: str, event: str) -> None:
        """Log a step event to the execution log."""
        try:
            with open(self.execution_log_file, 'r') as f:
                log_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            log_data = {"steps": []}
        
        log_data["steps"].append({
            "step_id": step_id,
            "event": event,
            "timestamp": datetime.now().isoformat()
        })
        
        self._write_execution_log(log_data)
    
    def get_working_directory(self) -> Path:
        """Get the working directory path for this execution."""
        return self.base_dir
    
    def cleanup(self) -> None:
        """Clean up temporary files and directories."""
        if self.base_dir and self.base_dir.exists():
            try:
                shutil.rmtree(self.base_dir)
                logger.info(f"Cleaned up working directory: {self.base_dir}")
            except Exception as e:
                logger.error(f"Failed to cleanup working directory: {e}")
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit with cleanup."""
        self.cleanup()


# AIDEV-NOTE: This provides persistent context between smolagents .run() calls
# AIDEV-TODO: Add context compression for large step outputs
# AIDEV-TODO: Implement context encryption for sensitive data
# AIDEV-QUESTION: Should we support context sharing between parallel step executions?
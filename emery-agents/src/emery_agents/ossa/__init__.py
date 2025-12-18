"""
OSSA Agent Registry

Static registry of agent definitions following OSSA v0.2.9 specification.
Provides loading, validation, and lookup of agent manifests.

This replaces implicit agent definitions in code with declarative OSSA manifests.
"""

import logging
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class OSSAAgentManifest:
    """OSSA Agent manifest with validation and metadata."""
    
    # Core OSSA fields
    api_version: str
    kind: str  # Should be "Agent"
    metadata: Dict[str, Any]
    spec: Dict[str, Any]
    
    # Runtime properties
    file_path: str
    raw_content: str
    
    def __post_init__(self):
        """Validate the manifest follows OSSA schema."""
        if self.kind != "Agent":
            raise ValueError(f"Invalid kind: {self.kind}. Expected 'Agent'")
        
        if not self.api_version.startswith("ossa/"):
            raise ValueError(f"Invalid apiVersion: {self.api_version}. Expected 'ossa/vX.Y.Z'")
    
    @property
    def name(self) -> str:
        """Get agent name from metadata."""
        return self.metadata.get("name", "unnamed")
    
    @property
    def capabilities(self) -> List[Dict[str, Any]]:
        """Get agent capabilities from spec."""
        return self.spec.get("capabilities", [])
    
    @property
    def tools(self) -> List[Dict[str, Any]]:
        """Get agent tools from spec."""
        return self.spec.get("tools", [])
    
    @property
    def execution_mode(self) -> str:
        """Get execution mode from spec."""
        return self.spec.get("execution", {}).get("mode", "autonomous")
    
    def can_handle_domain(self, domain: str) -> bool:
        """Check if agent can handle specific domain."""
        labels = self.metadata.get("labels", {})
        return labels.get("domain") == domain
    
    def can_handle_task_type(self, task_type: str) -> bool:
        """Check if agent can handle specific task type."""
        capabilities = self.capabilities
        return any(cap.get("name") == task_type for cap in capabilities)


class OSSAAgentRegistry:
    """
    Registry for loading and managing OSSA agent manifests.
    
    This provides the static agent definitions that drive routing decisions.
    """
    
    def __init__(self, registry_dir: Optional[Path] = None):
        """
        Initialize the registry.
        
        Args:
            registry_dir: Directory containing OSSA agent manifests
        """
        self.registry_dir = registry_dir or Path(__file__).parent.parent / "agents" / "registry"
        self._agents: Dict[str, OSSAAgentManifest] = {}
        self._domain_index: Dict[str, List[str]] = {}
        self._capability_index: Dict[str, List[str]] = {}
        
        logger.info(f"📋 OSSA Agent Registry initialized: {self.registry_dir}")
    
    def load_all_agents(self) -> None:
        """Load all agent manifests from registry directory."""
        if not self.registry_dir.exists():
            logger.warning(f"📂 Registry directory not found: {self.registry_dir}")
            return
        
        manifest_files = list(self.registry_dir.glob("*.ossa.yaml")) + list(self.registry_dir.glob("*.ossa.yml"))
        logger.info(f"📂 Found {len(manifest_files)} OSSA manifest files")
        
        for manifest_file in manifest_files:
            try:
                self._load_agent(manifest_file)
            except Exception as e:
                logger.error(f"❌ Failed to load agent manifest {manifest_file}: {e}")
        
        logger.info(f"✅ Loaded {len(self._agents)} agents into registry")
        self._build_indexes()
    
    def _load_agent(self, manifest_file: Path) -> None:
        """Load a single agent manifest."""
        try:
            with open(manifest_file, 'r') as f:
                content = f.read()
                data = yaml.safe_load(content)
            
            manifest = OSSAAgentManifest(
                api_version=data["apiVersion"],
                kind=data["kind"],
                metadata=data["metadata"],
                spec=data["spec"],
                file_path=str(manifest_file),
                raw_content=content
            )
            
            self._agents[manifest.name] = manifest
            logger.debug(f"📋 Loaded agent: {manifest.name} from {manifest_file}")
            
        except KeyError as e:
            raise ValueError(f"Missing required field in {manifest_file}: {e}")
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML in {manifest_file}: {e}")
    
    def _build_indexes(self) -> None:
        """Build lookup indexes for efficient routing."""
        self._domain_index.clear()
        self._capability_index.clear()
        
        for name, manifest in self._agents.items():
            # Domain index
            domain = manifest.metadata.get("labels", {}).get("domain")
            if domain:
                self._domain_index.setdefault(domain, []).append(name)
            
            # Capability index
            for capability in manifest.capabilities:
                cap_name = capability.get("name")
                if cap_name:
                    self._capability_index.setdefault(cap_name, []).append(name)
    
    def get_agent(self, name: str) -> Optional[OSSAAgentManifest]:
        """Get agent manifest by name."""
        return self._agents.get(name)
    
    def find_agents_by_domain(self, domain: str) -> List[OSSAAgentManifest]:
        """Find all agents that handle a specific domain."""
        agent_names = self._domain_index.get(domain, [])
        return [self._agents[name] for name in agent_names]
    
    def find_agents_by_capability(self, capability: str) -> List[OSSAAgentManifest]:
        """Find all agents that have a specific capability."""
        agent_names = self._capability_index.get(capability, [])
        return [self._agents[name] for name in agent_names]
    
    def list_all_agents(self) -> List[OSSAAgentManifest]:
        """List all registered agents."""
        return list(self._agents.values())
    
    def validate_agent_manifest(self, manifest_path: Path) -> bool:
        """Validate an agent manifest against OSSA schema."""
        try:
            with open(manifest_path, 'r') as f:
                data = yaml.safe_load(f)
            
            # Basic structural validation
            required_fields = ["apiVersion", "kind", "metadata", "spec"]
            for field in required_fields:
                if field not in data:
                    logger.error(f"❌ Missing required field: {field}")
                    return False
            
            # Validate kind and apiVersion
            if data["kind"] != "Agent":
                logger.error(f"❌ Invalid kind: {data['kind']}. Expected 'Agent'")
                return False
            
            if not data["apiVersion"].startswith("ossa/"):
                logger.error(f"❌ Invalid apiVersion: {data['apiVersion']}")
                return False
            
            logger.info(f"✅ Agent manifest is valid: {manifest_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Validation failed for {manifest_path}: {e}")
            return False


# Singleton registry instance
_registry: Optional[OSSAAgentRegistry] = None


def get_registry() -> OSSAAgentRegistry:
    """Get the global agent registry instance."""
    global _registry
    if _registry is None:
        _registry = OSSAAgentRegistry()
        _registry.load_all_agents()
    return _registry


def reload_registry() -> OSSAAgentRegistry:
    """Reload the agent registry (useful for development)."""
    global _registry
    _registry = OSSAAgentRegistry()
    _registry.load_all_agents()
    return _registry
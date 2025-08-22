"""
Tests for AgentId Value Object

AIDEV-NOTE: Value object tests focus on validation, immutability, and equality.
"""

import pytest

from src.emery_agents.domain.agents.value_objects.agent_id import AgentId


class TestAgentId:
    """Test AgentId value object validation and behavior."""
    
    def test_create_agent_id_with_valid_value(self):
        """Test creating AgentId with valid integer."""
        agent_id = AgentId(123)
        
        assert agent_id.value == 123
        assert str(agent_id) == "123"
    
    def test_create_agent_id_with_string_numeric(self):
        """Test creating AgentId with string numeric value."""
        agent_id = AgentId("456")
        
        assert agent_id.value == 456
        assert str(agent_id) == "456"
    
    def test_create_agent_id_validates_positive_integer(self):
        """Test AgentId validates positive integers only."""
        # 0 is allowed for new agents
        agent_id = AgentId(0)
        assert agent_id.value == 0
        
        # Negative values are not allowed
        with pytest.raises(ValueError, match="Agent ID must be a positive integer"):
            AgentId(-1)
    
    def test_create_agent_id_validates_integer_type(self):
        """Test AgentId validates integer types."""
        with pytest.raises(ValueError, match="Agent ID must be a positive integer"):
            AgentId("invalid")
        
        with pytest.raises(ValueError, match="Agent ID must be a positive integer"):
            AgentId(12.5)
        
        with pytest.raises(ValueError, match="Agent ID must be a positive integer"):
            AgentId(None)
    
    def test_agent_id_equality(self):
        """Test AgentId equality comparison."""
        agent_id1 = AgentId(123)
        agent_id2 = AgentId(123)
        agent_id3 = AgentId(456)
        
        assert agent_id1 == agent_id2
        assert agent_id1 != agent_id3
        assert agent_id1 != 123  # Different types
    
    def test_agent_id_hash(self):
        """Test AgentId can be used in sets and dictionaries."""
        agent_id1 = AgentId(123)
        agent_id2 = AgentId(123)
        agent_id3 = AgentId(456)
        
        # Same value should have same hash
        assert hash(agent_id1) == hash(agent_id2)
        
        # Can be used in set
        agent_set = {agent_id1, agent_id2, agent_id3}
        assert len(agent_set) == 2  # Only unique values
        
        # Can be used as dict key
        agent_dict = {agent_id1: "agent1", agent_id3: "agent3"}
        assert agent_dict[agent_id2] == "agent1"  # Same as agent_id1
    
    def test_agent_id_repr(self):
        """Test AgentId string representation."""
        agent_id = AgentId(789)
        
        assert repr(agent_id) == "AgentId(789)"
    
    def test_agent_id_is_immutable(self):
        """Test AgentId cannot be modified after creation."""
        agent_id = AgentId(123)
        
        # Should not be able to modify the value
        with pytest.raises(AttributeError):
            agent_id.value = 456
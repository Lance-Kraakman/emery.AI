"""
Tests for TaskId Value Object

AIDEV-NOTE: Tests UUID-based value object validation and generation.
"""

import pytest
import uuid

from src.emery_agents.domain.agents.value_objects.task_id import TaskId


class TestTaskId:
    """Test TaskId value object validation and behavior."""
    
    def test_create_task_id_with_valid_uuid_string(self):
        """Test creating TaskId with valid UUID string."""
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        task_id = TaskId(uuid_str)
        
        assert task_id.value == uuid_str
        assert str(task_id) == uuid_str
    
    def test_create_task_id_with_uuid_object(self):
        """Test creating TaskId with UUID object."""
        uuid_obj = uuid.uuid4()
        task_id = TaskId(uuid_obj)
        
        assert task_id.value == str(uuid_obj)
        assert str(task_id) == str(uuid_obj)
    
    def test_generate_creates_valid_uuid(self):
        """Test TaskId.generate() creates valid UUID."""
        task_id = TaskId.generate()
        
        # Should be valid UUID format
        assert len(task_id.value) == 36
        assert task_id.value.count("-") == 4
        
        # Should be parseable as UUID
        uuid.UUID(task_id.value)
    
    def test_generate_creates_unique_ids(self):
        """Test TaskId.generate() creates unique IDs."""
        task_id1 = TaskId.generate()
        task_id2 = TaskId.generate()
        
        assert task_id1 != task_id2
        assert task_id1.value != task_id2.value
    
    def test_create_task_id_validates_uuid_format(self):
        """Test TaskId validates UUID format."""
        with pytest.raises(ValueError, match="Task ID must be a valid UUID"):
            TaskId("invalid-uuid")
        
        with pytest.raises(ValueError, match="Task ID must be a valid UUID"):
            TaskId("12345")
        
        with pytest.raises(ValueError, match="Task ID must be a valid UUID"):
            TaskId("")
    
    def test_create_task_id_validates_type(self):
        """Test TaskId validates input types."""
        with pytest.raises(ValueError, match="Task ID must be a valid UUID"):
            TaskId(None)
        
        with pytest.raises(ValueError, match="Task ID must be a valid UUID"):
            TaskId(123)
        
        with pytest.raises(ValueError, match="Task ID must be a valid UUID"):
            TaskId([])
    
    def test_task_id_equality(self):
        """Test TaskId equality comparison."""
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        task_id1 = TaskId(uuid_str)
        task_id2 = TaskId(uuid_str)
        task_id3 = TaskId.generate()
        
        assert task_id1 == task_id2
        assert task_id1 != task_id3
        assert task_id1 != uuid_str  # Different types
    
    def test_task_id_hash(self):
        """Test TaskId can be used in sets and dictionaries."""
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        task_id1 = TaskId(uuid_str)
        task_id2 = TaskId(uuid_str)
        task_id3 = TaskId.generate()
        
        # Same value should have same hash
        assert hash(task_id1) == hash(task_id2)
        
        # Can be used in set
        task_set = {task_id1, task_id2, task_id3}
        assert len(task_set) == 2  # Only unique values
        
        # Can be used as dict key
        task_dict = {task_id1: "task1", task_id3: "task3"}
        assert task_dict[task_id2] == "task1"  # Same as task_id1
    
    def test_task_id_repr(self):
        """Test TaskId string representation."""
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        task_id = TaskId(uuid_str)
        
        assert repr(task_id) == f"TaskId({uuid_str})"
    
    def test_task_id_short_id(self):
        """Test TaskId short_id method for display."""
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        task_id = TaskId(uuid_str)
        
        short_id = task_id.short_id()
        assert short_id == "550e8400"
        assert len(short_id) == 8
    
    def test_task_id_is_immutable(self):
        """Test TaskId cannot be modified after creation."""
        task_id = TaskId.generate()
        
        # Should not be able to modify the value
        with pytest.raises(AttributeError):
            task_id.value = "new-value"
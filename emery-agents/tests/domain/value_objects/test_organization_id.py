"""
Tests for OrganizationId Value Object

AIDEV-NOTE: Tests organization identifier validation for multi-tenancy.
"""

import pytest

from src.emery_agents.domain.shared.value_objects.organization_id import OrganizationId


class TestOrganizationId:
    """Test OrganizationId value object validation and behavior."""
    
    def test_create_organization_id_with_valid_value(self):
        """Test creating OrganizationId with valid integer."""
        org_id = OrganizationId(123)
        
        assert org_id.value == 123
        assert str(org_id) == "123"
    
    def test_create_organization_id_with_string_numeric(self):
        """Test creating OrganizationId with string numeric value."""
        org_id = OrganizationId("456")
        
        assert org_id.value == 456
        assert str(org_id) == "456"
    
    def test_create_organization_id_validates_positive_integer(self):
        """Test OrganizationId validates positive integers only."""
        # 0 is allowed for new organizations
        org_id = OrganizationId(0)
        assert org_id.value == 0
        
        # Negative values are not allowed
        with pytest.raises(ValueError, match="Organization ID must be a positive integer"):
            OrganizationId(-1)
    
    def test_create_organization_id_validates_integer_type(self):
        """Test OrganizationId validates integer types."""
        with pytest.raises(ValueError, match="Organization ID must be a positive integer"):
            OrganizationId("invalid")
        
        with pytest.raises(ValueError, match="Organization ID must be a positive integer"):
            OrganizationId(12.5)
        
        with pytest.raises(ValueError, match="Organization ID must be a positive integer"):
            OrganizationId(None)
    
    def test_organization_id_equality(self):
        """Test OrganizationId equality comparison."""
        org_id1 = OrganizationId(123)
        org_id2 = OrganizationId(123)
        org_id3 = OrganizationId(456)
        
        assert org_id1 == org_id2
        assert org_id1 != org_id3
        assert org_id1 != 123  # Different types
    
    def test_organization_id_hash(self):
        """Test OrganizationId can be used in sets and dictionaries."""
        org_id1 = OrganizationId(123)
        org_id2 = OrganizationId(123)
        org_id3 = OrganizationId(456)
        
        # Same value should have same hash
        assert hash(org_id1) == hash(org_id2)
        
        # Can be used in set
        org_set = {org_id1, org_id2, org_id3}
        assert len(org_set) == 2  # Only unique values
        
        # Can be used as dict key
        org_dict = {org_id1: "org1", org_id3: "org3"}
        assert org_dict[org_id2] == "org1"  # Same as org_id1
    
    def test_organization_id_repr(self):
        """Test OrganizationId string representation."""
        org_id = OrganizationId(789)
        
        assert repr(org_id) == "OrganizationId(789)"
    
    def test_organization_id_is_immutable(self):
        """Test OrganizationId cannot be modified after creation."""
        org_id = OrganizationId(123)
        
        # Should not be able to modify the value
        with pytest.raises(AttributeError):
            org_id.value = 456
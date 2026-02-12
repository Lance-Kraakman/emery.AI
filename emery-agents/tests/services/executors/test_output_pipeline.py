"""
Tests for OutputPipeline coercion and extraction logic.

Tests pure deterministic logic - no LLM calls or mocks needed.
"""

import pytest

from emery_agents.reasoning.signatures.extraction import TargetFieldMeta
from emery_agents.services.executors.shared.output_pipeline import OutputPipeline


class TestCoerceValues:
    """Test OutputPipeline.coerce_values() pure logic."""

    def setup_method(self):
        self.pipeline = OutputPipeline()

    def test_coerce_single_select_case_insensitive(self):
        """Single-select coerces to correct case from options."""
        values = {"status": "ACTIVE"}
        metadata = {
            "status": TargetFieldMeta(type="single-select", options=["Active", "Inactive"])
        }

        result = self.pipeline.coerce_values(values, metadata)

        assert result["status"] == "Active"

    def test_coerce_single_select_with_whitespace(self):
        """Single-select handles whitespace in input."""
        values = {"priority": "  high  "}
        metadata = {
            "priority": TargetFieldMeta(type="single-select", options=["High", "Medium", "Low"])
        }

        result = self.pipeline.coerce_values(values, metadata)

        assert result["priority"] == "High"

    def test_coerce_single_select_no_match_returns_none(self):
        """Single-select returns None for unmatched values."""
        values = {"status": "Unknown"}
        metadata = {
            "status": TargetFieldMeta(type="single-select", options=["Active", "Inactive"])
        }

        result = self.pipeline.coerce_values(values, metadata)

        assert result["status"] is None

    def test_coerce_multi_select_list(self):
        """Multi-select coerces each item in list."""
        values = {"tags": ["RED", "blue", "GREEN"]}
        metadata = {
            "tags": TargetFieldMeta(type="multi-select", options=["Red", "Blue", "Green"])
        }

        result = self.pipeline.coerce_values(values, metadata)

        assert result["tags"] == ["Red", "Blue", "Green"]

    def test_coerce_multi_select_filters_invalid(self):
        """Multi-select filters out unmatched items."""
        values = {"tags": ["Red", "Unknown", "Blue"]}
        metadata = {
            "tags": TargetFieldMeta(type="multi-select", options=["Red", "Blue", "Green"])
        }

        result = self.pipeline.coerce_values(values, metadata)

        assert result["tags"] == ["Red", "Blue"]

    def test_coerce_multi_select_non_list_passthrough(self):
        """Multi-select passes through non-list values unchanged."""
        values = {"tags": "SingleValue"}
        metadata = {
            "tags": TargetFieldMeta(type="multi-select", options=["Red", "Blue"])
        }

        result = self.pipeline.coerce_values(values, metadata)

        assert result["tags"] == "SingleValue"

    def test_coerce_boolean_string_true(self):
        """Boolean coerces truthy strings to True."""
        for truthy in ["true", "TRUE", "True", "yes", "YES", "1"]:
            values = {"active": truthy}
            metadata = {"active": TargetFieldMeta(type="boolean")}

            result = self.pipeline.coerce_values(values, metadata)

            assert result["active"] is True, f"Failed for: {truthy}"

    def test_coerce_boolean_string_false(self):
        """Boolean coerces other strings to False."""
        for falsy in ["false", "FALSE", "no", "0", "anything"]:
            values = {"active": falsy}
            metadata = {"active": TargetFieldMeta(type="boolean")}

            result = self.pipeline.coerce_values(values, metadata)

            assert result["active"] is False, f"Failed for: {falsy}"

    def test_coerce_boolean_non_string(self):
        """Boolean coerces non-strings using bool()."""
        values = {"active": 1}
        metadata = {"active": TargetFieldMeta(type="boolean")}

        result = self.pipeline.coerce_values(values, metadata)

        assert result["active"] is True

    def test_coerce_passthrough_unknown_type(self):
        """Unknown types pass through unchanged."""
        values = {"description": "Some text"}
        metadata = {"description": TargetFieldMeta(type="text")}

        result = self.pipeline.coerce_values(values, metadata)

        assert result["description"] == "Some text"

    def test_coerce_passthrough_no_metadata(self):
        """Values without metadata pass through unchanged."""
        values = {"name": "Test", "age": 25}
        metadata = {"name": TargetFieldMeta(type="text")}

        result = self.pipeline.coerce_values(values, metadata)

        assert result["name"] == "Test"
        assert result["age"] == 25

    def test_coerce_preserves_none_values(self):
        """None values remain None."""
        values = {"status": None}
        metadata = {
            "status": TargetFieldMeta(type="single-select", options=["A", "B"])
        }

        result = self.pipeline.coerce_values(values, metadata)

        assert result["status"] is None

    def test_coerce_empty_values_returns_empty(self):
        """Empty values dict returns empty dict."""
        result = self.pipeline.coerce_values({}, {"field": TargetFieldMeta()})
        assert result == {}

    def test_coerce_empty_metadata_returns_values(self):
        """Empty metadata returns values unchanged."""
        values = {"field": "value"}
        result = self.pipeline.coerce_values(values, {})
        assert result == values


class TestCheckExtractionSuccess:
    """Test OutputPipeline.check_extraction_success() logic."""

    def setup_method(self):
        self.pipeline = OutputPipeline()

    def test_extraction_success_with_values(self):
        """Returns True when at least one value is not None."""
        extracted = {"field1": "value", "field2": None}

        result = self.pipeline.check_extraction_success(extracted)

        assert result is True

    def test_extraction_failure_all_none(self):
        """Returns False when all values are None."""
        extracted = {"field1": None, "field2": None, "field3": None}

        result = self.pipeline.check_extraction_success(extracted)

        assert result is False

    def test_extraction_failure_empty_dict(self):
        """Returns False for empty dict."""
        result = self.pipeline.check_extraction_success({})

        assert result is False

    def test_extraction_success_single_value(self):
        """Returns True for single non-None value."""
        extracted = {"only_field": "data"}

        result = self.pipeline.check_extraction_success(extracted)

        assert result is True

    def test_extraction_success_with_falsy_value(self):
        """Returns True for falsy but non-None values (0, '', [])."""
        for falsy in [0, "", [], False]:
            extracted = {"field": falsy}

            result = self.pipeline.check_extraction_success(extracted)

            assert result is True, f"Failed for falsy value: {repr(falsy)}"

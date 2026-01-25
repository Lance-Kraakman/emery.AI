"""
DSPy Signatures for specialized agents.

These signatures define typed I/O contracts for schema building, skill building,
and app building operations.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

import dspy
from pydantic import BaseModel, Field


# ============== FIELD TYPES ==============


class FieldType(str, Enum):
    """Valid field types for database tables."""

    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    CHECKBOX = "checkbox"
    SELECT = "select"
    RELATION = "relation"
    LOOKUP = "lookup"
    FORMULA = "formula"
    EMAIL = "email"
    URL = "url"
    ATTACHMENT = "attachment"


class SelectOption(BaseModel):
    """Option for select fields."""

    value: str = Field(description="Internal value")
    label: str = Field(description="Display label")
    color: Optional[str] = Field(default=None, description="Optional color for the option")


class RelationConfig(BaseModel):
    """Configuration for relation fields."""

    target_table: str = Field(description="Name of the table to relate to")
    target_field: str = Field(default="id", description="Field in target table to reference")
    relationship_type: Literal["one_to_one", "one_to_many", "many_to_many"] = Field(
        default="one_to_many", description="Type of relationship"
    )


class FieldDefinition(BaseModel):
    """Complete field definition with all options."""

    name: str = Field(description="Field name (snake_case)")
    field_type: FieldType = Field(description="Type of field")
    display_name: Optional[str] = Field(
        default=None, description="Human-readable name for display"
    )
    required: bool = Field(default=False, description="Whether the field is required")
    default_value: Optional[str] = Field(
        default=None, description="Default value for the field"
    )
    description: Optional[str] = Field(
        default=None, description="Description of the field's purpose"
    )

    # Type-specific options
    select_options: Optional[list[SelectOption]] = Field(
        default=None, description="Options for SELECT type fields"
    )
    relation_config: Optional[RelationConfig] = Field(
        default=None, description="Configuration for RELATION type fields"
    )
    formula_expression: Optional[str] = Field(
        default=None, description="Expression for FORMULA type fields"
    )
    lookup_field: Optional[str] = Field(
        default=None, description="Source field for LOOKUP type fields"
    )


class TableSchema(BaseModel):
    """Complete table schema definition."""

    name: str = Field(description="Table name (snake_case)")
    display_name: str = Field(description="Human-readable name")
    description: Optional[str] = Field(
        default=None, description="Description of the table's purpose"
    )
    fields: list[FieldDefinition] = Field(description="List of field definitions")
    primary_key: str = Field(default="id", description="Primary key field name")


class ExistingTable(BaseModel):
    """Summary of an existing table for context."""

    id: str = Field(description="Table ID")
    name: str = Field(description="Table name")
    display_name: str = Field(description="Human-readable name")
    field_count: int = Field(description="Number of fields")
    field_names: list[str] = Field(description="List of field names")


class BuildSchema(dspy.Signature):  # type: ignore[misc]
    """Create database table schema from requirements.

    Valid field types: text, number, date, checkbox, select, relation, lookup, formula.
    Always verify existing tables before creating new ones.
    Use relations to connect related data.
    Follow naming conventions: snake_case for names, Title Case for display names.
    """

    requirements: str = dspy.InputField(desc="Description of what the table should store")
    existing_tables: list[ExistingTable] = dspy.InputField(
        desc="Existing tables in the workspace"
    )
    workspace_patterns: str = dspy.InputField(
        desc="Common patterns and conventions in this workspace"
    )

    schema: TableSchema = dspy.OutputField()


# ============== SKILL TYPES ==============


class SkillInputField(BaseModel):
    """Input field for a skill."""

    name: str = Field(description="Input field name")
    field_type: str = Field(description="Type of input (text, number, date, etc.)")
    required: bool = Field(default=True, description="Whether input is required")
    description: Optional[str] = Field(default=None, description="Description of the input")
    default_value: Optional[str] = Field(default=None, description="Default value if any")


class SkillOutputField(BaseModel):
    """Output field for a skill."""

    name: str = Field(description="Output field name")
    field_type: str = Field(description="Type of output")
    description: Optional[str] = Field(default=None, description="Description of the output")


class ToolParameter(BaseModel):
    """Parameter for a tool call within a skill."""

    name: str = Field(description="Parameter name")
    value: str = Field(description="Parameter value (can reference inputs with {{input_name}})")


class SkillStep(BaseModel):
    """Single step in a skill workflow."""

    step_id: str = Field(description="Unique step identifier")
    action: str = Field(description="What this step does")
    tool: str = Field(description="Tool to use (e.g., 'gmail:send_email')")
    parameters: list[ToolParameter] = Field(description="Parameters for the tool")
    condition: Optional[str] = Field(
        default=None, description="Optional condition for execution"
    )


class SkillDefinition(BaseModel):
    """Complete skill definition."""

    name: str = Field(description="Skill name")
    description: str = Field(description="What the skill does")
    trigger: str = Field(description="What triggers this skill")
    inputs: list[SkillInputField] = Field(description="Input fields")
    steps: list[SkillStep] = Field(description="Steps to execute")
    outputs: list[SkillOutputField] = Field(description="Output fields")


class ExistingSkill(BaseModel):
    """Summary of an existing skill for context."""

    id: str = Field(description="Skill ID")
    name: str = Field(description="Skill name")
    description: str = Field(description="Skill description")
    trigger: str = Field(description="Skill trigger")


class BuildSkill(dspy.Signature):  # type: ignore[misc]
    """Build automation skill from specification.

    Skills automate repetitive tasks by chaining tool calls.
    Use available integrations for external services.
    Reference inputs in parameters using {{input_name}} syntax.
    """

    spec: str = dspy.InputField(desc="Specification of what the skill should do")
    available_integrations: list[str] = dspy.InputField(
        desc="Available integrations (e.g., 'gmail', 'slack', 'notion')"
    )
    existing_skills: list[ExistingSkill] = dspy.InputField(
        desc="Existing skills in the workspace"
    )

    skill: SkillDefinition = dspy.OutputField()


# ============== APP TYPES ==============


class PageComponent(BaseModel):
    """Component on an app page."""

    component_type: str = Field(
        description="Type: table_view, form, chart, text, button, etc."
    )
    config: dict[str, str] = Field(description="Component-specific configuration")
    position: int = Field(description="Position/order on the page")


class AppPage(BaseModel):
    """Page in an application."""

    page_id: str = Field(description="Unique page identifier")
    name: str = Field(description="Page name")
    route: str = Field(description="URL route (e.g., '/dashboard')")
    icon: Optional[str] = Field(default=None, description="Icon for the page")
    components: list[PageComponent] = Field(description="Components on this page")


class AppDefinition(BaseModel):
    """Complete application definition."""

    name: str = Field(description="Application name")
    description: str = Field(description="What the app does")
    icon: Optional[str] = Field(default=None, description="App icon")
    pages: list[AppPage] = Field(description="Pages in the app")
    home_page: str = Field(description="page_id of the home page")
    database_id: Optional[str] = Field(
        default=None, description="Associated database ID"
    )


class BuildApp(dspy.Signature):  # type: ignore[misc]
    """Build application from specification.

    Apps provide user interfaces for interacting with data.
    Reference existing tables for data display and forms.
    Use appropriate component types for different data interactions.
    """

    spec: str = dspy.InputField(desc="Specification of what the app should do")
    existing_tables: list[ExistingTable] = dspy.InputField(
        desc="Existing tables to reference"
    )
    existing_apps: list[str] = dspy.InputField(desc="Names of existing apps")

    app: AppDefinition = dspy.OutputField()

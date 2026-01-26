"""
Planning guidance for document_builder capability.

This replaces prompts/capabilities/document_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Document Builder (agent:document_builder)

**Choose when**: User needs rich-text documents, templates, or content.
**Examples**: "create a proposal", "draft a contract", "write meeting notes"

### What document_builder Creates

- Documents with structured content (headings, paragraphs, lists)
- Documents linked to table records

### Before Creating a Document

Ensure you have:
- Document title/purpose
- Target table and field where document is stored
- Content structure (sections, formatting needs)

### Step Format Examples

- "Create document 'Project Proposal' in 'proposals' table, field 'content'"
- "Update document in record ID 42, 'notes' field with meeting summary"
- "Create document template for 'Client Onboarding' with sections: Introduction, Services, Next Steps"

### Document Features

- Rich text formatting (bold, italic, lists)
- Headings and sections
- Tables and embedded content
- Linked to table records via field
"""

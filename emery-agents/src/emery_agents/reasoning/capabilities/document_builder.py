"""
Planning guidance for document_builder capability.

This replaces prompts/capabilities/document_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Document Builder (agent:document_builder)

**Choose when**: User needs rich-text documents, templates, or content.
**Examples**: "create a proposal", "draft a contract", "write meeting notes"

### Tools Used by This Capability
The executor uses: **document_crud**.
- document_crud: Create/list/get/update/delete documents
Set tool_call="document_crud".

### Document Features

- Rich text formatting (bold, italic, lists)
- Headings and sections
- Tables and embedded content
- Linked to table records via field

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every document_builder step description:
1. **DOCUMENT TITLE**: Exact title in quotes
2. **LOCATION**: Target table name and field where document is stored (or standalone)
3. **CONTENT STRUCTURE**: Sections, headings, what each section contains
4. **OUTCOME**: What the executor should verify

**Step description templates:**

Create document linked to table:
"Create document '[title]' in table '[table_name]', field '[field_name]'. Sections: [Section1] ([content description]), [Section2] ([content description]). Verify: document exists with [N] sections."

Create standalone document:
"Create document '[title]' with sections: [Section1], [Section2], [Section3]. Verify: document exists."

BAD: "Create a proposal document"
GOOD: "Create document 'Project Proposal' in table 'proposals', field 'content'. Sections: Introduction (project overview), Scope (deliverables and timeline), Pricing (cost breakdown). Verify: document exists with 3 sections."
"""

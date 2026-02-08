#!/usr/bin/env python3
"""
Create sample knowledge base for testing.

Uses hardcoded sample items - no external dataset required.
Run this to create a local knowledge base for development/testing.

Usage:
    python scripts/ingest_sample.py
"""
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import dspy

from emery_agents.knowledge import KnowledgeBase, KnowledgeItem
from emery_agents.knowledge.base import KnowledgeDomain, KnowledgeType
from emery_agents.knowledge.cache import save_knowledge_local

SAMPLE_ITEMS = [
    # Patterns - Business
    KnowledgeItem(
        id="pattern:crm_org",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.BUSINESS,
        title="CRM Organization Structure",
        content="""Standard CRM org structure:
- Sales Rep agents (lead management)
- Account Manager agents (client relationships)
- Support agents (issue resolution)

Tables: leads, contacts, accounts, opportunities, cases""",
        tags=["crm", "sales", "organization"],
    ),
    KnowledgeItem(
        id="pattern:consulting_firm",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.BUSINESS,
        title="Consulting Firm Organization",
        content="""Consulting firm structure:
- Partners (business development, client relationships)
- Project Managers (delivery, coordination)
- Consultants (execution, analysis)
- Analysts (research, support)

Tables: clients, projects, engagements, deliverables, timesheets""",
        tags=["consulting", "professional-services", "organization"],
    ),
    # Patterns - Workflow
    KnowledgeItem(
        id="pattern:ecommerce_workflow",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.WORKFLOW,
        title="E-commerce Order Workflow",
        content="""Order processing workflow:
1. Order placed → validate inventory
2. Payment processed → update status
3. Fulfillment → shipping notification
4. Delivery → request review""",
        tags=["ecommerce", "orders", "fulfillment"],
    ),
    KnowledgeItem(
        id="pattern:support_ticket_workflow",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.WORKFLOW,
        title="Support Ticket Workflow",
        content="""Support ticket lifecycle:
1. Ticket created → auto-assign based on category
2. Agent review → acknowledge or escalate
3. Investigation → update customer
4. Resolution → close ticket
5. Follow-up → satisfaction survey""",
        tags=["support", "tickets", "customer-service"],
    ),
    # Strategies
    KnowledgeItem(
        id="strategy:schema_design",
        type=KnowledgeType.STRATEGY,
        domain=KnowledgeDomain.DATA,
        title="Database Schema Design",
        content="""Schema design steps:
1. Identify entities (nouns → tables)
2. Identify relationships
3. Create referenced tables FIRST
4. Specify field types explicitly""",
        tags=["database", "schema", "best-practice"],
        examples=[
            dspy.Example(
                request="Track clients and projects",
                plan="1. Create 'clients' table (name:text, email:email, status:select[active,inactive])\n2. Create 'projects' table (name:text, client_id:relation[clients], deadline:date)",
            ).with_inputs("request"),
        ],
    ),
    KnowledgeItem(
        id="strategy:agent_design",
        type=KnowledgeType.STRATEGY,
        domain=KnowledgeDomain.BUSINESS,
        title="Agent Design",
        content="""How to design agents:
1. One agent = one role/persona
2. Give agents specific, focused responsibilities
3. Assign only relevant skills and data access
4. Write clear instructions for expected behavior

Multiple specialized agents > one do-everything agent.""",
        tags=["agents", "design", "best-practice"],
        examples=[
            dspy.Example(
                request="Create CRM agents",
                plan="1. 'Sales Rep' agent - handles leads, has access to leads/contacts tables\n2. 'Account Manager' agent - handles existing clients, has access to clients/projects tables",
            ).with_inputs("request"),
        ],
    ),
    # Gotchas
    KnowledgeItem(
        id="gotcha:relation_order",
        type=KnowledgeType.GOTCHA,
        domain=KnowledgeDomain.DATA,
        title="Create referenced tables first",
        content="""WRONG: Create 'projects' with client_id, then 'clients'
RIGHT: Create 'clients' first, then 'projects'

Target table must exist before relation field.""",
        tags=["database", "relations", "common-mistake"],
    ),
    KnowledgeItem(
        id="gotcha:select_options",
        type=KnowledgeType.GOTCHA,
        domain=KnowledgeDomain.DATA,
        title="Select fields need options",
        content="""WRONG: "Add status field (select)"
RIGHT: "Add status field (select: pending, in_progress, completed)"

Select and multiselect fields must have their options defined.""",
        tags=["database", "fields", "common-mistake"],
    ),
    KnowledgeItem(
        id="gotcha:skill_before_agent",
        type=KnowledgeType.GOTCHA,
        domain=KnowledgeDomain.WORKFLOW,
        title="Create skills before agents",
        content="""WRONG: Create agent, then create skill, then attach
RIGHT: Create skill first, then create agent with skill attached

Skills must exist before they can be attached to agents.
Plan steps in order: tables → skills → agents.""",
        tags=["skills", "agents", "common-mistake"],
    ),
]


def main() -> None:
    print("Creating sample knowledge base...")

    kb = KnowledgeBase()
    kb.add(SAMPLE_ITEMS)

    path = "./knowledge_base.json.gz"
    save_knowledge_local(path, kb)

    print(f"Created sample knowledge base: {kb.count()} items")
    print(f"  By type: {kb.count_by_type()}")
    print(f"  By domain: {kb.count_by_domain()}")
    print(f"  Saved to: {path}")


if __name__ == "__main__":
    main()

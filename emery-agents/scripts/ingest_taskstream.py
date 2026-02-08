#!/usr/bin/env python3
"""
Ingest TaskStream dataset into KnowledgeBase.

TaskStream has ~3K files across workflows, decisions, org_structures, and policies.
This script transforms them into KnowledgeItems for semantic search.

Usage:
    # Ingest sample (10 of each type for testing)
    python scripts/ingest_taskstream.py --limit 10

    # Ingest all
    python scripts/ingest_taskstream.py

    # Custom path
    python scripts/ingest_taskstream.py --path ./TaskStream --limit 50
"""
import argparse
import json
import sys
from glob import glob
from pathlib import Path

import yaml

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from emery_agents.knowledge import KnowledgeBase, KnowledgeItem
from emery_agents.knowledge.base import KnowledgeDomain, KnowledgeType
from emery_agents.knowledge.cache import save_knowledge_local


def transform_workflow(filepath: str, data: dict) -> KnowledgeItem:
    """Transform TaskStream workflow to domain pattern."""
    workflow = data.get("workflow", data)
    title = workflow.get("title", Path(filepath).stem.replace("_", " ").title())
    steps = workflow.get("steps", [])
    actors = list(set(s.get("actor", "Unknown") for s in steps if s.get("actor")))
    complexity = workflow.get("complexity", "medium")
    industry = workflow.get("industry", Path(filepath).parts[-2] if len(Path(filepath).parts) > 1 else "general")

    content = f"""Agents needed:
{chr(10).join(f'- Agent "{actor}"' for actor in actors[:5]) or '- (none specified)'}

Workflow ({len(steps)} steps):
{chr(10).join(f'{i+1}. {s.get("actor", "?")}: {s.get("action", "?")}' for i, s in enumerate(steps[:8]))}
{"..." if len(steps) > 8 else ""}"""

    return KnowledgeItem(
        id=f"pattern:workflow:{Path(filepath).stem}",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.WORKFLOW,
        title=title,
        content=content,
        tags=["taskstream", "workflow", industry, complexity],
        metadata={"source": "taskstream", "complexity": complexity, "step_count": len(steps)},
    )


def transform_decision(filepath: str, data: dict) -> KnowledgeItem:
    """Transform TaskStream decision to domain pattern."""
    scenario_id = data.get("scenario_id", Path(filepath).stem)
    title = data.get("title", scenario_id.replace("_", " ").title())
    stakeholders = data.get("stakeholders", {})
    process = data.get("decision_process", [])
    industry = Path(filepath).parts[-2] if len(Path(filepath).parts) > 1 else "general"

    stakeholder_list = (
        list(stakeholders.keys())[:5]
        if isinstance(stakeholders, dict)
        else stakeholders[:5] if isinstance(stakeholders, list) else []
    )

    content = f"""Stakeholders (map to Agents):
{chr(10).join(f'- "{k}"' for k in stakeholder_list) if stakeholder_list else '- (see raw data)'}

Decision steps:
{chr(10).join(f'{i+1}. {step}' for i, step in enumerate(process[:5])) if process else '- (not specified)'}
{"..." if len(process) > 5 else ""}"""

    return KnowledgeItem(
        id=f"pattern:decision:{scenario_id}",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.BUSINESS,
        title=title,
        content=content,
        tags=["taskstream", "decision", industry],
        metadata={"source": "taskstream", "outcome": data.get("outcome", "")},
    )


def transform_org_structure(filepath: str, content: str) -> KnowledgeItem:
    """Transform org structure markdown."""
    title = Path(filepath).stem.replace("_", " ").title()
    industry = Path(filepath).parts[-2] if len(Path(filepath).parts) > 1 else "general"
    truncated = content[:1200] + "..." if len(content) > 1200 else content

    return KnowledgeItem(
        id=f"pattern:org:{Path(filepath).stem}",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.BUSINESS,
        title=f"Org: {title}",
        content=f"""Organization structure:

{truncated}

Mapping: Roles → Agents, Departments → Agent groups""",
        tags=["taskstream", "organization", industry],
        metadata={"source": "taskstream", "full_length": len(content)},
    )


def transform_policy(filepath: str, content: str) -> KnowledgeItem:
    """Transform policy markdown."""
    title = Path(filepath).stem.replace("_", " ").title()
    industry = Path(filepath).parts[-2] if len(Path(filepath).parts) > 1 else "general"
    truncated = content[:1200] + "..." if len(content) > 1200 else content

    return KnowledgeItem(
        id=f"pattern:policy:{Path(filepath).stem}",
        type=KnowledgeType.PATTERN,
        domain=KnowledgeDomain.BUSINESS,
        title=f"Policy: {title}",
        content=f"""Policy pattern:

{truncated}

Mapping: Rules → Skill logic, Approvals → Workflow steps""",
        tags=["taskstream", "policy", industry],
        metadata={"source": "taskstream", "full_length": len(content)},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest TaskStream dataset")
    parser.add_argument("--path", default="./TaskStream", help="Path to TaskStream dataset")
    parser.add_argument("--limit", type=int, default=0, help="Limit items per type (0 = all)")
    parser.add_argument("--output", default="./knowledge_base.json.gz", help="Output file path")
    args = parser.parse_args()

    source_path = args.path
    limit = args.limit if args.limit > 0 else None
    items: list[KnowledgeItem] = []

    # Workflows (YAML)
    print(f"Processing workflows{f' (limit {limit})' if limit else ''}...")
    workflow_files = glob(f"{source_path}/workflows/**/*.yaml", recursive=True)
    for fp in (workflow_files[:limit] if limit else workflow_files):
        try:
            with open(fp) as f:
                items.append(transform_workflow(fp, yaml.safe_load(f)))
        except Exception as e:
            print(f"  Skip {fp}: {e}")
    print(f"  Found {len([i for i in items if 'workflow' in i.id])} workflows")

    # Decisions (JSON)
    print(f"Processing decisions{f' (limit {limit})' if limit else ''}...")
    count_before = len(items)
    decision_files = glob(f"{source_path}/decisions/**/*.json", recursive=True)
    for fp in (decision_files[:limit] if limit else decision_files):
        try:
            with open(fp) as f:
                items.append(transform_decision(fp, json.load(f)))
        except Exception as e:
            print(f"  Skip {fp}: {e}")
    print(f"  Found {len(items) - count_before} decisions")

    # Org structures (Markdown)
    print(f"Processing org structures{f' (limit {limit})' if limit else ''}...")
    count_before = len(items)
    org_files = glob(f"{source_path}/org_structures/**/*.md", recursive=True)
    for fp in (org_files[:limit] if limit else org_files):
        try:
            with open(fp) as f:
                items.append(transform_org_structure(fp, f.read()))
        except Exception as e:
            print(f"  Skip {fp}: {e}")
    print(f"  Found {len(items) - count_before} org structures")

    # Policies (Markdown)
    print(f"Processing policies{f' (limit {limit})' if limit else ''}...")
    count_before = len(items)
    policy_files = glob(f"{source_path}/policies/**/*.md", recursive=True)
    for fp in (policy_files[:limit] if limit else policy_files):
        try:
            with open(fp) as f:
                items.append(transform_policy(fp, f.read()))
        except Exception as e:
            print(f"  Skip {fp}: {e}")
    print(f"  Found {len(items) - count_before} policies")

    print(f"\nTotal: {len(items)} items")

    if not items:
        print("No items found. Check the source path structure.")
        return

    # Build knowledge base
    print("\nBuilding knowledge base (computing embeddings)...")
    kb = KnowledgeBase()
    kb.add(items)

    print(f"\nSaving to {args.output}...")
    save_knowledge_local(args.output, kb)

    print(f"\nDone!")
    print(f"  Items: {kb.count()}")
    print(f"  By type: {kb.count_by_type()}")
    print(f"  By domain: {kb.count_by_domain()}")


if __name__ == "__main__":
    main()

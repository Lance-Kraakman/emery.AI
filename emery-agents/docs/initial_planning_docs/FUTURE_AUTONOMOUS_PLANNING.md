# Future Work: Autonomous Plan Generation for Skill Configuration

> A vision for using planning agents to generate reusable plan templates that configure agentic nodes in the skill editor.

---

## Concept Overview

The core idea: **Planning agents generate plans → Plans become skill templates → Templates configure agentic nodes**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLAN GENERATION WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   PLANNING   │────▶│    PLAN      │────▶│   SKILL      │                 │
│  │    AGENT     │     │    FILE      │     │   TEMPLATE   │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│         │                    │                    │                          │
│         │ Generate           │ Persist            │ Configure                │
│         ▼                    ▼                    ▼                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │  Research    │     │  Versioned   │     │   Agentic    │                 │
│  │  + Plan      │     │  Markdown    │     │    Node      │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│         │                    │                    │                          │
│         │ HITL               │ Review             │ Execute                  │
│         ▼                    ▼                    ▼                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Approval   │     │   Optimize   │     │   Quality    │                 │
│  │   Refine     │     │   Lock       │     │   Evals      │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Problem

Currently, agentic nodes in the skill editor are configured with:
- **Instruction text** (free-form)
- **Tools** (selected from available)
- **Input/Output schemas** (manually defined)

This has limitations:
1. **No structure** - Instructions are unstructured text
2. **No versioning** - Changes overwrite previous versions
3. **No quality baseline** - No way to evaluate if instructions are good
4. **No learning** - Each skill starts from scratch

---

## The Solution: Plan-Driven Skill Configuration

### Phase 1: Plan Generation Mode

A planning agent researches and creates a structured plan for a task:

```python
class PlanGenerationAgent:
    """Agent that generates reusable plans for tasks."""

    async def generate_plan(self, goal: str, context: dict) -> Plan:
        # Phase 1: Research (read-only mode)
        research = await self.research_agent.run(
            f"Research how to accomplish: {goal}",
            mode=ToolMode.PLANNING
        )

        # Phase 2: Plan creation
        plan = await self.planner.run(
            f"Create a step-by-step plan for: {goal}\n\nResearch: {research}"
        )

        # Phase 3: HITL refinement
        refined_plan = await self.refine_with_user(plan)

        return refined_plan
```

### Phase 2: Plan File Structure

Plans are persisted as structured markdown with YAML frontmatter:

```markdown
---
id: plan_slack_notification_20240115
goal: "Send formatted Slack notifications with user mentions"
version: 3
status: approved
created_at: 2024-01-15T10:30:00Z
approved_at: 2024-01-15T11:00:00Z
author: agent:planning_agent
approver: user:lance
tags: [slack, notifications, messaging]
---

# Plan: Send Slack Notifications

## Goal
Send formatted Slack notifications with user mentions and rich formatting.

## Prerequisites
- Slack workspace connected
- Bot has chat:write permission
- Channel ID or user ID available

## Steps

### Step 1: Validate Input
- **Type**: validation
- **Tools**: none
- **Inputs**: channel_id, message, mentions[]
- **Outputs**: validated_input
- **Instruction**: |
    Validate that channel_id is provided and message is not empty.
    If mentions provided, ensure they are valid user IDs.

### Step 2: Format Message
- **Type**: transform
- **Tools**: none
- **Inputs**: validated_input
- **Outputs**: formatted_message
- **Instruction**: |
    Convert mentions to Slack format: <@USER_ID>
    Apply markdown formatting for bold, italic, code blocks.
    Construct Block Kit payload if rich formatting needed.

### Step 3: Send to Slack
- **Type**: tool_execution
- **Tools**: slack_send_message
- **Inputs**: formatted_message, channel_id
- **Outputs**: message_id, timestamp
- **Instruction**: |
    Use slack_send_message tool with channel and formatted blocks.
    Capture message_id and timestamp for confirmation.

### Step 4: Confirm Delivery
- **Type**: verification
- **Tools**: slack_get_message
- **Inputs**: message_id, channel_id
- **Outputs**: delivery_confirmed
- **Instruction**: |
    Verify message was delivered by fetching it.
    Return success with message link.

## Error Handling
- If channel not found: Return error with suggestion to check channel ID
- If rate limited: Implement exponential backoff
- If formatting fails: Fall back to plain text

## Evaluation Criteria
- Message delivered within 5 seconds
- Mentions resolve to correct users
- Formatting preserved in Slack
```

### Phase 3: Plan → Skill Template Conversion

The plan file is converted to a skill configuration:

```python
class PlanToSkillConverter:
    """Converts approved plans to skill configurations."""

    def convert(self, plan: Plan) -> SkillConfig:
        steps = []
        for plan_step in plan.steps:
            skill_step = SkillStep(
                id=generate_uuid(),
                name=plan_step.title,
                nodeType=self._map_step_type(plan_step.type),
                instruction=plan_step.instruction,
                tools=plan_step.tools,
                inputDefs=self._parse_inputs(plan_step.inputs),
                outputDefs=self._parse_outputs(plan_step.outputs),
                errorConfig=self._parse_error_config(plan.error_handling),
            )
            steps.append(skill_step)

        return SkillConfig(
            name=plan.goal,
            execution_type="agent",  # Step-based execution
            steps=steps,
            metadata={
                "source_plan_id": plan.id,
                "plan_version": plan.version,
            }
        )
```

### Phase 4: Evaluation Integration

Each plan includes evaluation criteria that become promptfoo tests:

```python
class PlanEvaluationGenerator:
    """Generates promptfoo evals from plan criteria."""

    def generate_evals(self, plan: Plan) -> dict:
        return {
            "description": f"Evaluation for: {plan.goal}",
            "providers": ["emery-skill.ts"],
            "tests": [
                {
                    "description": criterion.description,
                    "vars": {
                        "skill_name": plan.goal,
                        "inputs": criterion.test_inputs,
                    },
                    "assert": self._build_assertions(criterion)
                }
                for criterion in plan.evaluation_criteria
            ]
        }
```

Generated eval file (`evals/scenarios/generated/slack_notification.yaml`):
```yaml
description: "Evaluation for: Send Slack Notifications"

tests:
  - description: "Message delivered within 5 seconds"
    vars:
      skill_name: "Send Slack Notifications"
      inputs:
        channel_id: "C12345"
        message: "Test message"
    assert:
      - type: latency
        threshold: 5000

  - description: "Mentions resolve correctly"
    vars:
      skill_name: "Send Slack Notifications"
      inputs:
        channel_id: "C12345"
        message: "Hello"
        mentions: ["U12345"]
    assert:
      - type: contains
        value: "<@U12345>"

  - description: "Formatting preserved"
    vars:
      inputs:
        message: "**bold** and _italic_"
    assert:
      - type: javascript
        value: |
          const result = JSON.parse(output);
          return result.blocks.some(b => b.type === 'rich_text');
```

---

## Workflow: From Goal to Configured Skill

### Step 1: User Initiates Plan Generation

```
User: "I need a skill that sends Slack notifications with mentions"

System: Entering plan generation mode...
```

### Step 2: Planning Agent Researches

```python
# Agent uses read-only tools to understand:
# - Available Slack tools and their schemas
# - Best practices for Slack formatting
# - Example implementations in codebase
```

### Step 3: Plan Created and Presented

```
Planning Agent: I've created a plan for sending Slack notifications.

## Plan Overview
1. Validate Input - Check channel and message
2. Format Message - Apply Slack markdown and mentions
3. Send to Slack - Use slack_send_message tool
4. Confirm Delivery - Verify message was sent

## Required Tools
- slack_send_message
- slack_get_message

Would you like to approve this plan, or should I refine it?
```

### Step 4: User Refines (HITL)

```
User: Add support for attachments and file uploads

Planning Agent: Updated plan to include attachment handling...
[Plan v2 presented]
```

### Step 5: Plan Approved and Saved

```
User: Approve

System: Plan saved to ~/.emery/plans/slack_notification_v2.md
        Generating skill configuration...
        Generating evaluation suite...
```

### Step 6: Skill Created from Plan

The skill editor now shows:
- Pre-configured steps matching the plan
- Tools auto-selected
- Input/output schemas defined
- Evaluation tests ready to run

### Step 7: Continuous Improvement

When the skill is executed:
- Performance metrics collected
- Evals run automatically
- Failures trigger plan review suggestions

---

## Data Model Extensions

### Plan Entity

```python
@dataclass
class Plan:
    id: str
    goal: str
    version: int
    status: PlanStatus  # draft, pending_approval, approved, locked, deprecated

    # Content
    prerequisites: List[str]
    steps: List[PlanStep]
    error_handling: ErrorHandlingConfig
    evaluation_criteria: List[EvaluationCriterion]

    # Metadata
    created_at: datetime
    approved_at: Optional[datetime]
    author: str  # agent:name or user:id
    approver: Optional[str]
    tags: List[str]

    # Lineage
    source_plan_id: Optional[str]  # If derived from another plan
    skill_ids: List[int]  # Skills created from this plan

@dataclass
class PlanStep:
    title: str
    type: StepType  # validation, transform, tool_execution, verification, decision
    instruction: str
    tools: List[str]
    inputs: List[str]
    outputs: List[str]
    conditions: Optional[str]

@dataclass
class EvaluationCriterion:
    description: str
    test_inputs: Dict[str, Any]
    expected_behavior: str
    assertion_type: str  # latency, contains, javascript, is-json
    threshold: Optional[Any]
```

### Skill Metadata Extension

```python
# Extend SkillConfig with plan lineage
class SkillConfig:
    # ... existing fields ...

    # Plan lineage
    source_plan_id: Optional[str]
    plan_version: Optional[int]
    auto_generated: bool = False

    # Evaluation
    eval_suite_path: Optional[str]
    last_eval_run: Optional[datetime]
    eval_pass_rate: Optional[float]
```

---

## Architecture Components

### 1. PlanGenerationService

```python
class PlanGenerationService:
    """Orchestrates plan generation workflow."""

    def __init__(
        self,
        research_agent: ResearchAgent,
        planning_agent: PlanningAgent,
        plan_repo: PlanRepository,
    ):
        self.research_agent = research_agent
        self.planning_agent = planning_agent
        self.plan_repo = plan_repo

    async def generate(self, goal: str) -> Plan:
        # Research phase
        context = await self.research_agent.research(goal)

        # Planning phase
        plan = await self.planning_agent.create_plan(goal, context)

        # Persist draft
        self.plan_repo.save(plan)

        return plan

    async def refine(self, plan_id: str, feedback: str) -> Plan:
        plan = self.plan_repo.load(plan_id)
        refined = await self.planning_agent.refine(plan, feedback)
        refined.version = plan.version + 1
        self.plan_repo.save(refined)
        return refined

    async def approve(self, plan_id: str, approver: str) -> Plan:
        plan = self.plan_repo.load(plan_id)
        plan.status = PlanStatus.APPROVED
        plan.approved_at = datetime.utcnow()
        plan.approver = approver
        self.plan_repo.save(plan)
        return plan
```

### 2. SkillGenerationService

```python
class SkillGenerationService:
    """Creates skills from approved plans."""

    def __init__(
        self,
        plan_repo: PlanRepository,
        skill_service: SkillApplicationService,
        eval_generator: EvalGenerator,
    ):
        self.plan_repo = plan_repo
        self.skill_service = skill_service
        self.eval_generator = eval_generator

    async def create_skill_from_plan(self, plan_id: str, agent_id: int) -> Skill:
        plan = self.plan_repo.load(plan_id)

        if plan.status != PlanStatus.APPROVED:
            raise ValueError("Plan must be approved before creating skill")

        # Convert plan to skill config
        config = PlanToSkillConverter().convert(plan)

        # Create skill
        skill = await self.skill_service.create_skill(
            agent_id=agent_id,
            name=plan.goal,
            execution_type="agent",
            steps=config.steps,
            metadata={
                "source_plan_id": plan.id,
                "plan_version": plan.version,
                "auto_generated": True,
            }
        )

        # Generate evaluations
        eval_suite = self.eval_generator.generate(plan)
        eval_path = self._save_eval_suite(skill.id, eval_suite)

        # Update skill with eval path
        await self.skill_service.update_skill(
            skill.id,
            eval_suite_path=eval_path
        )

        # Update plan with skill reference
        plan.skill_ids.append(skill.id)
        self.plan_repo.save(plan)

        return skill
```

### 3. EvalIntegrationService

```python
class EvalIntegrationService:
    """Integrates plan evaluations with promptfoo."""

    def __init__(self, evals_dir: Path):
        self.evals_dir = evals_dir

    def generate_eval_suite(self, plan: Plan) -> dict:
        """Generate promptfoo config from plan criteria."""
        tests = []

        for criterion in plan.evaluation_criteria:
            test = {
                "description": criterion.description,
                "vars": {
                    "skill_name": plan.goal,
                    "inputs": criterion.test_inputs,
                },
                "assert": self._build_assertions(criterion)
            }
            tests.append(test)

        return {
            "description": f"Auto-generated evals for: {plan.goal}",
            "providers": [{"id": "emery-skill.ts"}],
            "tests": tests,
        }

    def run_evals(self, skill_id: int) -> EvalResult:
        """Run evaluations for a skill."""
        # Integration with promptfoo CLI
        ...

    def _build_assertions(self, criterion: EvaluationCriterion) -> list:
        if criterion.assertion_type == "latency":
            return [{"type": "latency", "threshold": criterion.threshold}]
        elif criterion.assertion_type == "contains":
            return [{"type": "contains", "value": criterion.expected_behavior}]
        # ... more assertion types
```

---

## UI Integration

### Skill Editor Enhancements

1. **"Generate from Plan" Button**
   - Opens plan generation workflow
   - Shows research progress
   - Presents plan for approval

2. **Plan Lineage View**
   - Shows which plan a skill was generated from
   - Links to plan history
   - Shows plan version used

3. **Evaluation Dashboard**
   - Run evals from editor
   - Show pass/fail status
   - Suggest plan improvements on failure

4. **Plan Library**
   - Browse approved plans
   - Clone plans for modification
   - Share plans across agents

### Plan Editor

A dedicated UI for viewing and editing plans:
- Markdown preview with syntax highlighting
- Step-by-step visual editor
- Evaluation criteria builder
- Version history and diff view

---

## Implementation Phases

### Phase A: Plan Persistence (Prerequisite)
- Implement `PlanRepository`
- Add plan versioning
- Create plan markdown format

### Phase B: Plan Generation Agent
- Create `ResearchAgent` for context gathering
- Create `PlanningAgent` for plan creation
- Implement HITL refinement flow

### Phase C: Plan → Skill Conversion
- Implement `PlanToSkillConverter`
- Integrate with skill creation API
- Add plan lineage metadata

### Phase D: Evaluation Integration
- Implement `EvalGenerator`
- Integrate with promptfoo
- Add eval running to skill editor

### Phase E: UI Components
- Plan generation wizard
- Plan library browser
- Skill lineage view
- Eval dashboard

---

## Benefits

1. **Quality**: Plans are reviewed before becoming skills
2. **Consistency**: Standard format for all agentic nodes
3. **Versioning**: Full history of plan evolution
4. **Testability**: Every skill has generated evals
5. **Learning**: Plans can be shared and improved
6. **Auditability**: Clear lineage from goal → plan → skill

---

## Example: End-to-End Flow

```
User: Create a skill for processing expense reports

┌─────────────────────────────────────────────────────────────────┐
│ Planning Agent: Researching expense processing patterns...      │
│                                                                 │
│ Found:                                                          │
│ - table_crud tools for expense table                            │
│ - document_crud for receipts                                    │
│ - Existing approval workflow patterns                           │
│                                                                 │
│ Creating plan...                                                │
└─────────────────────────────────────────────────────────────────┘

Plan v1:
1. Parse expense data from input
2. Validate required fields (amount, category, date)
3. Check for duplicate submissions
4. Create expense record in table
5. Attach receipt documents
6. Trigger approval workflow

User: Add budget checking before approval

Plan v2:
1. Parse expense data from input
2. Validate required fields
3. Check for duplicate submissions
4. **Check department budget remaining**
5. Create expense record in table
6. Attach receipt documents
7. Trigger approval workflow (with budget warning if low)

User: Approve

System:
✓ Plan saved: ~/.emery/plans/expense_processing_v2.md
✓ Skill created: "Process Expense Report" (7 steps)
✓ Evals generated: evals/scenarios/generated/expense_processing.yaml
✓ Ready for testing

[Run Evals] [Edit Skill] [View Plan]
```

---

## Next Steps

1. **Validate Concept**: Build minimal plan generation prototype
2. **User Testing**: Test with real skill creation workflows
3. **Iterate**: Refine plan format based on feedback
4. **Scale**: Add plan library and sharing features

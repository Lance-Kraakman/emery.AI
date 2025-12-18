# OSSA Agent Registry

This directory contains static OSSA agent manifests that define the available agents in the system.

## File Structure

```
registry/
├── chat_planner.ossa.yaml          # Main orchestrator agent
├── skill_builder.ossa.yaml          # Skill modification agent  
├── document_builder.ossa.yaml       # Document operations agent
├── task_executor.ossa.yaml          # Task execution agent
└── specialized/                    # Domain-specific agents
    ├── email_assistant.ossa.yaml
    ├── data_analyst.ossa.yaml
    └── compliance_auditor.ossa.yaml
```

## OSSA Manifest Format

Each manifest follows the OSSA v0.2.9 specification:

```yaml
apiVersion: ossa/v0.2.9
kind: Agent
metadata:
  name: skill_builder
  version: "1.0.0"
  description: "Modifies and creates AI skills"
  labels:
    domain: skill-management
    capability: skill-operations
spec:
  role: |
    You are an expert AI skill engineer...
  llm:
    provider: openai
    model: gpt-4
    temperature: 0.3
  capabilities:
    - name: create_skill
      description: "Create new AI skills"
    - name: modify_skill
      description: "Modify existing skills"
  tools:
    - type: emery_crud
      resource: skill
  execution:
    mode: interactive
    max_steps: 10
  security:
    authentication:
      type: api_key
```

## Integration Points

1. **Static Registry**: Loaded by `OSSAAgentRegistry` on startup
2. **Runtime Routing**: Used by `chat_planner` for agent selection  
3. **Instruction Generation**: Drives Jinja template composition
4. **Validation**: Ensures agent compliance before execution
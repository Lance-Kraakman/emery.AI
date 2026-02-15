  Code Review & Restructuring Plan: emery-agents                                                                                                                                 
                                                                                                                                                                                    
     Summary                                                                                                                                                                        
                                                                                                                                                                                    
     Your concerns are valid. The codebase has grown organically with overlapping executor responsibilities:                                                                        
                                                                                                                                                                                    
     Current Architecture (Overlapping):                                                                                                                                            
                                                                                                                                                                                    
     AgentExecutor (1,341 lines) ─┬─→ Interactive execution                                                                                                                         
                                 ├─→ Agentic skill execution                                                                                                                        
                                 └─→ Coordinator mode                                                                                                                               
                                         ↓                                                                                                                                          
     SkillExecutorService (1,089 lines) ─┬─→ Agentic execution                                                                                                                      
                                         └─→ Workflow execution                                                                                                                     
                                                 ↓                                                                                                                                  
     StepExecutorService (1,725 lines) ─┬─→ DAG orchestration                                                                                                                       
                                        ├─→ Loop/retry/conditions                                                                                                                   
                                        └─→ 5 step type handlers                                                                                                                    
                                                 ↓                                                                                                                                  
     PlanStepExecutor (708 lines) ─────→ Single step + DSPy ReAct                                                                                                                   
                                                                                                                                                                                    
     Core Problem: No clear separation between execution modes. Shared concerns (output pipeline, template resolution, tool loading) are duplicated across classes.                 
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Current Execution Modes                                                                                                                                                        
                                                                                                                                                                                    
     The system actually has 4 distinct execution modes that are currently tangled:                                                                                                 
     ┌─────────────┬─────────────────────────────┬────────────────────────────────────────────────┐                                                                                 
     │    Mode     │         Entry Point         │                  Description                   │                                                                                 
     ├─────────────┼─────────────────────────────┼────────────────────────────────────────────────┤                                                                                 
     │ INTERACTIVE │ AgentExecutor               │ Single-turn instruction, no skill state        │                                                                                 
     ├─────────────┼─────────────────────────────┼────────────────────────────────────────────────┤                                                                                 
     │ AGENTIC     │ AgentExecutor/SkillExecutor │ Pure LLM with tools, skill instructions        │                                                                                 
     ├─────────────┼─────────────────────────────┼────────────────────────────────────────────────┤                                                                                 
     │ WORKFLOW    │ StepExecutorService         │ DAG of typed steps (read/write/tool/inline)    │                                                                                 
     ├─────────────┼─────────────────────────────┼────────────────────────────────────────────────┤                                                                                 
     │ COORDINATOR │ LangGraph                   │ Two-phase plan→approve→execute with replanning │                                                                                 
     └─────────────┴─────────────────────────────┴────────────────────────────────────────────────┘                                                                                 
     ---                                                                                                                                                                            
     ---                                                                                                                                                                            
     Detailed Duplication Analysis                                                                                                                                                  
                                                                                                                                                                                    
     Exact Code Duplication Found                                                                                                                                                   
                                                                                                                                                                                    
     1. Human Skill Handling (copy-paste with async/sync difference)                                                                                                                
     AgentExecutor._handle_human_skill_execution() [async, lines 136-193]                                                                                                           
     SkillExecutorService._handle_human_skill() [sync, lines 160-229]                                                                                                               
                                                                                                                                                                                    
     Both build identical event_data dict:                                                                                                                                          
     - type: "awaiting_human_skill"                                                                                                                                                 
     - skill_id, skill_name, step_id, instructions                                                                                                                                  
     - inputs, output_schema, assigned_to                                                                                                                                           
                                                                                                                                                                                    
     2. Output Extraction (same pattern, different locations)                                                                                                                       
     SkillExecutorService._execute_agent() [lines 852-876]                                                                                                                          
     SkillExecutorService._post_dag_output_pipeline() [lines 488-524]                                                                                                               
                                                                                                                                                                                    
     Both:                                                                                                                                                                          
     - Create OutputExtractorModule with skill_outputs                                                                                                                              
     - Call get_dspy_lm() with skill_model, org_model                                                                                                                               
     - Use dspy.context(lm=lm) wrapper                                                                                                                                              
     - Call extractor.extract(content=...)                                                                                                                                          
     - Check for all-null results                                                                                                                                                   
                                                                                                                                                                                    
     3. Skill Routing Logic (parallel decision trees)                                                                                                                               
     AgentExecutor.execute_task() [lines 465-499]:                                                                                                                                  
       if skill.is_human_skill(): ...                                                                                                                                               
       elif self._is_agent_skill(skill): ...  # DAG                                                                                                                                 
       else: # Agentic DSPy                                                                                                                                                         
                                                                                                                                                                                    
     SkillExecutorService.execute_skill() [lines 612-653]:                                                                                                                          
       if skill_config.is_human_skill(): ...                                                                                                                                        
       elif skill_config.is_workflow(): ...  # DAG                                                                                                                                  
       elif self._extract_plan_from_skill(): ...  # Wrapper DAG                                                                                                                     
       else: # Pure agent                                                                                                                                                           
                                                                                                                                                                                    
     4. Tool Loading Before Execution                                                                                                                                               
     AgentExecutor._create_skill_agent() → tool_loader.load_tools_from_configs()                                                                                                    
     SkillExecutorService._execute_agent() → tool_loader.load_tools_from_configs()                                                                                                  
     StepExecutorService._execute_agentic_step() → tool_loader.load_tools_from_configs()                                                                                            
                                                                                                                                                                                    
     ExecutionContext as God Object                                                                                                                                                 
                                                                                                                                                                                    
     entities/execution_context.py has 20+ fields mixing:                                                                                                                           
     ┌─────────────┬───────────────────────────────────────────────────┐                                                                                                            
     │  Category   │                      Fields                       │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Mode        │ mode, use_coordinator, tool_mode                  │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Task        │ task                                              │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Auth        │ agent_id, organization_id, org_model, agent_model │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Skill       │ skill, skill_name, skill_inputs, available_skills │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Attachments │ images, attachments, session_attachments          │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Tools       │ available_tools, tool_provider, output_tool       │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Execution   │ max_steps, timeout_seconds, workspace_path        │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ State       │ plan, resolved_context, source_row_id             │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Callbacks   │ progress_callback                                 │                                                                                                            
     ├─────────────┼───────────────────────────────────────────────────┤                                                                                                            
     │ Legacy      │ environment                                       │                                                                                                            
     └─────────────┴───────────────────────────────────────────────────┘                                                                                                            
     Problem: Every executor receives this "bag of everything" but only uses a subset.                                                                                              
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Phased Restructuring Plan                                                                                                                                                      
                                                                                                                                                                                    
     Phase 1: Extract Shared Concerns (Low Risk)                                                                                                                                    
                                                                                                                                                                                    
     Extract duplicated logic into focused service classes without changing external APIs.                                                                                          
                                                                                                                                                                                    
     1.1 OutputPipeline - Consolidate extraction + coercion + write                                                                                                                 
                                                                                                                                                                                    
     Current locations:                                                                                                                                                             
     - SkillExecutorService._execute_agent() lines 852-876                                                                                                                          
     - SkillExecutorService._post_dag_output_pipeline() lines 438-549                                                                                                               
     - SkillExecutorService._coerce_extracted_values() lines 48-89 (module-level)                                                                                                   
     - AgentExecutor.execute_task() lines 546-569                                                                                                                                   
                                                                                                                                                                                    
     Exact types to preserve (from actual codebase):                                                                                                                                
     # From types.py                                                                                                                                                                
     @dataclass                                                                                                                                                                     
     class SkillExecutionResult:                                                                                                                                                    
         result: str                                                                                                                                                                
         captured_outputs: dict[str, Any] | None = None                                                                                                                             
         status: str = "completed"  # "completed" | "awaiting_human" | "failed"                                                                                                     
                                                                                                                                                                                    
     # From reasoning/signatures/extraction.py                                                                                                                                      
     @dataclass                                                                                                                                                                     
     class TargetFieldMeta:                                                                                                                                                         
         """Target field constraints from the destination table."""                                                                                                                 
         type: str = "text"  # Field type for coercion                                                                                                                              
         options: list[str] = field(default_factory=list)  # Valid options for select fields                                                                                        
                                                                                                                                                                                    
     # From entities/skill_config.py - OutputDefinition (full name)                                                                                                                 
     @dataclass                                                                                                                                                                     
     class OutputDefinition:                                                                                                                                                        
         """Output definition with optional mapping config."""                                                                                                                      
         name: str                                                                                                                                                                  
         type: str = "string"                                                                                                                                                       
         description: str = ""                                                                                                                                                      
         source: OutputSource | None = None  # For node_output mapping                                                                                                              
         output_mapping: OutputMappingConfig | None = None  # Table write config                                                                                                    
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class OutputMappingConfig:                                                                                                                                                     
         """Configuration for writing outputs to tables."""                                                                                                                         
         table_mappings: list[OutputTableMapping] = field(default_factory=list)                                                                                                     
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class OutputTableMapping:                                                                                                                                                      
         """Single table write operation."""                                                                                                                                        
         order: int = 1                                                                                                                                                             
         target_table_id: int = 0                                                                                                                                                   
         row_action: str = "create"  # "create" | "update" | "upsert"                                                                                                               
         row_id_source: RowIdSource | None = None                                                                                                                                   
         match_field_ids: list[int] | None = None                                                                                                                                   
         mappings: list[OutputFieldMapping] = field(default_factory=list)                                                                                                           
                                                                                                                                                                                    
     # From entities/skill_config.py - WriteConfig (for steps)                                                                                                                      
     @dataclass                                                                                                                                                                     
     class WriteConfig:                                                                                                                                                             
         """Configuration for write steps."""                                                                                                                                       
         target_table_id: int = 0                                                                                                                                                   
         row_action: str = "create"                                                                                                                                                 
         field_mappings: list[WriteFieldMapping] = field(default_factory=list)                                                                                                      
         row_id_source: RowIdSource | None = None                                                                                                                                   
         match_field_ids: list[int] | None = None                                                                                                                                   
                                                                                                                                                                                    
     New unified service:                                                                                                                                                           
     # services/execution/output_pipeline.py                                                                                                                                        
                                                                                                                                                                                    
     from emery_agents.reasoning.modules.extractor import OutputExtractorModule                                                                                                     
     from emery_agents.reasoning.signatures.extraction import TargetFieldMeta                                                                                                       
     from emery_agents.reasoning.config import get_dspy_lm                                                                                                                          
     from emery_agents.entities.skill_config import OutputDef, WriteConfig                                                                                                          
     from emery_agents.api import TableAPI                                                                                                                                          
     import dspy                                                                                                                                                                    
                                                                                                                                                                                    
     class OutputPipeline:                                                                                                                                                          
         """Unified output handling: extract → coerce → write.                                                                                                                      
                                                                                                                                                                                    
         Replaces duplicated logic in:                                                                                                                                              
         - SkillExecutorService._execute_agent() lines 852-876                                                                                                                      
         - SkillExecutorService._post_dag_output_pipeline() lines 488-524                                                                                                           
         """                                                                                                                                                                        
                                                                                                                                                                                    
         def extract_outputs(                                                                                                                                                       
             self,                                                                                                                                                                  
             content: str,                                                                                                                                                          
             skill_outputs: list[OutputDef],                                                                                                                                        
             skill_model: str | None,                                                                                                                                               
             org_model: str | None,                                                                                                                                                 
             target_field_metadata: dict[str, TargetFieldMeta] | None = None,                                                                                                       
         ) -> dict[str, Any]:                                                                                                                                                       
             """Extract structured values from text content using LLM.                                                                                                              
                                                                                                                                                                                    
             Args:                                                                                                                                                                  
                 content: Text to extract from (agent result string)                                                                                                                
                 skill_outputs: List of OutputDef with name, type, description                                                                                                      
                 skill_model: Skill-specific model override                                                                                                                         
                 org_model: Organization default model                                                                                                                              
                 target_field_metadata: Optional field constraints (select options)                                                                                                 
                                                                                                                                                                                    
             Returns:                                                                                                                                                               
                 Dict mapping output name to extracted value (or None if not found)                                                                                                 
             """                                                                                                                                                                    
             extractor = OutputExtractorModule(                                                                                                                                     
                 skill_outputs=[                                                                                                                                                    
                     {"name": o.name, "type": o.type, "description": o.description}                                                                                                 
                     for o in skill_outputs                                                                                                                                         
                 ],                                                                                                                                                                 
                 target_field_metadata=target_field_metadata,                                                                                                                       
             )                                                                                                                                                                      
             lm = get_dspy_lm(skill_model=skill_model, org_model=org_model)                                                                                                         
             with dspy.context(lm=lm):                                                                                                                                              
                 return extractor.extract(content=content)                                                                                                                          
                                                                                                                                                                                    
         def coerce_values(                                                                                                                                                         
             self,                                                                                                                                                                  
             values: dict[str, Any],                                                                                                                                                
             field_metadata: dict[str, TargetFieldMeta],                                                                                                                            
         ) -> dict[str, Any]:                                                                                                                                                       
             """Normalize extracted values to match target field constraints.                                                                                                       
                                                                                                                                                                                    
             Handles:                                                                                                                                                               
             - single-select: case-insensitive match to valid options                                                                                                               
             - multi-select: same, per item                                                                                                                                         
             - boolean: normalize string representations ("true", "yes", "1")                                                                                                       
             """                                                                                                                                                                    
             coerced: dict[str, Any] = {}                                                                                                                                           
             for name, value in values.items():                                                                                                                                     
                 if value is None:                                                                                                                                                  
                     coerced[name] = value                                                                                                                                          
                     continue                                                                                                                                                       
                 meta = field_metadata.get(name)                                                                                                                                    
                 if meta is None:                                                                                                                                                   
                     coerced[name] = value                                                                                                                                          
                     continue                                                                                                                                                       
                                                                                                                                                                                    
                 if meta.type == "single-select" and meta.options:                                                                                                                  
                     lookup = {o.lower(): o for o in meta.options}                                                                                                                  
                     coerced[name] = lookup.get(str(value).strip().lower())                                                                                                         
                 elif meta.type == "multi-select" and meta.options:                                                                                                                 
                     lookup = {o.lower(): o for o in meta.options}                                                                                                                  
                     if isinstance(value, list):                                                                                                                                    
                         coerced[name] = [                                                                                                                                          
                             v for v in (lookup.get(str(v).strip().lower()) for v in value)                                                                                         
                             if v is not None                                                                                                                                       
                         ]                                                                                                                                                          
                     else:                                                                                                                                                          
                         coerced[name] = value                                                                                                                                      
                 elif meta.type == "boolean":                                                                                                                                       
                     if isinstance(value, str):                                                                                                                                     
                         coerced[name] = value.strip().lower() in ("true", "yes", "1")                                                                                              
                     else:                                                                                                                                                          
                         coerced[name] = bool(value)                                                                                                                                
                 else:                                                                                                                                                              
                     coerced[name] = value                                                                                                                                          
             return coerced                                                                                                                                                         
                                                                                                                                                                                    
         def write_to_table(                                                                                                                                                        
             self,                                                                                                                                                                  
             outputs: dict[str, Any],                                                                                                                                               
             write_config: WriteConfig,                                                                                                                                             
             api_key: str,                                                                                                                                                          
             org_id: int,                                                                                                                                                           
         ) -> None:                                                                                                                                                                 
             """Write extracted outputs to target table.                                                                                                                            
                                                                                                                                                                                    
             Uses TableAPI.create_row() or .update_row() based on write_config.row_action.                                                                                          
             """                                                                                                                                                                    
             # Delegates to existing step_executor write logic                                                                                                                      
             ...                                                                                                                                                                    
                                                                                                                                                                                    
     1.2 HumanSkillHandler - Consolidate human skill pause logic                                                                                                                    
                                                                                                                                                                                    
     Current locations (nearly identical code):                                                                                                                                     
     - AgentExecutor._handle_human_skill_execution() lines 136-193 (async, yields dict)                                                                                             
     - SkillExecutorService._handle_human_skill() lines 160-229 (sync, returns SkillExecutionResult)                                                                                
                                                                                                                                                                                    
     Progress dict format (used by async path):                                                                                                                                     
     # Yielded by AgentExecutor._handle_human_skill_execution()                                                                                                                     
     {                                                                                                                                                                              
         "status": "awaiting_human",                                                                                                                                                
         "output": json.dumps({                                                                                                                                                     
             "type": "awaiting_human_skill",                                                                                                                                        
             "skill_id": int,                                                                                                                                                       
             "skill_name": str,                                                                                                                                                     
             "step_id": str,  # Empty for top-level                                                                                                                                 
             "instructions": str,                                                                                                                                                   
             "inputs": dict[str, Any],                                                                                                                                              
             "output_schema": list[{"name": str, "type": str}],                                                                                                                     
             "assigned_to": str,  # "" or "role:..." or user_id                                                                                                                     
         }),                                                                                                                                                                        
         "error_message": "",                                                                                                                                                       
         "timestamp_ms": int,                                                                                                                                                       
         "progress_percent": 0.0,                                                                                                                                                   
     }                                                                                                                                                                              
                                                                                                                                                                                    
     New unified handler:                                                                                                                                                           
     # services/execution/human_skill_handler.py                                                                                                                                    
                                                                                                                                                                                    
     from collections.abc import AsyncIterator, Callable                                                                                                                            
     from typing import Any                                                                                                                                                         
     import json                                                                                                                                                                    
     import time                                                                                                                                                                    
                                                                                                                                                                                    
     from emery_agents.entities.skill_config import SkillConfig                                                                                                                     
     from emery_agents.types import SkillExecutionResult                                                                                                                            
                                                                                                                                                                                    
     class HumanSkillHandler:                                                                                                                                                       
         """Unified human skill event emission.                                                                                                                                     
                                                                                                                                                                                    
         Replaces duplicated logic in:                                                                                                                                              
         - AgentExecutor._handle_human_skill_execution() [async]                                                                                                                    
         - SkillExecutorService._handle_human_skill() [sync]                                                                                                                        
         """                                                                                                                                                                        
                                                                                                                                                                                    
         def build_awaiting_event(                                                                                                                                                  
             self,                                                                                                                                                                  
             skill: SkillConfig,                                                                                                                                                    
             runtime_inputs: dict[str, Any],                                                                                                                                        
             step_id: str = "",                                                                                                                                                     
         ) -> dict[str, Any]:                                                                                                                                                       
             """Build awaiting_human_skill event payload.                                                                                                                           
                                                                                                                                                                                    
             Returns:                                                                                                                                                               
                 Event dict with type, skill_id, instructions, inputs, output_schema                                                                                                
             """                                                                                                                                                                    
             human_config = skill.human_skill_config                                                                                                                                
             instructions = (                                                                                                                                                       
                 human_config.instructions if human_config else skill.instructions                                                                                                  
             )                                                                                                                                                                      
                                                                                                                                                                                    
             output_schema = [                                                                                                                                                      
                 {"name": out.name, "type": out.type}                                                                                                                               
                 for out in skill.outputs                                                                                                                                           
             ]                                                                                                                                                                      
                                                                                                                                                                                    
             assigned_to = ""                                                                                                                                                       
             if human_config:                                                                                                                                                       
                 if human_config.assignee_type == "specific_user" and human_config.assignee_id:                                                                                     
                     assigned_to = human_config.assignee_id                                                                                                                         
                 elif human_config.assignee_type == "role" and human_config.assignee_role:                                                                                          
                     assigned_to = f"role:{human_config.assignee_role}"                                                                                                             
                                                                                                                                                                                    
             return {                                                                                                                                                               
                 "type": "awaiting_human_skill",                                                                                                                                    
                 "skill_id": skill.id,                                                                                                                                              
                 "skill_name": skill.name,                                                                                                                                          
                 "step_id": step_id,                                                                                                                                                
                 "instructions": instructions,                                                                                                                                      
                 "inputs": runtime_inputs,                                                                                                                                          
                 "output_schema": output_schema,                                                                                                                                    
                 "assigned_to": assigned_to,                                                                                                                                        
                 "external_links": [],                                                                                                                                              
             }                                                                                                                                                                      
                                                                                                                                                                                    
         async def emit_and_pause(                                                                                                                                                  
             self,                                                                                                                                                                  
             skill: SkillConfig,                                                                                                                                                    
             runtime_inputs: dict[str, Any],                                                                                                                                        
             step_id: str = "",                                                                                                                                                     
         ) -> AsyncIterator[dict[str, Any]]:                                                                                                                                        
             """Emit awaiting event and pause (async path for AgentExecutor).                                                                                                       
                                                                                                                                                                                    
             Yields:                                                                                                                                                                
                 Single progress dict with status="awaiting_human"                                                                                                                  
             """                                                                                                                                                                    
             event = self.build_awaiting_event(skill, runtime_inputs, step_id)                                                                                                      
             yield {                                                                                                                                                                
                 "status": "awaiting_human",                                                                                                                                        
                 "output": json.dumps(event),                                                                                                                                       
                 "error_message": "",                                                                                                                                               
                 "timestamp_ms": int(time.time() * 1000),                                                                                                                           
                 "progress_percent": 0.0,                                                                                                                                           
             }                                                                                                                                                                      
                                                                                                                                                                                    
         def emit_sync(                                                                                                                                                             
             self,                                                                                                                                                                  
             skill: SkillConfig,                                                                                                                                                    
             runtime_inputs: dict[str, Any],                                                                                                                                        
             progress_callback: Callable[[dict[str, Any]], None] | None = None,                                                                                                     
             capture_outputs: bool = False,                                                                                                                                         
             step_id: str = "",                                                                                                                                                     
         ) -> str | SkillExecutionResult:                                                                                                                                           
             """Emit awaiting event and return pause result (sync path for SkillExecutorService).                                                                                   
                                                                                                                                                                                    
             Args:                                                                                                                                                                  
                 skill: Human skill config                                                                                                                                          
                 runtime_inputs: Context provided to the human                                                                                                                      
                 progress_callback: Optional callback for streaming the event                                                                                                       
                 capture_outputs: If True, return SkillExecutionResult                                                                                                              
                                                                                                                                                                                    
             Returns:                                                                                                                                                               
                 SkillExecutionResult if capture_outputs=True, else str                                                                                                             
             """                                                                                                                                                                    
             event = self.build_awaiting_event(skill, runtime_inputs, step_id)                                                                                                      
                                                                                                                                                                                    
             if progress_callback:                                                                                                                                                  
                 progress_callback(event)                                                                                                                                           
                                                                                                                                                                                    
             result_msg = f"Awaiting human: {skill.name}"                                                                                                                           
             if capture_outputs:                                                                                                                                                    
                 return SkillExecutionResult(                                                                                                                                       
                     result=result_msg,                                                                                                                                             
                     captured_outputs=None,                                                                                                                                         
                     status="awaiting_human",                                                                                                                                       
                 )                                                                                                                                                                  
             return result_msg                                                                                                                                                      
                                                                                                                                                                                    
     1.3 ToolPreparationService - Consolidate tool loading                                                                                                                          
                                                                                                                                                                                    
     Current locations:                                                                                                                                                             
     - UnifiedToolLoader.load_tools_from_configs() - main loading                                                                                                                   
     - AgentExecutor._create_skill_agent() - loads tools for skill                                                                                                                  
     - SkillExecutorService._execute_agent() - loads tools for skill                                                                                                                
     - StepExecutorService._execute_agentic_step() - loads tools for step                                                                                                           
                                                                                                                                                                                    
     # services/tools/tool_preparation.py                                                                                                                                           
                                                                                                                                                                                    
     from pathlib import Path                                                                                                                                                       
     from typing import Any, Callable                                                                                                                                               
                                                                                                                                                                                    
     from emery_agents.tools.loader import UnifiedToolLoader                                                                                                                        
     from emery_agents.entities.skill_config import SkillConfig, StepToolConfig                                                                                                     
     from emery_agents.entities.tool_config import ToolConfig                                                                                                                       
     from emery_agents.tools.execution.skill import SkillTool                                                                                                                       
                                                                                                                                                                                    
     # Tool = Any DSPy-compatible callable with name/description                                                                                                                    
     Tool = Any  # Protocol: has name: str, description: str, __call__(**kwargs) -> str                                                                                             
                                                                                                                                                                                    
     class ToolPreparationService:                                                                                                                                                  
         """Unified tool preparation for execution.                                                                                                                                 
                                                                                                                                                                                    
         Replaces scattered tool loading in:                                                                                                                                        
         - AgentExecutor._create_skill_agent()                                                                                                                                      
         - SkillExecutorService._execute_agent()                                                                                                                                    
         - StepExecutorService._execute_agentic_step()                                                                                                                              
         """                                                                                                                                                                        
                                                                                                                                                                                    
         def __init__(self, tool_loader: UnifiedToolLoader):                                                                                                                        
             self.tool_loader = tool_loader                                                                                                                                         
                                                                                                                                                                                    
         def prepare_for_skill(                                                                                                                                                     
             self,                                                                                                                                                                  
             skill: SkillConfig,                                                                                                                                                    
             api_key: str,                                                                                                                                                          
             api_key_mode: str = "user",                                                                                                                                            
         ) -> list[Tool]:                                                                                                                                                           
             """Load tools configured for a skill.                                                                                                                                  
                                                                                                                                                                                    
             Args:                                                                                                                                                                  
                 skill: Skill config with tools: list[StepToolConfig]                                                                                                               
                 api_key: API key for authenticated tools                                                                                                                           
                 api_key_mode: "user" or "org"                                                                                                                                      
                                                                                                                                                                                    
             Returns:                                                                                                                                                               
                 List of DSPy-compatible tools                                                                                                                                      
             """                                                                                                                                                                    
             if not skill.tools:                                                                                                                                                    
                 return []                                                                                                                                                          
             return self.tool_loader.load_tools_from_configs(                                                                                                                       
                 tool_configs=list(skill.tools),  # list[StepToolConfig]                                                                                                            
                 api_key=api_key,                                                                                                                                                   
                 api_key_mode=api_key_mode,                                                                                                                                         
             )                                                                                                                                                                      
                                                                                                                                                                                    
         def prepare_from_configs(                                                                                                                                                  
             self,                                                                                                                                                                  
             tool_configs: list[ToolConfig],                                                                                                                                        
             api_key: str,                                                                                                                                                          
         ) -> list[Tool]:                                                                                                                                                           
             """Load tools from general ToolConfig list.                                                                                                                            
                                                                                                                                                                                    
             Args:                                                                                                                                                                  
                 tool_configs: List of ToolConfig (name, version, config)                                                                                                           
                 api_key: API key for authenticated tools                                                                                                                           
                                                                                                                                                                                    
             Returns:                                                                                                                                                               
                 List of DSPy-compatible tools                                                                                                                                      
             """                                                                                                                                                                    
             return self.tool_loader.load_tools(tool_configs)                                                                                                                       
                                                                                                                                                                                    
         def prepare_workspace_tools(                                                                                                                                               
             self,                                                                                                                                                                  
             workspace_path: Path,                                                                                                                                                  
         ) -> list[Tool]:                                                                                                                                                           
             """Create bash/fs tools for workspace isolation.                                                                                                                       
                                                                                                                                                                                    
             Returns:                                                                                                                                                               
                 BashTool and FilesystemTools scoped to workspace_path                                                                                                              
             """                                                                                                                                                                    
             from emery_agents.tools.execution.bash import create_bash_tool                                                                                                         
             from emery_agents.tools.execution.filesystem import create_filesystem_tools                                                                                            
                                                                                                                                                                                    
             tools = []                                                                                                                                                             
             tools.append(create_bash_tool(workspace_path))                                                                                                                         
             tools.extend(create_filesystem_tools(workspace_path))                                                                                                                  
             return tools                                                                                                                                                           
                                                                                                                                                                                    
         def create_skill_delegation_tools(                                                                                                                                         
             self,                                                                                                                                                                  
             available_skills: list[SkillConfig],                                                                                                                                   
             executor_callback: Callable[[SkillConfig, dict[str, Any], bool], Any],                                                                                                 
         ) -> list[Tool]:                                                                                                                                                           
             """Wrap skills as callable tools for delegation.                                                                                                                       
                                                                                                                                                                                    
             Args:                                                                                                                                                                  
                 available_skills: Skills that can be delegated to                                                                                                                  
                 executor_callback: Callback to execute delegated skill                                                                                                             
                     Signature: (skill_config, inputs, capture_outputs) -> result                                                                                                   
                                                                                                                                                                                    
             Returns:                                                                                                                                                               
                 List of SkillTool wrappers                                                                                                                                         
             """                                                                                                                                                                    
             return [                                                                                                                                                               
                 SkillTool(skill, executor_callback)                                                                                                                                
                 for skill in available_skills                                                                                                                                      
             ]                                                                                                                                                                      
                                                                                                                                                                                    
     1.4 Config Dataclasses - Group parameters                                                                                                                                      
                                                                                                                                                                                    
     Current parameter explosion points:                                                                                                                                            
     - PlannerModule.forward() - 13 parameters                                                                                                                                      
     - generate_plan_node() - 20+ state extractions                                                                                                                                 
     - PlanStepExecutor.__init__() - 10 parameters                                                                                                                                  
                                                                                                                                                                                    
     # entities/configs.py                                                                                                                                                          
                                                                                                                                                                                    
     from dataclasses import dataclass, field                                                                                                                                       
     from typing import Any                                                                                                                                                         
                                                                                                                                                                                    
     @dataclass(frozen=True)                                                                                                                                                        
     class AuthConfig:                                                                                                                                                              
         """Immutable authentication context.                                                                                                                                       
                                                                                                                                                                                    
         Used to replace scattered api_key/org_id/org_model parameters.                                                                                                             
         """                                                                                                                                                                        
         api_key: str                                                                                                                                                               
         org_id: int                                                                                                                                                                
         org_model: str | None = None                                                                                                                                               
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class ExecutionConfig:                                                                                                                                                         
         """Execution settings for plan step executor.                                                                                                                              
                                                                                                                                                                                    
         Replaces: api_key, org_id, org_model, max_steps in PlanStepExecutor.__init__                                                                                               
         """                                                                                                                                                                        
         auth: AuthConfig                                                                                                                                                           
         max_steps: int = 10                                                                                                                                                        
         timeout_seconds: int = 300                                                                                                                                                 
         skill_model: str | None = None                                                                                                                                             
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class PlanningContextComponents:                                                                                                                                               
         """Grouped context for PlannerModule.forward().                                                                                                                            
                                                                                                                                                                                    
         Replaces 7 separate string parameters:                                                                                                                                     
         - retrieved_capabilities, retrieved_patterns, retrieved_knowledge                                                                                                          
         - retrieved_strategies, memory_context, triage_analysis                                                                                                                    
         """                                                                                                                                                                        
         retrieved_capabilities: str = ""                                                                                                                                           
         retrieved_patterns: str = ""                                                                                                                                               
         retrieved_knowledge: str = ""                                                                                                                                              
         retrieved_strategies: str = ""                                                                                                                                             
         memory_context: str = ""                                                                                                                                                   
         triage_analysis: dict[str, Any] | None = None                                                                                                                              
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class StepPromptContext:                                                                                                                                                       
         """Context for building step execution prompts.                                                                                                                            
                                                                                                                                                                                    
         Replaces 8 parameters in _build_step_prompt()                                                                                                                              
         """                                                                                                                                                                        
         goal: str                                                                                                                                                                  
         current_step: Any  # PlanStep                                                                                                                                              
         step_index: int                                                                                                                                                            
         total_steps: int                                                                                                                                                           
         completed_steps: list[Any]  # list[PlanStep]                                                                                                                               
         remaining_steps: list[Any]  # list[PlanStep]                                                                                                                               
         resolved_prompt: str | None = None                                                                                                                                         
         original_task: str | None = None                                                                                                                                           
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Data Flow Diagrams                                                                                                                                                             
                                                                                                                                                                                    
     Current Data Flow (Tangled)                                                                                                                                                    
                                                                                                                                                                                    
     TaskRequest                                                                                                                                                                    
         ↓                                                                                                                                                                          
     AgentExecutor.determine_execution_context()                                                                                                                                    
         ↓                                                                                                                                                                          
     ExecutionContext (20+ fields, mixed concerns)                                                                                                                                  
         ↓                                                                                                                                                                          
     AgentExecutor.execute_task()                                                                                                                                                   
         ├─→ [async] yields dict[str, Any] (progress)                                                                                                                               
         ├─→ Creates OutputExtractorModule with skill_outputs                                                                                                                       
         ├─→ Calls get_dspy_lm(skill_model, org_model)                                                                                                                              
         └─→ Returns via yield                                                                                                                                                      
                                                                                                                                                                                    
     Meanwhile (sync path):                                                                                                                                                         
     SkillExecutorService.execute_skill(                                                                                                                                            
         skill_config: SkillConfig,                                                                                                                                                 
         runtime_inputs: dict[str, Any],                                                                                                                                            
         org_model: str | None,                                                                                                                                                     
         capture_outputs: bool,                                                                                                                                                     
         ...7 more params...                                                                                                                                                        
     ) -> str | SkillExecutionResult                                                                                                                                                
         ├─→ Creates OutputExtractorModule (DUPLICATE)                                                                                                                              
         ├─→ Calls get_dspy_lm() (DUPLICATE)                                                                                                                                        
         └─→ Returns SkillExecutionResult                                                                                                                                           
                                                                                                                                                                                    
     Target Data Flow (Clean)                                                                                                                                                       
                                                                                                                                                                                    
     Request comes in                                                                                                                                                               
         ↓                                                                                                                                                                          
     ExecutionRouter.route()                                                                                                                                                        
         ↓                                                                                                                                                                          
     Mode-specific request type created:                                                                                                                                            
         InteractiveRequest | SkillRequest | WorkflowRequest | CoordinatorRequest                                                                                                   
         (Each contains only fields needed for that mode)                                                                                                                           
         ↓                                                                                                                                                                          
     Mode-specific executor called:                                                                                                                                                 
         InteractiveExecutor | AgenticExecutor | WorkflowOrchestrator | CoordinatorExecutor                                                                                         
         ↓                                                                                                                                                                          
     Shared services used:                                                                                                                                                          
         ├─→ OutputPipeline.extract_outputs()                                                                                                                                       
         │       Input: content: str, skill_outputs: list[OutputDefinition]                                                                                                         
         │       Output: dict[str, Any]                                                                                                                                             
         │                                                                                                                                                                          
         ├─→ OutputPipeline.coerce_values()                                                                                                                                         
         │       Input: values: dict[str, Any], field_metadata: dict[str, TargetFieldMeta]                                                                                          
         │       Output: dict[str, Any]                                                                                                                                             
         │                                                                                                                                                                          
         ├─→ OutputPipeline.write_to_table()                                                                                                                                        
         │       Input: outputs: dict[str, Any], write_config: WriteConfig                                                                                                          
         │       Output: None (side effect)                                                                                                                                         
         │                                                                                                                                                                          
         ├─→ HumanSkillHandler.emit_and_pause() [async]                                                                                                                             
         │       Input: skill: SkillConfig, runtime_inputs: dict[str, Any]                                                                                                          
         │       Output: AsyncIterator[dict[str, Any]]                                                                                                                              
         │                                                                                                                                                                          
         └─→ ToolPreparationService.prepare_for_skill()                                                                                                                             
                 Input: skill: SkillConfig, api_key: str                                                                                                                            
                 Output: list[Tool]                                                                                                                                                 
         ↓                                                                                                                                                                          
     Result returned:                                                                                                                                                               
         [async] AsyncIterator[dict[str, Any]] (progress)                                                                                                                           
         [sync] SkillExecutionResult                                                                                                                                                
                                                                                                                                                                                    
     Phase 2: Separate by Mode (Medium Risk)                                                                                                                                        
                                                                                                                                                                                    
     Consolidate the 4 execution modes into clear, focused executors.                                                                                                               
                                                                                                                                                                                    
     Current Execution Flow (Tangled)                                                                                                                                               
     Request comes in                                                                                                                                                               
         ↓                                                                                                                                                                          
     AgentExecutor.execute_task()                                                                                                                                                   
         ├─→ use_coordinator? → _execute_with_coordinator() [LangGraph]                                                                                                             
         ├─→ is_interactive? → _create_direct_execution_agent() [DSPy ReAct]                                                                                                        
         └─→ is_autonomous?                                                                                                                                                         
             ├─→ is_human_skill? → _handle_human_skill_execution()                                                                                                                  
             ├─→ is_agent_skill? → _execute_step_skill()                                                                                                                            
             │                         ↓                                                                                                                                            
             │                    StepExecutorService.execute_steps()                                                                                                               
             │                         ↓                                                                                                                                            
             │                    (routes to 5 step handlers internally)                                                                                                            
             └─→ else → _create_skill_agent() [DSPy ReAct]                                                                                                                          
                                                                                                                                                                                    
     Meanwhile, chat streaming uses:                                                                                                                                                
     SkillExecutorService.execute_skill()                                                                                                                                           
         ├─→ is_human_skill? → _handle_human_skill() [DUPLICATE]                                                                                                                    
         ├─→ is_workflow? → _execute_steps()                                                                                                                                        
         │                      ↓                                                                                                                                                   
         │                 StepExecutorService.execute_steps()                                                                                                                      
         ├─→ has_stored_plan? → _execute_agentic()                                                                                                                                  
         │                          ↓                                                                                                                                               
         │                     StepExecutorService + wrapper DAG                                                                                                                    
         └─→ else → _execute_agent() [DSPy ReAct] [DUPLICATE]                                                                                                                       
                                                                                                                                                                                    
     Target Execution Flow (Clean)                                                                                                                                                  
     Request comes in                                                                                                                                                               
         ↓                                                                                                                                                                          
     ExecutionRouter.route(request)                                                                                                                                                 
         ├─→ mode=INTERACTIVE → InteractiveExecutor                                                                                                                                 
         ├─→ mode=COORDINATOR → CoordinatorExecutor                                                                                                                                 
         └─→ mode=AUTONOMOUS                                                                                                                                                        
             ├─→ skill.is_human_skill → HumanSkillHandler                                                                                                                           
             ├─→ skill.is_workflow → WorkflowExecutor                                                                                                                               
             └─→ else → AgenticExecutor                                                                                                                                             
                                                                                                                                                                                    
     All executors share:                                                                                                                                                           
     - OutputPipeline (extraction, coercion, write)                                                                                                                                 
     - HumanSkillHandler (pause events)                                                                                                                                             
     - ToolPreparationService (tool loading)                                                                                                                                        
                                                                                                                                                                                    
     2.1 Create Mode-Specific Executors                                                                                                                                             
     ┌─────────────────────┬────────────────────────────────────┬───────────────────────────────────────────┐                                                                       
     │      Executor       │           Responsibility           │              Current Source               │                                                                       
     ├─────────────────────┼────────────────────────────────────┼───────────────────────────────────────────┤                                                                       
     │ InteractiveExecutor │ Single-turn instruction with tools │ AgentExecutor lines 414-463               │                                                                       
     ├─────────────────────┼────────────────────────────────────┼───────────────────────────────────────────┤                                                                       
     │ AgenticExecutor     │ Skill with LLM orchestration       │ SkillExecutorService._execute_agent()     │                                                                       
     ├─────────────────────┼────────────────────────────────────┼───────────────────────────────────────────┤                                                                       
     │ WorkflowExecutor    │ DAG step orchestration             │ StepExecutorService (slim)                │                                                                       
     ├─────────────────────┼────────────────────────────────────┼───────────────────────────────────────────┤                                                                       
     │ CoordinatorExecutor │ Two-phase plan→approve→execute     │ AgentExecutor._execute_with_coordinator() │                                                                       
     └─────────────────────┴────────────────────────────────────┴───────────────────────────────────────────┘                                                                       
     2.2 Simplify ExecutionContext                                                                                                                                                  
                                                                                                                                                                                    
     Current (20+ fields):                                                                                                                                                          
     ExecutionContext(                                                                                                                                                              
         mode, task, available_tools,                                                                                                                                               
         images, attachments, session_attachments,                                                                                                                                  
         agent_id, organization_id, skill_name,                                                                                                                                     
         max_steps, timeout_seconds,                                                                                                                                                
         skill, available_skills,                                                                                                                                                   
         agent_model, org_model,                                                                                                                                                    
         output_tool, environment, skill_inputs,                                                                                                                                    
         source_row_id, use_coordinator, tool_mode,                                                                                                                                 
         resolved_context, progress_callback,                                                                                                                                       
         tool_provider, plan, workspace_path                                                                                                                                        
     )                                                                                                                                                                              
                                                                                                                                                                                    
     Actual entity types from codebase:                                                                                                                                             
     # From entities/skill_config.py                                                                                                                                                
     @dataclass                                                                                                                                                                     
     class SkillConfig:                                                                                                                                                             
         id: int                                                                                                                                                                    
         name: str                                                                                                                                                                  
         tools: list[StepToolConfig]  # NOT list[str]!                                                                                                                              
         inputs: list[InputDefinition]                                                                                                                                              
         outputs: list[OutputDefinition]                                                                                                                                            
         steps: list[SkillStep]                                                                                                                                                     
         human_skill_config: HumanSkillConfig | None                                                                                                                                
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class StepToolConfig:                                                                                                                                                          
         name: str                                                                                                                                                                  
         tool_type: str = "pipedream"                                                                                                                                               
         config: dict[str, Any]                                                                                                                                                     
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class SkillStep:                                                                                                                                                               
         id: str                                                                                                                                                                    
         name: str                                                                                                                                                                  
         step_type: str                                                                                                                                                             
         read_config: ReadConfig | None                                                                                                                                             
         write_config: WriteConfig | None                                                                                                                                           
         agentic_config: AgenticStepConfig | None                                                                                                                                   
         # ... etc                                                                                                                                                                  
                                                                                                                                                                                    
     # From entities/tool_config.py                                                                                                                                                 
     @dataclass                                                                                                                                                                     
     class ToolConfig:                                                                                                                                                              
         name: str                                                                                                                                                                  
         version: str                                                                                                                                                               
         config: dict[str, Any]                                                                                                                                                     
                                                                                                                                                                                    
     # From entities/message.py                                                                                                                                                     
     @dataclass                                                                                                                                                                     
     class ImageAttachment:                                                                                                                                                         
         url: str                                                                                                                                                                   
         s3_key: str = ""                                                                                                                                                           
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class FileAttachment:                                                                                                                                                          
         type: str = ""                                                                                                                                                             
         url: str = ""                                                                                                                                                              
         filename: str = ""                                                                                                                                                         
         mime_type: str = ""                                                                                                                                                        
                                                                                                                                                                                    
     # From entities/models/context_mapping.py                                                                                                                                      
     @dataclass                                                                                                                                                                     
     class ResolvedContext:                                                                                                                                                         
         # Context table mappings with hierarchy priority                                                                                                                           
         ...                                                                                                                                                                        
                                                                                                                                                                                    
     Target (split by concern, using actual types):                                                                                                                                 
     # services/execution/contexts.py                                                                                                                                               
                                                                                                                                                                                    
     from emery_agents.entities.skill_config import SkillConfig, SkillStep                                                                                                          
     from emery_agents.entities.tool_config import ToolConfig                                                                                                                       
     from emery_agents.entities.message import ImageAttachment, FileAttachment                                                                                                      
     from emery_agents.entities.models.context_mapping import ResolvedContext                                                                                                       
     from emery_agents.entities.models.plan import Plan                                                                                                                             
                                                                                                                                                                                    
     @dataclass(frozen=True)                                                                                                                                                        
     class AuthContext:                                                                                                                                                             
         """Immutable auth context - set once per request."""                                                                                                                       
         api_key: str                                                                                                                                                               
         org_id: int                                                                                                                                                                
         agent_id: int | None = None                                                                                                                                                
         org_model: str | None = None  # Organization default model                                                                                                                 
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class InteractiveRequest:                                                                                                                                                      
         """Request for instruction-based execution (chat direct commands)."""                                                                                                      
         task: str                                                                                                                                                                  
         tools: list[ToolConfig]  # Tool configs, not names                                                                                                                         
         auth: AuthContext                                                                                                                                                          
         images: list[ImageAttachment] = field(default_factory=list)                                                                                                                
         attachments: list[FileAttachment] = field(default_factory=list)                                                                                                            
         skill_model: str | None = None  # Override model                                                                                                                           
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class SkillRequest:                                                                                                                                                            
         """Request for skill-based execution (automations, triggers)."""                                                                                                           
         skill: SkillConfig  # Full skill config with tools, steps, etc.                                                                                                            
         inputs: dict[str, Any]  # Runtime inputs from trigger                                                                                                                      
         auth: AuthContext                                                                                                                                                          
         resolved_context: ResolvedContext | None = None                                                                                                                            
         available_skills: list[SkillConfig] = field(default_factory=list)  # For delegation                                                                                        
         source_row_id: int | None = None  # Row that triggered execution                                                                                                           
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class WorkflowRequest:                                                                                                                                                         
         """Request for DAG workflow execution."""                                                                                                                                  
         steps: list[SkillStep]  # Full step configs                                                                                                                                
         initial_inputs: dict[str, Any]                                                                                                                                             
         auth: AuthContext                                                                                                                                                          
         available_skills: dict[int, SkillConfig] = field(default_factory=dict)  # For delegation                                                                                   
         org_model: str | None = None                                                                                                                                               
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class CoordinatorRequest:                                                                                                                                                      
         """Request for two-phase plan-execute execution."""                                                                                                                        
         goal: str                                                                                                                                                                  
         tools: list[ToolConfig]                                                                                                                                                    
         auth: AuthContext                                                                                                                                                          
         plan: Plan | None = None  # For resume with existing plan                                                                                                                  
         workspace_context: Any | None = None  # Workspace data for templates                                                                                                       
                                                                                                                                                                                    
     2.3 Break Apart StepExecutorService                                                                                                                                            
                                                                                                                                                                                    
     Key types to preserve:                                                                                                                                                         
     # From step_executor.py lines 114-170                                                                                                                                          
     @dataclass                                                                                                                                                                     
     class StepProgress:                                                                                                                                                            
         """Progress update for a single step in a step-based workflow."""                                                                                                          
         step: int          # Current step number (1-indexed)                                                                                                                       
         total: int         # Total steps                                                                                                                                           
         id: str            # Step UUID for context keying                                                                                                                          
         name: str          # Display name                                                                                                                                          
         status: Literal["pending", "running", "completed", "failed", "skipped"]                                                                                                    
         result: str | None = None                                                                                                                                                  
         captured_data: dict[str, Any] | None = None  # Per-output data                                                                                                             
         error: str | None = None                                                                                                                                                   
         continued_after_error: bool = False                                                                                                                                        
         retries_attempted: int = 0                                                                                                                                                 
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class StepError:                                                                                                                                                               
         """Error details for storing in step context."""                                                                                                                           
         message: str                                                                                                                                                               
         error_type: str                                                                                                                                                            
         step_name: str                                                                                                                                                             
         timestamp: float                                                                                                                                                           
         retries_attempted: int = 0                                                                                                                                                 
                                                                                                                                                                                    
     @dataclass                                                                                                                                                                     
     class Step:                                                                                                                                                                    
         """Internal representation of a workflow step."""                                                                                                                          
         id: str                                                                                                                                                                    
         name: str                                                                                                                                                                  
         instruction: str = ""                                                                                                                                                      
         skill_id: int = 0                                                                                                                                                          
         tools: list[str] = field(default_factory=list)                                                                                                                             
         inputs: dict[str, str] = field(default_factory=dict)                                                                                                                       
         outputs: dict[str, str] = field(default_factory=dict)                                                                                                                      
         condition: str = ""                                                                                                                                                        
         # ... plus configs for each step type                                                                                                                                      
                                                                                                                                                                                    
     Current structure (1,725 lines, 8+ responsibilities):                                                                                                                          
     StepExecutorService                                                                                                                                                            
     ├── execute_steps() - main entry, DAG traversal                                                                                                                                
     ├── _evaluate_condition() - simpleeval-based condition evaluation                                                                                                              
     ├── _execute_loop() - loop iteration with LoopConfig                                                                                                                           
     ├── _retry_with_backoff() - tenacity-based retry                                                                                                                               
     ├── _execute_skill_step() - skill delegation via callback                                                                                                                      
     ├── _execute_inline_step() - LLM instruction execution                                                                                                                         
     ├── _execute_read_step() - TableAPI read                                                                                                                                       
     ├── _execute_write_step() - TableAPI write                                                                                                                                     
     ├── _execute_tool_step() - direct tool call                                                                                                                                    
     └── _execute_agentic_step() - plan execution via PlanStepExecutor                                                                                                              
                                                                                                                                                                                    
     Target structure:                                                                                                                                                              
     services/execution/workflow/                                                                                                                                                   
     ├── orchestrator.py         # DAG traversal (300 lines)                                                                                                                        
     │   class WorkflowOrchestrator:                                                                                                                                                
     │       async def execute(                                                                                                                                                     
     │           steps: list[SkillStep],                                                                                                                                            
     │           available_skills: dict[int, SkillConfig],                                                                                                                          
     │           initial_inputs: dict[str, Any],                                                                                                                                    
     │           org_model: str | None,                                                                                                                                             
     │           api_key: str,                                                                                                                                                      
     │           organization_id: int,                                                                                                                                              
     │       ) -> AsyncIterator[StepProgress]:                                                                                                                                      
     │           """Yields StepProgress as each step executes."""                                                                                                                   
     │                                                                                                                                                                              
     ├── condition.py            # Condition evaluation (100 lines)                                                                                                                 
     │   class ConditionEvaluator:                                                                                                                                                  
     │       def evaluate(condition: str, context: dict[str, Any]) -> bool:                                                                                                         
     │           """Uses simpleeval with {{var}} → var conversion."""                                                                                                               
     │                                                                                                                                                                              
     ├── loop.py                 # Loop handling (150 lines)                                                                                                                        
     │   class LoopExecutor:                                                                                                                                                        
     │       async def execute_loop(                                                                                                                                                
     │           config: LoopConfig,                                                                                                                                                
     │           step_handler: Callable,                                                                                                                                            
     │           context: dict[str, Any],                                                                                                                                           
     │       ) -> list[Any]:                                                                                                                                                        
     │           """Execute step repeatedly based on loop config."""                                                                                                                
     │                                                                                                                                                                              
     ├── retry.py                # Retry logic (100 lines)                                                                                                                          
     │   class RetryHandler:                                                                                                                                                        
     │       async def with_retry(                                                                                                                                                  
     │           fn: Callable,                                                                                                                                                      
     │           config: RetryConfig,                                                                                                                                               
     │       ) -> tuple[Any, int]:                                                                                                                                                  
     │           """Returns (result, retries_attempted)."""                                                                                                                         
     │           # Uses tenacity with _is_retryable_error                                                                                                                           
     │                                                                                                                                                                              
     └── handlers/               # Step type handlers (Protocol-based)                                                                                                              
         ├── base.py                                                                                                                                                                
         │   class StepHandler(Protocol):                                                                                                                                           
         │       async def execute(                                                                                                                                                 
         │           self,                                                                                                                                                          
         │           step: Step,                                                                                                                                                    
         │           context: dict[str, Any],                                                                                                                                       
         │           **kwargs,                                                                                                                                                      
         │       ) -> Any: ...                                                                                                                                                      
         │                                                                                                                                                                          
         ├── skill.py            # Skill delegation                                                                                                                                 
         │   class SkillStepHandler:                                                                                                                                                
         │       def __init__(self, executor_callback: Callable): ...                                                                                                               
         │       async def execute(...) -> SkillExecutionResult                                                                                                                     
         │                                                                                                                                                                          
         ├── inline.py           # LLM instruction                                                                                                                                  
         │   class InlineStepHandler:                                                                                                                                               
         │       def __init__(self, agent_factory: AgentFactory): ...                                                                                                               
         │       async def execute(...) -> str                                                                                                                                      
         │                                                                                                                                                                          
         ├── read.py             # Table read                                                                                                                                       
         │   class ReadStepHandler:                                                                                                                                                 
         │       async def execute(...) -> dict[str, Any]                                                                                                                           
         │                                                                                                                                                                          
         ├── write.py            # Table write                                                                                                                                      
         │   class WriteStepHandler:                                                                                                                                                
         │       async def execute(...) -> dict[str, Any]                                                                                                                           
         │                                                                                                                                                                          
         ├── tool.py             # Direct tool call                                                                                                                                 
         │   class ToolStepHandler:                                                                                                                                                 
         │       def __init__(self, tool_loader: UnifiedToolLoader): ...                                                                                                            
         │       async def execute(...) -> str                                                                                                                                      
         │                                                                                                                                                                          
         └── agentic.py          # Plan execution                                                                                                                                   
             class AgenticStepHandler:                                                                                                                                              
                 def __init__(self, plan_step_executor_factory: Callable): ...                                                                                                      
                 async def execute(...) -> str                                                                                                                                      
                                                                                                                                                                                    
     Phase 3: Unified Orchestration (Higher Risk)                                                                                                                                   
                                                                                                                                                                                    
     Create single entry point that routes to appropriate executor.                                                                                                                 
                                                                                                                                                                                    
     3.1 ExecutionRouter - Single entry point                                                                                                                                       
     # services/execution/router.py                                                                                                                                                 
                                                                                                                                                                                    
     class ExecutionRouter:                                                                                                                                                         
         """Routes execution requests to appropriate executor.                                                                                                                      
                                                                                                                                                                                    
         Replaces: AgentExecutor + SkillExecutorService routing logic.                                                                                                              
         """                                                                                                                                                                        
                                                                                                                                                                                    
         def __init__(                                                                                                                                                              
             self,                                                                                                                                                                  
             interactive: InteractiveExecutor,                                                                                                                                      
             agentic: AgenticExecutor,                                                                                                                                              
             workflow: WorkflowOrchestrator,                                                                                                                                        
             coordinator: CoordinatorExecutor,                                                                                                                                      
             human_handler: HumanSkillHandler,                                                                                                                                      
         ):                                                                                                                                                                         
             self.executors = {                                                                                                                                                     
                 "interactive": interactive,                                                                                                                                        
                 "agentic": agentic,                                                                                                                                                
                 "workflow": workflow,                                                                                                                                              
                 "coordinator": coordinator,                                                                                                                                        
             }                                                                                                                                                                      
             self.human_handler = human_handler                                                                                                                                     
                                                                                                                                                                                    
         async def execute(                                                                                                                                                         
             self,                                                                                                                                                                  
             request: ExecutionRequest,                                                                                                                                             
         ) -> AsyncIterator[ExecutionProgress]:                                                                                                                                     
             """Route and execute request."""                                                                                                                                       
                                                                                                                                                                                    
             # Handle human skills separately (they pause, not execute)                                                                                                             
             if request.skill and request.skill.is_human_skill():                                                                                                                   
                 async for event in self.human_handler.emit_and_pause(                                                                                                              
                     request.skill, request.inputs                                                                                                                                  
                 ):                                                                                                                                                                 
                     yield event                                                                                                                                                    
                 return                                                                                                                                                             
                                                                                                                                                                                    
             # Route to appropriate executor                                                                                                                                        
             executor = self._get_executor(request)                                                                                                                                 
             async for progress in executor.execute(request):                                                                                                                       
                 yield progress                                                                                                                                                     
                                                                                                                                                                                    
         def _get_executor(self, request: ExecutionRequest) -> BaseExecutor:                                                                                                        
             if request.use_coordinator:                                                                                                                                            
                 return self.executors["coordinator"]                                                                                                                               
             if request.skill:                                                                                                                                                      
                 if request.skill.is_workflow():                                                                                                                                    
                     return self.executors["workflow"]                                                                                                                              
                 return self.executors["agentic"]                                                                                                                                   
             return self.executors["interactive"]                                                                                                                                   
                                                                                                                                                                                    
     3.2 Migration Strategy                                                                                                                                                         
                                                                                                                                                                                    
     Step 1: Create ExecutionRouter alongside existing code                                                                                                                         
     Step 2: Have AgentExecutor delegate to ExecutionRouter                                                                                                                         
     Step 3: Have SkillExecutorService delegate to ExecutionRouter                                                                                                                  
     Step 4: Update entry points to use ExecutionRouter directly                                                                                                                    
     Step 5: Remove AgentExecutor and SkillExecutorService                                                                                                                          
                                                                                                                                                                                    
     3.3 Deprecation Path                                                                                                                                                           
     # During migration, old classes become thin wrappers:                                                                                                                          
                                                                                                                                                                                    
     class AgentExecutor:                                                                                                                                                           
         """DEPRECATED: Use ExecutionRouter directly."""                                                                                                                            
                                                                                                                                                                                    
         def __init__(self, router: ExecutionRouter = None):                                                                                                                        
             self._router = router or get_default_router()                                                                                                                          
             warnings.warn(                                                                                                                                                         
                 "AgentExecutor is deprecated. Use ExecutionRouter.",                                                                                                               
                 DeprecationWarning                                                                                                                                                 
             )                                                                                                                                                                      
                                                                                                                                                                                    
         async def execute_task(self, context: ExecutionContext):                                                                                                                   
             request = ExecutionRequest.from_legacy_context(context)                                                                                                                
             async for progress in self._router.execute(request):                                                                                                                   
                 yield progress                                                                                                                                                     
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     File-by-File Changes                                                                                                                                                           
                                                                                                                                                                                    
     Phase 1 Files to Create                                                                                                                                                        
     ┌─────────────────────────────────────────┬────────────────────────────────────────────┬─────────────────────────────────────┐                                                 
     │                  File                   │                  Purpose                   │            Extracts From            │                                                 
     ├─────────────────────────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────┤                                                 
     │ services/execution/output_pipeline.py   │ Output extraction + coercion + write       │ AgentExecutor, SkillExecutorService │                                                 
     ├─────────────────────────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────┤                                                 
     │ services/execution/template_resolver.py │ Prompt template resolution                 │ PlanStepExecutor                    │                                                 
     ├─────────────────────────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────┤                                                 
     │ services/tools/tool_factory.py          │ Tool creation and loading                  │ UnifiedToolLoader, executors        │                                                 
     ├─────────────────────────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────┤                                                 
     │ entities/configs.py                     │ ExecutionConfig, PlanningContextComponents │ Inline in methods                   │                                                 
     └─────────────────────────────────────────┴────────────────────────────────────────────┴─────────────────────────────────────┘                                                 
     Phase 2 Files to Create                                                                                                                                                        
     ┌─────────────────────────────────────────────┬────────────────────┬─────────────┐                                                                                             
     │                    File                     │      Purpose       │ Lines (est) │                                                                                             
     ├─────────────────────────────────────────────┼────────────────────┼─────────────┤                                                                                             
     │ services/execution/interactive_executor.py  │ Instruction mode   │ ~200        │                                                                                             
     ├─────────────────────────────────────────────┼────────────────────┼─────────────┤                                                                                             
     │ services/execution/agentic_executor.py      │ Agentic skills     │ ~300        │                                                                                             
     ├─────────────────────────────────────────────┼────────────────────┼─────────────┤                                                                                             
     │ services/execution/workflow_orchestrator.py │ DAG coordination   │ ~400        │                                                                                             
     ├─────────────────────────────────────────────┼────────────────────┼─────────────┤                                                                                             
     │ services/execution/step_handlers/*.py       │ Step type handlers │ ~100 each   │                                                                                             
     ├─────────────────────────────────────────────┼────────────────────┼─────────────┤                                                                                             
     │ services/execution/loop_executor.py         │ Loop logic         │ ~150        │                                                                                             
     ├─────────────────────────────────────────────┼────────────────────┼─────────────┤                                                                                             
     │ services/execution/retry_handler.py         │ Retry/backoff      │ ~100        │                                                                                             
     └─────────────────────────────────────────────┴────────────────────┴─────────────┘                                                                                             
     Files to Refactor                                                                                                                                                              
     ┌───────────────────────┬───────────────┬──────────────┬─────────────────────────────┐                                                                                         
     │         File          │ Current Lines │ Target Lines │           Change            │                                                                                         
     ├───────────────────────┼───────────────┼──────────────┼─────────────────────────────┤                                                                                         
     │ step_executor.py      │ 1,725         │ ~400         │ Extract 5+ classes          │                                                                                         
     ├───────────────────────┼───────────────┼──────────────┼─────────────────────────────┤                                                                                         
     │ agents/executor.py    │ 1,341         │ ~500         │ Extract mode logic          │                                                                                         
     ├───────────────────────┼───────────────┼──────────────┼─────────────────────────────┤                                                                                         
     │ skills/executor.py    │ 1,089         │ ~300         │ Extract to agentic/workflow │                                                                                         
     ├───────────────────────┼───────────────┼──────────────┼─────────────────────────────┤                                                                                         
     │ plan_step_executor.py │ 708           │ ~400         │ Extract template/output     │                                                                                         
     └───────────────────────┴───────────────┴──────────────┴─────────────────────────────┘                                                                                         
     ---                                                                                                                                                                            
     Execution Order                                                                                                                                                                
                                                                                                                                                                                    
     Phase 1 (can do incrementally, low risk):                                                                                                                                      
       1.1 Extract OutputPipeline                                                                                                                                                   
       1.2 Extract TemplateResolver                                                                                                                                                 
       1.3 Extract ToolFactory                                                                                                                                                      
       1.4 Create config dataclasses                                                                                                                                                
                                                                                                                                                                                    
     Phase 2 (after Phase 1, requires more testing):                                                                                                                                
       2.1 Create mode-specific executors (start with InteractiveExecutor)                                                                                                          
       2.2 Break apart StepExecutorService                                                                                                                                          
       2.3 Create mode-specific contexts                                                                                                                                            
                                                                                                                                                                                    
     Phase 3 (after Phase 2 stable):                                                                                                                                                
       3.1 Create ExecutionOrchestrator                                                                                                                                             
       3.2 Migrate entry points                                                                                                                                                     
       3.3 Deprecate old executors                                                                                                                                                  
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Quick Wins (Can Do Now)                                                                                                                                                        
                                                                                                                                                                                    
     1. Extract directive strings into constants:                                                                                                                                   
       - orchestrators/nodes/planning.py:424-441 → DIRECTIVE_PRE_SELECTED_SKILL                                                                                                     
     2. Simplify _is_low_risk_plan() - Extract policy handlers:                                                                                                                     
     POLICY_HANDLERS = {                                                                                                                                                            
         "explicit": _handle_explicit_policy,                                                                                                                                       
         "auto": _handle_auto_policy,                                                                                                                                               
         "confirm": _handle_confirm_policy,                                                                                                                                         
     }                                                                                                                                                                              
     3. Fix type checking cascade in human.py:168-224:                                                                                                                              
     def _parse_human_response(response) -> tuple[dict, str | None]:                                                                                                                
         """Unified parsing for human skill responses."""                                                                                                                           
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Async/Sync Boundary Pattern                                                                                                                                                    
                                                                                                                                                                                    
     The codebase uses run_async_in_thread() to bridge async generators to sync callers:                                                                                            
                                                                                                                                                                                    
     # Current pattern in step_executor.py lines 1681-1726                                                                                                                          
     def execute_steps_sync(                                                                                                                                                        
         step_executor: StepExecutorService,                                                                                                                                        
         steps: list[SkillStep],                                                                                                                                                    
         available_skills: dict[int, SkillConfig],                                                                                                                                  
         initial_inputs: dict[str, Any],                                                                                                                                            
         org_model: str | None = None,                                                                                                                                              
         api_key: str = "",                                                                                                                                                         
         organization_id: int = 0,                                                                                                                                                  
     ) -> SkillExecutionResult:                                                                                                                                                     
         """Synchronous wrapper - collects all StepProgress, returns final result."""                                                                                               
                                                                                                                                                                                    
         async def collect_results():                                                                                                                                               
             results = []                                                                                                                                                           
             final_result = None                                                                                                                                                    
             async for progress in step_executor.execute_steps(...):                                                                                                                
                 results.append(progress)                                                                                                                                           
                 if progress.status == "completed":                                                                                                                                 
                     final_result = progress.result                                                                                                                                 
             return results, final_result                                                                                                                                           
                                                                                                                                                                                    
         results, final_result = run_async_in_thread(collect_results())                                                                                                             
         # ... build captured_outputs from results                                                                                                                                  
         return SkillExecutionResult(result=final_result, captured_outputs=captured_outputs)                                                                                        
                                                                                                                                                                                    
     Important: This pattern must be preserved in the refactored code:                                                                                                              
     - WorkflowOrchestrator.execute() → async generator yielding StepProgress                                                                                                       
     - execute_workflow_sync() → sync wrapper using run_async_in_thread()                                                                                                           
                                                                                                                                                                                    
     Entry points:                                                                                                                                                                  
     - Async (AgentExecutor.execute_task): Iterates async generator directly                                                                                                        
     - Sync (SkillExecutorService.execute_skill): Uses sync wrapper                                                                                                                 
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Summary: Before vs After                                                                                                                                                       
                                                                                                                                                                                    
     Before (Current State)                                                                                                                                                         
                                                                                                                                                                                    
     4 executor classes with overlapping responsibilities:                                                                                                                          
     ├── AgentExecutor (1,341 lines) - routes to 4 paths                                                                                                                            
     ├── SkillExecutorService (1,089 lines) - routes to 4 paths (2 duplicate)                                                                                                       
     ├── StepExecutorService (1,725 lines) - handles 8+ concerns                                                                                                                    
     └── PlanStepExecutor (708 lines) - single step execution                                                                                                                       
                                                                                                                                                                                    
     Problems:                                                                                                                                                                      
     - Human skill handling duplicated                                                                                                                                              
     - Output extraction duplicated                                                                                                                                                 
     - Skill routing duplicated                                                                                                                                                     
     - ExecutionContext has 20+ fields                                                                                                                                              
     - StepExecutorService is a god class                                                                                                                                           
     - 4,863 total lines across executors                                                                                                                                           
                                                                                                                                                                                    
     After (Target State)                                                                                                                                                           
                                                                                                                                                                                    
     Clean separation by concern:                                                                                                                                                   
     ├── ExecutionRouter (100 lines) - routes requests                                                                                                                              
     ├── InteractiveExecutor (200 lines) - single-turn                                                                                                                              
     ├── AgenticExecutor (300 lines) - LLM + tools                                                                                                                                  
     ├── WorkflowOrchestrator (300 lines) - DAG traversal                                                                                                                           
     ├── CoordinatorExecutor (400 lines) - two-phase                                                                                                                                
     ├── HumanSkillHandler (100 lines) - pause events                                                                                                                               
     ├── OutputPipeline (200 lines) - extract/coerce/write                                                                                                                          
     ├── ToolPreparationService (150 lines) - tool loading                                                                                                                          
     ├── Step handlers (5 × 100 lines) - typed step execution                                                                                                                       
     └── Retry/Loop/Condition (350 lines) - workflow utilities                                                                                                                      
                                                                                                                                                                                    
     Benefits:                                                                                                                                                                      
     - No duplication                                                                                                                                                               
     - Single responsibility per class                                                                                                                                              
     - Mode-specific request types (not god object)                                                                                                                                 
     - ~2,600 total lines (46% reduction)                                                                                                                                           
     - Each file <400 lines                                                                                                                                                         
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Execution Order                                                                                                                                                                
     ┌───────┬─────────────────────────────────┬────────┬──────────────┐                                                                                                            
     │ Phase │              Scope              │  Risk  │ Dependencies │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 1.1   │ OutputPipeline                  │ Low    │ None         │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 1.2   │ HumanSkillHandler               │ Low    │ None         │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 1.3   │ ToolPreparationService          │ Low    │ None         │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 1.4   │ Config dataclasses              │ Low    │ None         │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 2.1   │ Mode-specific executors         │ Medium │ Phase 1      │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 2.2   │ Simplified contexts             │ Medium │ Phase 1      │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 2.3   │ Break apart StepExecutorService │ Medium │ 1.1, 1.3     │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 3.1   │ ExecutionRouter                 │ Higher │ Phase 2      │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 3.2   │ Migration                       │ Higher │ 3.1          │                                                                                                            
     ├───────┼─────────────────────────────────┼────────┼──────────────┤                                                                                                            
     │ 3.3   │ Deprecation                     │ Higher │ 3.2          │                                                                                                            
     └───────┴─────────────────────────────────┴────────┴──────────────┘                                                                                                            
     Recommended starting point: Phase 1.1 (OutputPipeline) - immediate deduplication win with zero risk to existing code.                                                          
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Verification                                                                                                                                                                   
                                                                                                                                                                                    
     After each phase:                                                                                                                                                              
     1. Run existing tests: pytest emery-agents/                                                                                                                                    
     2. Run typecheck: pyright emery-agents/                                                                                                                                        
     3. Manual test: trigger skill execution via chat                                                                                                                               
     4. Manual test: trigger workflow execution                                                                                                                                     
     5. Manual test: trigger automation (background task)                                                                                                                           
                                                                                                                                                                                    
     ---                                                                                                                                                                            
     Files to Modify (Phase 1)                                                                                                                                                      
     ┌───────────────────────────────────────────┬─────────────────┬────────────────┐                                                                                               
     │                   File                    │     Action      │ Lines Affected │                                                                                               
     ├───────────────────────────────────────────┼─────────────────┼────────────────┤                                                                                               
     │ services/execution/output_pipeline.py     │ Create          │ 200 new        │                                                                                               
     ├───────────────────────────────────────────┼─────────────────┼────────────────┤                                                                                               
     │ services/execution/human_skill_handler.py │ Create          │ 100 new        │                                                                                               
     ├───────────────────────────────────────────┼─────────────────┼────────────────┤                                                                                               
     │ services/tools/tool_preparation.py        │ Create          │ 150 new        │                                                                                               
     ├───────────────────────────────────────────┼─────────────────┼────────────────┤                                                                                               
     │ entities/configs.py                       │ Create          │ 80 new         │                                                                                               
     ├───────────────────────────────────────────┼─────────────────┼────────────────┤                                                                                               
     │ services/skills/executor.py               │ Import pipeline │ -150           │                                                                                               
     ├───────────────────────────────────────────┼─────────────────┼────────────────┤                                                                                               
     │ services/agents/executor.py               │ Import handler  │ -60            │                                                                                               
     ├───────────────────────────────────────────┼─────────────────┼────────────────┤                                                                                               
     │ services/execution/plan_step_executor.py  │ Import pipeline │ -50            │                                                                                               
     └───────────────────────────────────────────┴─────────────────┴────────────────┘                                                                                               
                                                                                         
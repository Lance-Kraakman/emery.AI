# Copyright (c) 2025 AI Factory Ltd. All rights reserved.
# SPDX-License-Identifier: Proprietary

import uuid
from typing import Dict, Any, List, Optional
from analysis_engine_v2.models import ConsultationAnalysisResult, QuestionType, TopicAnalysisResult, QuestionAnalysisResult, DebateAnalysisResult

def generate_text_component(text: str, size: str = "l") -> Dict[str, Any]:
    """Generate a Text component."""
    return {
        "type": "Text",
        "props": {
            "id": f"Text-{uuid.uuid4()}",
            "size": size,
            "text": text,
            "align": "left",
            "color": "default",
            "weight": "normal",
            "padding": "20px",
            "maxWidth": "100%"
        }
    }

def generate_markdown_view_component(output_key: str, workflow_id: str) -> Dict[str, Any]:
    """Generate a MarkdownView component."""
    return {
    "type": "MarkdownView",
    "props": {
            "id": f"MarkdownView-{uuid.uuid4()}",
    "size": "base",
    "align": "left",
    "weight": "normal",
    "padding": "0px",
    "maxWidth": "100%",
    "workflowReference": {
                "outputKey": output_key,
                "workflowId": workflow_id
            }
        }
    }

def generate_debate_table_component(output_key: str, workflow_id: str) -> Dict[str, Any]:
    """Generate a DebateTable component."""
    return {
        "type": "DebateTable",
        "props": {
            "id": f"DebateTable-{uuid.uuid4()}",
            "className": "",
            "workflowReference": {
                "outputKey": output_key,
                "workflowId": workflow_id
            }
        }
    }

def generate_stats_component(output_key: str, workflow_id: str, title: Optional[str] = None) -> Dict[str, Any]:
    """Generate a Stats component that references NivoChartV2 data from workflow output."""
    component_id = f"Stats-{uuid.uuid4()}"
    
    stats_props = {
        "id": component_id,
        "workflowReference": {
            "outputKey": output_key,
            "workflowId": workflow_id
        }
    }
    
    if title:
        stats_props["title"] = title
    
    return {
        "type": "Stats",
        "props": stats_props
    }

def generate_topic_template(topic: TopicAnalysisResult, workflow_id: str, index: int) -> Dict[str, Any]:
    """Generate a puck template for a single topic."""
    content = []
    
    # Add topic title
    content.append(generate_text_component(topic.topic_title, "xl"))
    
    # Add topic charts if available (sorted to show distribution first)
    if topic.charts:
        chart_items = list(topic.charts.items())
        chart_items.sort(key=lambda x: (0 if x[0] == "distribution" else 1, x[0]))
        
        for chart_key, chart_config in chart_items:
            chart_title = chart_config.get("title", f"{topic.topic_title} - {chart_key}")
            content.append(generate_stats_component(
                f"consultation_analyses.{index}.charts.{chart_key}",
                workflow_id,
                chart_title
            ))
    
    # Add topic analysis markdown outputs if available
    if topic.prompt_outputs:
        for output_key, output in topic.prompt_outputs.items():
            if output.content:
                # Add section header for the output
                output_title = output_key.replace('_', ' ').title()
                content.append(generate_text_component(output_title, "l"))
                content.append(generate_markdown_view_component(
                    f"consultation_analyses.{index}.prompt_outputs.{output_key}.content", 
                    workflow_id
                ))
    
    # Add individual question analyses
    for question in topic.question_analyses:
        # Add question title
        content.append(generate_text_component(question.question_title, "l"))
        
        # Add question charts if available (sorted to show distribution first)
        if question.charts:
            chart_items = list(question.charts.items())
            chart_items.sort(key=lambda x: (0 if x[0] == "distribution" else 1, x[0]))
            
            for chart_key, chart_config in chart_items:
                chart_title = chart_config.get("title", f"{question.question_title} - {chart_key}")
                content.append(generate_stats_component(
                    f"consultation_analyses.{index}.question_analyses.{question.question_id}.charts.{chart_key}",
                    workflow_id,
                    chart_title
                ))
        
        # Add per-option demographics charts if available
        if hasattr(question, 'per_option_demographics') and question.per_option_demographics:
            for option_key, per_option_data in question.per_option_demographics.items():
                if hasattr(per_option_data, 'charts') and per_option_data.charts:
                    for chart_key, chart_config in per_option_data.charts.items():
                        chart_title = chart_config.get("title", f"{question.question_title} - {option_key} - {chart_key}")
                        content.append(generate_stats_component(
                            f"consultation_analyses.{index}.question_analyses.{question.question_id}.per_option_demographics.{option_key}.charts.{chart_key}",
                            workflow_id,
                            chart_title
                        ))
        
        # Add question analysis markdown outputs if available
        if question.prompt_outputs:
            for output_key, output in question.prompt_outputs.items():
                if output.content:
                    # Add section header for the output
                    output_title = output_key.replace('_', ' ').title()
                    content.append(generate_text_component(output_title, "m"))
                    content.append(generate_markdown_view_component(
                        f"consultation_analyses.{index}.question_analyses.{question.question_id}.prompt_outputs.{output_key}.content",
                        workflow_id
                    ))
    
    return {
        "root": {"type": "root", "props": {"content": []}},
        "zones": {},
        "content": content
    }

def generate_question_template(question: QuestionAnalysisResult, workflow_id: str, index: int) -> Dict[str, Any]:
    """Generate a puck template for a single question."""
    content = []
    
    # Add question title
    content.append(generate_text_component(question.question_title, "xl"))
    
    # Add ALL question charts if available (including demographic charts)
    if question.charts:
        # Sort charts to show distribution first, then demographics
        chart_items = list(question.charts.items())
        chart_items.sort(key=lambda x: (0 if x[0] == "distribution" else 1, x[0]))
        
        for chart_key, chart_config in chart_items:
            chart_title = chart_config.get("title", f"{question.question_title} - {chart_key}")
            content.append(generate_stats_component(
                f"consultation_analyses.{index}.charts.{chart_key}",
                workflow_id,
                chart_title
            ))
    
    # Add per-option demographics charts if available
    if hasattr(question, 'per_option_demographics') and question.per_option_demographics:
        for option_key, per_option_data in question.per_option_demographics.items():
            if hasattr(per_option_data, 'charts') and per_option_data.charts:
                for chart_key, chart_config in per_option_data.charts.items():
                    chart_title = chart_config.get("title", f"{question.question_title} - {option_key} - {chart_key}")
                    content.append(generate_stats_component(
                        f"consultation_analyses.{index}.per_option_demographics.{option_key}.charts.{chart_key}",
                        workflow_id,
                        chart_title
                    ))
    
    # Add question analysis markdown outputs if available
    if question.prompt_outputs:
        for output_key, output in question.prompt_outputs.items():
            if output.content:
                # Add section header for the output
                output_title = output_key.replace('_', ' ').title()
                content.append(generate_text_component(output_title, "l"))
                content.append(generate_markdown_view_component(
                    f"consultation_analyses.{index}.prompt_outputs.{output_key}.content",
                    workflow_id
                ))
    
    return {
        "root": {"type": "root", "props": {"content": []}},
        "zones": {},
        "content": content
    }

def generate_debate_template(debate: DebateAnalysisResult, workflow_id: str, index: int) -> Dict[str, Any]:
    """Generate a puck template for a debate question."""
    content = []
    
    # Add debate title
    content.append(generate_text_component(debate.question_title, "xl"))
    
    # Add debate table if available
    if debate.debate_table:
        content.append(generate_debate_table_component(f"consultation_analyses.{index}.debate_table", workflow_id))
    
    # Add debate analysis markdown outputs if available
    if debate.prompt_outputs:
        for output_key, output in debate.prompt_outputs.items():
            if output.content:
                # Add section header for the output
                output_title = output_key.replace('_', ' ').title()
                content.append(generate_text_component(output_title, "l"))
                content.append(generate_markdown_view_component(
                    f"consultation_analyses.{index}.prompt_outputs.{output_key}.content",
                    workflow_id
                ))
    
    return {
        "root": {"type": "root", "props": {"content": []}},
        "zones": {},
        "content": content
    }

def generate_puck_templates(consultation_result: ConsultationAnalysisResult, workflow_id: str) -> Dict[str, Dict[str, Any]]:
    """
    Generate puck templates for each topic in the consultation analysis.
    
    Returns a dictionary where keys are topic/question IDs and values are puck templates.
    """
    templates = {}
    
    for index, analysis in enumerate(consultation_result.consultation_analyses):
        try:
            if isinstance(analysis, TopicAnalysisResult):
                # Generate template for topic
                templates[analysis.topic_id] = generate_topic_template(analysis, workflow_id, index)
                
            elif isinstance(analysis, QuestionAnalysisResult):
                # Generate template for individual question
                templates[analysis.question_id] = generate_question_template(analysis, workflow_id, index)
                
            elif isinstance(analysis, DebateAnalysisResult):
                # Generate template for debate question
                templates[analysis.question_id] = generate_debate_template(analysis, workflow_id, index)
            else:
                # Handle any analysis object that has question_id
                if hasattr(analysis, 'question_id'):
                    templates[analysis.question_id] = generate_question_template(analysis, workflow_id, index)
                elif hasattr(analysis, 'topic_id'):
                    templates[analysis.topic_id] = generate_topic_template(analysis, workflow_id, index)
        except Exception as e:
            print(f"Warning: Failed to generate template for analysis at index {index}: {e}")
            # Skip this analysis and continue with the rest
            continue
    
    return templates

def generate_combined_template(consultation_result: ConsultationAnalysisResult, workflow_id: str) -> Dict[str, Any]:
    """
    Generate a single combined puck template for the entire consultation.
    """
    content = []
    
    # Add consultation overview
    content.append(generate_text_component("Consultation Analysis", "xl"))
    content.append(generate_text_component(f"Total Questions: {consultation_result.total_questions}", "l"))
    content.append(generate_text_component(f"Total Responses: {consultation_result.total_responses}", "l"))
    
    # Add each analysis
    for index, analysis in enumerate(consultation_result.consultation_analyses):
        try:
            if isinstance(analysis, TopicAnalysisResult):
                # Add topic title
                content.append(generate_text_component(analysis.topic_title, "l"))
                
                # Add ALL topic charts if available (sorted to show distribution first)
                if analysis.charts:
                    chart_items = list(analysis.charts.items())
                    chart_items.sort(key=lambda x: (0 if x[0] == "distribution" else 1, x[0]))
                    
                    for chart_key, chart_config in chart_items:
                        chart_title = chart_config.get("title", f"{analysis.topic_title} - {chart_key}")
                        content.append(generate_stats_component(
                            f"consultation_analyses.{index}.charts.{chart_key}",
                            workflow_id,
                            chart_title
                        ))
                
                # Add topic analysis markdown outputs if available
                if analysis.prompt_outputs:
                    for output_key, output in analysis.prompt_outputs.items():
                        if output.content:
                            # Add section header for the output
                            output_title = output_key.replace('_', ' ').title()
                            content.append(generate_text_component(output_title, "m"))
                            content.append(generate_markdown_view_component(
                                f"consultation_analyses.{index}.prompt_outputs.{output_key}.content",
                                workflow_id
                            ))
                
                # Add individual questions in topic (if they exist)
                if hasattr(analysis, 'question_analyses') and analysis.question_analyses:
                    for question in analysis.question_analyses:
                        content.append(generate_text_component(question.question_title, "m"))
                        
                        # Add ALL question charts if available (sorted to show distribution first)
                        if question.charts:
                            chart_items = list(question.charts.items())
                            chart_items.sort(key=lambda x: (0 if x[0] == "distribution" else 1, x[0]))
                            
                            for chart_key, chart_config in chart_items:
                                chart_title = chart_config.get("title", f"{question.question_title} - {chart_key}")
                                content.append(generate_stats_component(
                                    f"consultation_analyses.{index}.question_analyses.{question.question_id}.charts.{chart_key}",
                                    workflow_id,
                                    chart_title
                                ))
                        
                        # Add per-option demographics charts if available  
                        if hasattr(question, 'per_option_demographics') and question.per_option_demographics:
                            for option_key, per_option_data in question.per_option_demographics.items():
                                if hasattr(per_option_data, 'charts') and per_option_data.charts:
                                    for chart_key, chart_config in per_option_data.charts.items():
                                        chart_title = chart_config.get("title", f"{question.question_title} - {option_key} - {chart_key}")
                                        content.append(generate_stats_component(
                                            f"consultation_analyses.{index}.question_analyses.{question.question_id}.per_option_demographics.{option_key}.charts.{chart_key}",
                                            workflow_id,
                                            chart_title
                                        ))
                        
                        if question.prompt_outputs:
                            for output_key, output in question.prompt_outputs.items():
                                if output.content:
                                    # Add section header for the output
                                    output_title = output_key.replace('_', ' ').title()
                                    content.append(generate_text_component(output_title, "s"))
                                    content.append(generate_markdown_view_component(
                                        f"consultation_analyses.{index}.question_analyses.{question.question_id}.prompt_outputs.{output_key}.content",
                                        workflow_id
                                    ))
                
            elif isinstance(analysis, QuestionAnalysisResult):
                # Add question title
                content.append(generate_text_component(analysis.question_title, "l"))
                
                # Add ALL question charts if available (sorted to show distribution first)
                if analysis.charts:
                    chart_items = list(analysis.charts.items())
                    chart_items.sort(key=lambda x: (0 if x[0] == "distribution" else 1, x[0]))
                    
                    for chart_key, chart_config in chart_items:
                        chart_title = chart_config.get("title", f"{analysis.question_title} - {chart_key}")
                        content.append(generate_stats_component(
                            f"consultation_analyses.{index}.charts.{chart_key}",
                            workflow_id,
                            chart_title
                        ))
                
                # Add per-option demographics charts if available
                if hasattr(analysis, 'per_option_demographics') and analysis.per_option_demographics:
                    for option_key, per_option_data in analysis.per_option_demographics.items():
                        if hasattr(per_option_data, 'charts') and per_option_data.charts:
                            for chart_key, chart_config in per_option_data.charts.items():
                                chart_title = chart_config.get("title", f"{analysis.question_title} - {option_key} - {chart_key}")
                                content.append(generate_stats_component(
                                    f"consultation_analyses.{index}.per_option_demographics.{option_key}.charts.{chart_key}",
                                    workflow_id,
                                    chart_title
                                ))
                
                # Add question analysis markdown outputs if available
                if analysis.prompt_outputs:
                    for output_key, output in analysis.prompt_outputs.items():
                        if output.content:
                            # Add section header for the output
                            output_title = output_key.replace('_', ' ').title()
                            content.append(generate_text_component(output_title, "m"))
                            content.append(generate_markdown_view_component(
                                f"consultation_analyses.{index}.prompt_outputs.{output_key}.content",
                                workflow_id
                            ))
                        
            elif isinstance(analysis, DebateAnalysisResult):
                # Add debate title
                content.append(generate_text_component(analysis.question_title, "l"))
                
                # Add debate table if available
                if analysis.debate_table:
                    content.append(generate_debate_table_component(f"consultation_analyses.{index}.debate_table", workflow_id))
                
                # Add debate analysis markdown outputs if available
                if analysis.prompt_outputs:
                    for output_key, output in analysis.prompt_outputs.items():
                        if output.content:
                            # Add section header for the output
                            output_title = output_key.replace('_', ' ').title()
                            content.append(generate_text_component(output_title, "m"))
                            content.append(generate_markdown_view_component(
                                f"consultation_analyses.{index}.prompt_outputs.{output_key}.content",
                                workflow_id
                            ))
            else:
                # Handle any analysis object that looks like a question
                if hasattr(analysis, 'question_title') and hasattr(analysis, 'charts'):
                    # Add question title
                    content.append(generate_text_component(analysis.question_title, "l"))
                
                    # Add ALL question charts if available (sorted to show distribution first)
                    if analysis.charts:
                        chart_items = list(analysis.charts.items())
                        chart_items.sort(key=lambda x: (0 if x[0] == "distribution" else 1, x[0]))
                        
                        for chart_key, chart_config in chart_items:
                            chart_title = chart_config.get("title", f"{analysis.question_title} - {chart_key}")
                            content.append(generate_stats_component(
                                f"consultation_analyses.{index}.charts.{chart_key}",
                                workflow_id,
                                chart_title
                            ))
                    
                    # Add per-option demographics charts if available
                    if hasattr(analysis, 'per_option_demographics') and analysis.per_option_demographics:
                        for option_key, per_option_data in analysis.per_option_demographics.items():
                            if hasattr(per_option_data, 'charts') and per_option_data.charts:
                                for chart_key, chart_config in per_option_data.charts.items():
                                    chart_title = chart_config.get("title", f"{analysis.question_title} - {option_key} - {chart_key}")
                                    content.append(generate_stats_component(
                                        f"consultation_analyses.{index}.per_option_demographics.{option_key}.charts.{chart_key}",
                                        workflow_id,
                                        chart_title
                                    ))
                    
                    # Add question analysis markdown outputs if available
                    if hasattr(analysis, 'prompt_outputs') and analysis.prompt_outputs:
                        for output_key, output in analysis.prompt_outputs.items():
                            if output.content:
                                # Add section header for the output
                                output_title = output_key.replace('_', ' ').title()
                                content.append(generate_text_component(output_title, "m"))
                                content.append(generate_markdown_view_component(
                                    f"consultation_analyses.{index}.prompt_outputs.{output_key}.content",
                                    workflow_id
                                ))
        except Exception as e:
            print(f"Warning: Failed to process analysis at index {index} in combined template: {e}")
            # Skip this analysis and continue with the rest
            continue
    
    return {
        "root": {"type": "root", "props": {"content": []}},
        "zones": {},
        "content": content
    }
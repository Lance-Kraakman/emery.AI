# Copyright (c) 2025 AI Factory Ltd. All rights reserved.
# SPDX-License-Identifier: Proprietary

"""Puck template generation package."""

from .puck_gen import (
    generate_text_component,
    generate_markdown_view_component,
    generate_debate_table_component,
    generate_stats_component,
    generate_topic_template,
    generate_question_template,
    generate_debate_template,
    generate_puck_templates,
    generate_combined_template
)

__all__ = [
    "generate_text_component",
    "generate_markdown_view_component", 
    "generate_debate_table_component",
    "generate_stats_component",
    "generate_topic_template",
    "generate_question_template",
    "generate_debate_template",
    "generate_puck_templates",
    "generate_combined_template"
]
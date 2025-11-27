"""
Healthcare Tools Module

AIDEV-NOTE: Specialized tools for healthcare report generation and document formatting.
Includes document generation, template processing, and healthcare-specific utilities.
"""

from typing import Any, Dict
from smolagents import Tool
from ..grpc.generated.agent_worker_pb2 import ToolConfig
import json
import os
from datetime import datetime


def load_document_generator(config: ToolConfig) -> Any:
    """Load document generator tool for professional healthcare reports."""
    
    class DocumentGeneratorTool(Tool):
        name = "document_generator"
        description = "This tool generates professional healthcare documents with proper formatting and structure. It takes structured data and creates formatted reports according to healthcare documentation standards. The generated content will be in Markdown format and ready for saving to file."
        inputs = {
            "report_data": {
                "type": "object",
                "description": "Structured data containing report content organized by sections"
            },
            "template_type": {
                "type": "string", 
                "description": "Type of healthcare report template: 'aged_care', 'life_plan', or 'executive_summary'"
            },
            "client_name": {
                "type": "string",
                "description": "Name of the client for document header"
            }
        }
        output_type = "string"
        
        def forward(self, report_data: Dict, template_type: str, client_name: str) -> str:
            """Generate formatted healthcare document from structured data."""
            try:
                if template_type == "aged_care":
                    return self._generate_aged_care_report(report_data, client_name)
                elif template_type == "life_plan":
                    return self._generate_life_plan_report(report_data, client_name)
                elif template_type == "executive_summary":
                    return self._generate_executive_summary(report_data, client_name)
                else:
                    return f"Error: Unknown template type '{template_type}'. Supported types: aged_care, life_plan, executive_summary"
                    
            except Exception as e:
                return f"Error generating document: {str(e)}"
        
        def _generate_aged_care_report(self, data: Dict, client_name: str) -> str:
            """Generate residential aged care placement report."""
            report = f"""
# RESIDENTIAL AGED CARE PLACEMENT REPORT

**Client:** {client_name}
**Date:** {data.get('report_date', 'Not specified')}
**Report Type:** Comprehensive Care Assessment and Facility Recommendation

---

## EXECUTIVE SUMMARY

{data.get('executive_summary', 'Executive summary not provided')}

## CLIENT PROFILE

**Personal Details:**
{data.get('client_profile', 'Client profile not provided')}

**Health Status:**
{data.get('health_status', 'Health information not provided')}

## CARE ASSESSMENT

**Care Requirements:**
{data.get('care_requirements', 'Care assessment not provided')}

**Care Level:** {data.get('care_level', 'Not assessed')}

## FACILITY RECOMMENDATIONS

{data.get('facility_recommendations', 'Facility recommendations not provided')}

## FINANCIAL ANALYSIS

**Funding Assessment:**
{data.get('financial_analysis', 'Financial analysis not provided')}

## IMPLEMENTATION PLAN

**Next Steps:**
{data.get('implementation_plan', 'Implementation plan not provided')}

**Recommended Timeline:**
{data.get('timeline', 'Timeline not provided')}

---

*This report has been prepared by DRCare Healthcare Services in accordance with aged care assessment guidelines and professional standards.*
"""
            return report.strip()
        
        def _generate_life_plan_report(self, data: Dict, client_name: str) -> str:
            """Generate comprehensive life plan report."""
            report = f"""
# COMPREHENSIVE LIFE PLAN

**Client:** {client_name}
**Date:** {data.get('report_date', 'Not specified')}
**Report Type:** Strategic Life Planning for Healthcare and Aged Care Transition

---

## CURRENT SITUATION ANALYSIS

{data.get('current_situation', 'Current situation analysis not provided')}

## FUTURE PROJECTIONS

**Health Trajectory:**
{data.get('future_projections', 'Future projections not provided')}

## HEALTHCARE PATHWAY PLANNING

**Care Progression Strategy:**
{data.get('healthcare_pathway', 'Healthcare pathway not provided')}

## FINANCIAL PLANNING STRATEGY

**Long-term Financial Plan:**
{data.get('financial_planning', 'Financial planning not provided')}

## ACCOMMODATION STRATEGY

**Housing and Care Accommodation Plan:**
{data.get('accommodation_strategy', 'Accommodation strategy not provided')}

## SUPPORT SYSTEMS AND NETWORKS

**Family and Professional Support:**
{data.get('support_systems', 'Support systems information not provided')}

## IMPLEMENTATION TIMELINE

**Phased Implementation Approach:**
{data.get('implementation_timeline', 'Implementation timeline not provided')}

## CONTINGENCY PLANNING

**Risk Management and Alternative Pathways:**
{data.get('contingency_planning', 'Contingency planning not provided')}

---

*This life plan has been developed using evidence-based healthcare planning methodologies and industry best practices. Regular review and updates are recommended as circumstances change.*
"""
            return report.strip()
        
        def _generate_executive_summary(self, data: Dict, client_name: str) -> str:
            """Generate concise executive summary report."""
            report = f"""
# EXECUTIVE SUMMARY

**Client:** {client_name}
**Date:** {data.get('report_date', 'Not specified')}
**Report Type:** Executive Decision Brief

---

## KEY POINTS

{data.get('key_points', 'Key points not provided')}

## CRITICAL DECISIONS REQUIRED

{data.get('critical_decisions', 'Critical decisions not identified')}

## IMMEDIATE ACTIONS REQUIRED

{data.get('immediate_actions', 'Immediate actions not specified')}

## STRATEGIC RECOMMENDATIONS

{data.get('strategic_recommendations', 'Strategic recommendations not provided')}

## FINANCIAL IMPLICATIONS

{data.get('financial_implications', 'Financial implications not assessed')}

## NEXT STEPS

{data.get('next_steps', 'Next steps not defined')}

---

*This executive summary provides a high-level overview of key decisions and actions required. Refer to detailed reports for comprehensive analysis and supporting information.*
"""
            return report.strip()
    
    return DocumentGeneratorTool()


def load_file_writer(config: ToolConfig) -> Any:
    """Load file writer tool for saving healthcare reports to filesystem."""
    
    class FileWriterTool(Tool):
        name = "file_writer"
        description = "Saves healthcare report content to a specified file path with proper naming and organization. IMPORTANT: When calling this tool, ensure the content parameter contains properly escaped JSON strings - use double quotes and escape newlines as \\n in the JSON."
        inputs = {
            "content": {
                "type": "string",
                "description": "The report content to write to file. Must be properly escaped for JSON - newlines should be \\n and quotes should be escaped."
            },
            "filepath": {
                "type": "string", 
                "description": "Directory path where to save the file (will be created if doesn't exist). Use the exact path specified in the task instructions."
            },
            "filename": {
                "type": "string",
                "description": "Name of the file to create (should include extension like .md or .txt). Use the exact filename format specified in the task instructions."
            },
            "client_name": {
                "type": "string",
                "description": "Name of the client for organization and verification",
                "nullable": True
            }
        }
        output_type = "string"
        
        def forward(self, content: str, filepath: str, filename: str, client_name: str = None) -> str:
            """Save healthcare report content to specified file."""
            full_path = None
            try:
                # Create full file path first
                full_path = os.path.join(filepath, filename)
                
                # Ensure the directory exists
                os.makedirs(filepath, exist_ok=True)
                
                # Clean up content - handle any escaping issues from JSON parsing
                clean_content = content
                if "\\n" in content and "\n" not in content:
                    # If content has escaped newlines but no actual newlines, unescape them
                    clean_content = content.replace("\\n", "\n")
                
                # Add metadata header to the file
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                metadata_header = f"""<!--
Healthcare Report Generated by DRCare Agent
Generated: {timestamp}
Client: {client_name or 'Not specified'}
File: {filename}
-->

"""
                
                # Write content with metadata header
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(metadata_header + clean_content)
                
                file_size = os.path.getsize(full_path)
                return f"Healthcare report successfully saved to: {full_path}\nFile size: {file_size} bytes\nClient: {client_name or 'Not specified'}\nGenerated: {timestamp}"
                
            except PermissionError:
                return f"Error: Permission denied writing to '{full_path or os.path.join(filepath, filename)}'. Check directory permissions."
            except OSError as e:
                return f"Error: Failed to create directory or write file '{full_path or os.path.join(filepath, filename)}': {str(e)}"
            except Exception as e:
                return f"Error saving healthcare report to '{full_path or os.path.join(filepath, filename)}': {str(e)}"
    
    return FileWriterTool()


def load_template_reader(config: ToolConfig) -> Any:
    """Load template reader tool for accessing healthcare report templates."""
    
    class TemplateReaderTool(Tool):
        name = "template_reader"
        description = "This tool reads healthcare report templates and extracts structure information for report generation."
        inputs = {
            "template_path": {
                "type": "string",
                "description": "Path to the template file to read and analyze"
            },
            "extract_sections": {
                "type": "boolean",
                "description": "Whether to extract section information from the template",
                "nullable": True
            }
        }
        output_type = "string"
        
        def forward(self, template_path: str, extract_sections: bool = True) -> str:
            """Read and analyze healthcare report template."""
            try:
                if not os.path.exists(template_path):
                    return f"Error: Template file '{template_path}' not found."
                
                # Read template file
                with open(template_path, 'r', encoding='utf-8') as f:
                    if template_path.endswith('.json'):
                        template_data = json.load(f)
                        if extract_sections and 'sections' in template_data:
                            sections = template_data['sections']
                            section_info = []
                            for section in sections:
                                section_info.append(f"- {section.get('title', 'Untitled')}: {section.get('description', 'No description')}")
                            return f"Template: {template_data.get('templateName', 'Unknown')}\nSections:\n" + "\n".join(section_info)
                        else:
                            return json.dumps(template_data, indent=2)
                    else:
                        return f.read()
                        
            except json.JSONDecodeError:
                return f"Error: Invalid JSON format in template file '{template_path}'"
            except Exception as e:
                return f"Error reading template '{template_path}': {str(e)}"
    
    return TemplateReaderTool()


def load_simple_report_saver(config: ToolConfig) -> Any:
    """Load simple report saver that handles content more robustly."""
    
    class SimpleReportSaverTool(Tool):
        name = "simple_report_saver"
        description = "Simple tool to save healthcare reports. Pass the report content and file details, avoiding complex JSON escaping issues."
        inputs = {
            "report_content": {
                "type": "string",
                "description": "The healthcare report content to save"
            },
            "client_name": {
                "type": "string",
                "description": "Client name for filename generation"
            },
            "report_type": {
                "type": "string", 
                "description": "Type of report: aged_care, life_plan, or executive_summary"
            }
        }
        output_type = "string"
        
        def forward(self, report_content: str, client_name: str, report_type: str) -> str:
            """Save healthcare report with auto-generated paths."""
            try:
                # Generate safe filename from client name
                safe_client_name = "".join(c for c in client_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                safe_client_name = safe_client_name.replace(' ', '_')
                
                # Generate date for filename
                date_str = datetime.now().strftime("%Y%m%d")
                
                # Determine subdirectory based on report type
                subdir_map = {
                    "aged_care": "aged_care",
                    "life_plan": "life_plans", 
                    "executive_summary": "executive_summaries"
                }
                subdir = subdir_map.get(report_type, "other")
                
                # Create full paths
                base_dir = "/Users/lancekraakman/orchastrate/emery-agents/outputs/healthcare_reports"
                full_dir = os.path.join(base_dir, subdir)
                filename = f"{safe_client_name}_{report_type}_report_{date_str}.md"
                full_path = os.path.join(full_dir, filename)
                
                # Ensure directory exists
                os.makedirs(full_dir, exist_ok=True)
                
                # Clean up content
                clean_content = report_content
                if "\\n" in report_content and "\n" not in report_content:
                    clean_content = report_content.replace("\\n", "\n")
                
                # Add metadata header
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                metadata_header = f"""<!--
Healthcare Report Generated by DRCare Agent
Generated: {timestamp}
Client: {client_name}
Report Type: {report_type}
File: {filename}
-->

"""
                
                # Write file
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(metadata_header + clean_content)
                
                file_size = os.path.getsize(full_path)
                return f"SUCCESS: Healthcare report saved to {full_path}\nFile size: {file_size} bytes\nClient: {client_name}\nType: {report_type}\nGenerated: {timestamp}"
                
            except Exception as e:
                return f"ERROR: Failed to save report for {client_name}: {str(e)}"
    
    return SimpleReportSaverTool()


# Registry of healthcare tools
HEALTHCARE_TOOLS = {
    "document_generator": load_document_generator,
    "file_writer": load_file_writer,
    "template_reader": load_template_reader,
    "simple_report_saver": load_simple_report_saver,
}
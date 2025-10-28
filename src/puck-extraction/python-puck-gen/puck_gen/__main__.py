# Copyright (c) 2025 AI Factory Ltd. All rights reserved.
# SPDX-License-Identifier: Proprietary

"""
CLI interface for the puck template generator.
"""

import json
import sys
import argparse
from pathlib import Path

from analysis_engine_v2.models import ConsultationAnalysisResult
from .puck_gen import generate_puck_templates, generate_combined_template
from .payload_client import PayloadCMSClient, PayloadConfig, PuckToPayloadGenerator

def load_consultation_result(json_file: str) -> ConsultationAnalysisResult:
    """Load a ConsultationAnalysisResult from a JSON file."""
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        # Parse the JSON data into a ConsultationAnalysisResult
        return ConsultationAnalysisResult.model_validate(data)
    except Exception as e:
        print(f"Error loading consultation result from {json_file}: {e}")
        sys.exit(1)

def main():
    """CLI interface for puck template generation."""
    parser = argparse.ArgumentParser(description="Generate Puck templates from consultation analysis results")
    parser.add_argument("input_file", help="JSON file containing ConsultationAnalysisResult")
    parser.add_argument("--workflow-id", default="workflow-123", help="Workflow ID for template references")
    parser.add_argument("--output-dir", default="puck_templates", help="Output directory for generated templates")
    parser.add_argument("--combined-only", action="store_true", help="Generate only the combined template")
    
    # PayloadCMS integration
    parser.add_argument("--cms-url", help="PayloadCMS base URL (e.g., http://localhost:3000)")
    parser.add_argument("--cms-api-key", help="PayloadCMS API key")
    parser.add_argument("--cms-app-id", help="PayloadCMS app ID to associate with")
    parser.add_argument("--cms-project-id", help="PayloadCMS project ID (required if creating app)")
    parser.add_argument("--debug", action="store_true", help="Enable debug output for PayloadCMS operations")
    parser.add_argument("--skip-cms", action="store_true", help="Skip PayloadCMS operations, just generate templates")
    
    # Delete functionality
    parser.add_argument("--delete-all", action="store_true", help="Delete all pages and view templates for the specified app")
    parser.add_argument("--list-only", action="store_true", help="Only list existing pages and templates, don't create or delete")
    
    args = parser.parse_args()
    
    print("Puck Template Generator CLI")
    print("=" * 40)
    
    # Handle PayloadCMS operations first if specified
    if args.cms_url and args.cms_api_key and args.cms_app_id:
        config = PayloadConfig(
            base_url=args.cms_url,
            api_key=args.cms_api_key
        )
        
        client = PayloadCMSClient(config)
        
        if not client.authenticate():
            print("❌ Failed to authenticate with PayloadCMS")
            sys.exit(1)
        
        # Test authentication with a simple request
        if args.debug:
            print("🔍 Testing authentication...")
            if not client.test_auth():
                print("❌ Authentication test failed")
                sys.exit(1)
            else:
                print("✅ Authentication test passed")
                client.test_permissions()
        
        if args.delete_all:
            print(f"🗑️  Deleting all pages and view templates for app {args.cms_app_id}...")
            
            # Get and delete all pages for this app
            pages = client.get_pages(app_id=args.cms_app_id)
            print(f"Found {len(pages)} pages to delete...")
            
            deleted_pages = 0
            for page in pages:
                if client.delete_page(page['id']):
                    print(f"  ✅ Deleted page: {page.get('name', page['id'])}")
                    deleted_pages += 1
                else:
                    print(f"  ❌ Failed to delete page: {page.get('name', page['id'])}")
            
            # Get and delete all view templates for this app
            templates = client.get_view_templates(app_id=args.cms_app_id)
            print(f"Found {len(templates)} view templates to delete...")
            
            deleted_templates = 0
            for template in templates:
                if client.delete_view_template(template['id']):
                    print(f"  ✅ Deleted template: {template.get('title', template['id'])}")
                    deleted_templates += 1
                else:
                    print(f"  ❌ Failed to delete template: {template.get('title', template['id'])}")
            
            print(f"\n📊 Deletion Summary:")
            print(f"  - Pages deleted: {deleted_pages}/{len(pages)}")
            print(f"  - Templates deleted: {deleted_templates}/{len(templates)}")
            
            if deleted_pages == len(pages) and deleted_templates == len(templates):
                print("🎉 All items deleted successfully!")
            else:
                print("⚠️  Some items failed to delete")
            
            return
        
        if args.list_only:
            print(f"📋 Listing pages and view templates for app {args.cms_app_id}...")
            
            # List all pages for this app
            pages = client.get_pages(app_id=args.cms_app_id)
            print(f"\nPages ({len(pages)}):")
            for page in pages:
                print(f"  - {page.get('name', 'Unnamed')} (ID: {page['id']})")
            
            # List all view templates for this app
            templates = client.get_view_templates(app_id=args.cms_app_id)
            print(f"\nView Templates ({len(templates)}):")
            for template in templates:
                print(f"  - {template.get('title', 'Untitled')} (ID: {template['id']})")
            
            return
    
    print(f"Input file: {args.input_file}")
    print(f"Workflow ID: {args.workflow_id}")
    print(f"Output directory: {args.output_dir}")
    
    # Validate input file exists
    if not Path(args.input_file).exists():
        print(f"Error: Input file '{args.input_file}' not found")
        sys.exit(1)
    
    # Load consultation result from JSON file
    print(f"\n1. Loading consultation result from {args.input_file}...")
    consultation_result = load_consultation_result(args.input_file)
    print(f"  - Loaded consultation with {len(consultation_result.consultation_analyses)} analyses")
    print(f"  - Total questions: {consultation_result.total_questions}")
    print(f"  - Total responses: {consultation_result.total_responses}")
    
    # Create output directory if it doesn't exist
    output_path = Path(args.output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    if not args.combined_only:
        # Generate individual templates
        print("\n2. Generating individual templates...")
        templates = generate_puck_templates(consultation_result, args.workflow_id)
        
        for template_id, template in templates.items():
            print(f"  - Template for {template_id}: {len(template['content'])} components")
            
            # Save individual template
            output_file = output_path / f"puck_template_{template_id}.json"
            with open(output_file, 'w') as f:
                json.dump(template, f, indent=2)
            print(f"    Saved to: {output_file}")
    
    # Generate combined template
    print(f"\n{'3' if not args.combined_only else '2'}. Generating combined template...")
    combined_template = generate_combined_template(consultation_result, args.workflow_id)
    print(f"  - Combined template: {len(combined_template['content'])} components")
    
    # Save combined template
    output_file = output_path / "puck_template_combined.json"
    with open(output_file, 'w') as f:
        json.dump(combined_template, f, indent=2)
    print(f"    Saved to: {output_file}")
    
    print("\n✅ Puck template generation completed successfully!")
    
    # PayloadCMS integration if configured
    if args.cms_url and args.cms_api_key and args.cms_app_id:
        print(f"\n4. Creating PayloadCMS pages and templates...")
        print(f"  - CMS URL: {args.cms_url}")
        print(f"  - App ID: {args.cms_app_id}")
        
        # Use input filename as consultation title
        consultation_title = Path(args.input_file).stem.replace('_', ' ').title()
        
        config = PayloadConfig(
            base_url=args.cms_url,
            api_key=args.cms_api_key
        )
        
        client = PayloadCMSClient(config)
        
        # Authenticate
        if not client.authenticate():
            print("  ❌ Failed to authenticate with PayloadCMS")
        else:
            pages_created = []
            
            # Create combined page
            combined_title = f"{consultation_title} - Complete Report"
            combined_template_id = client.create_view_template(
                title=combined_title,
                document=combined_template,
                app_ids=[args.cms_app_id],
                debug=args.debug
            )
            
            if combined_template_id:
                combined_page_id = client.create_page(
                    name=combined_title,
                    app_id=args.cms_app_id,
                    view_template_ids=[{'template': combined_template_id, 'order': 0}],
                    order=0
                )
                if combined_page_id:
                    pages_created.append(f"Combined: {combined_page_id}")
                    print(f"  ✅ Created combined page: {combined_page_id}")
            
            # Create individual pages for each topic/question
            if not args.combined_only:
                for order, (template_id, template) in enumerate(templates.items(), start=1):
                    title = f"{consultation_title} - {template_id.replace('_', ' ').title()}"
                    
                    # Create template
                    template_id_created = client.create_view_template(
                        title=title,
                        document=template,
                        app_ids=[args.cms_app_id],
                        debug=args.debug
                    )
                    
                    if template_id_created:
                        # Create page for this template
                        page_id = client.create_page(
                            name=title,
                            app_id=args.cms_app_id,
                            view_template_ids=[{'template': template_id_created, 'order': 0}],
                            order=order
                        )
                        
                        if page_id:
                            pages_created.append(f"{template_id}: {page_id}")
                            print(f"  ✅ Created page for {template_id}: {page_id}")
                        else:
                            print(f"  ❌ Failed to create page for {template_id}")
                    else:
                        print(f"  ❌ Failed to create template for {template_id}")
            
            print(f"\n  📄 Total pages created: {len(pages_created)}")
            for page in pages_created:
                print(f"    - {page}")
                
    elif args.cms_url or args.cms_api_key or args.cms_app_id:
        print(f"\n⚠️  PayloadCMS integration skipped: --cms-url, --cms-api-key, and --cms-app-id are all required")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Test Sequential Workflow

AIDEV-NOTE: Test script to run task_017 and task_018 in sequence
to verify context persistence and no timeout issues.
"""

import asyncio
import os
import sys
import logging

# Add src to path for imports
sys.path.insert(0, 'src')

from emery_agents.execution.capability_router_agent import CapabilityRouterAgent

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_sequential_workflow():
    """Test task_017 followed by task_018 to verify context persistence."""
    
    # Set HuggingFace token
    os.environ['HF_TOKEN'] = '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'
    
    print("🚀 Starting Sequential Workflow Test")
    print("=" * 60)
    
    # Create single agent instance for context persistence
    agent = CapabilityRouterAgent()
    
    try:
        # Task 017: Initialize organizational context
        print("\n📋 Task 017: Initialize Organizational Context")
        print("-" * 50)
        
        task_017_instructions = """
        Use emery_database to create organization with name='Stripe Analysis Project', website='https://stripe.com'. 
        Then use table_data to create a row in tableId=4 with field_40='website_analysis', 
        field_41='https://stripe.com', field_42='fintech'. Return the organization_id.
        """
        
        start_time = asyncio.get_event_loop().time()
        result_017 = await agent.execute_instructions(
            task_017_instructions, 
            available_tools=['emery_database', 'table_data']
        )
        end_time = asyncio.get_event_loop().time()
        
        print(f"✅ Task 017 completed in {end_time - start_time:.2f} seconds")
        print(f"📤 Result: {result_017}")
        
        # Task 018: Analyze and store results  
        print("\n📋 Task 018: Analyze Website with Context Persistence")
        print("-" * 50)
        
        task_018_instructions = """
        Call analysis_api tool with action='analyze_website' and website_url='https://stripe.com'. 
        Store the results using table_data tool with action='create_row', tableId=4, 
        and row_data containing field_42='fintech', field_43='payment_processing_platform', 
        field_44='analysis_completed'.
        """
        
        start_time = asyncio.get_event_loop().time()
        result_018 = await agent.execute_instructions(
            task_018_instructions,
            available_tools=['analysis_api', 'table_data']
        )
        end_time = asyncio.get_event_loop().time()
        
        print(f"✅ Task 018 completed in {end_time - start_time:.2f} seconds")
        print(f"📤 Result: {result_018}")
        
        # Verify context persistence by checking stored data
        print("\n🔍 Verifying Context Persistence")
        print("-" * 50)
        
        verify_instructions = """
        Use table_data tool with action='get_rows' and tableId=4 to retrieve all stored analysis results.
        """
        
        start_time = asyncio.get_event_loop().time()
        verify_result = await agent.execute_instructions(
            verify_instructions,
            available_tools=['table_data']
        )
        end_time = asyncio.get_event_loop().time()
        
        print(f"✅ Verification completed in {end_time - start_time:.2f} seconds")
        print(f"📤 Stored data: {verify_result}")
        
        print("\n🎉 Sequential workflow test completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        logger.error(f"Sequential workflow test failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(test_sequential_workflow())
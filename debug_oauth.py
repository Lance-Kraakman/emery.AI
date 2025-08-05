#!/usr/bin/env python3
"""
Debug OAuth connection issues
"""

import sys
import os
import requests
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'src'))

def test_simple_call():
    print("🔍 Debug OAuth Connection Issues")
    print("=" * 50)
    
    # Test just getting user accounts first
    try:
        response = requests.post("http://localhost:3000/api/agents/proxy", 
            headers={
                "Authorization": "Bearer orch_agent_3_PA1-THeNhUtNSoWK",
                "Content-Type": "application/json"
            },
            json={
                "service": "test", 
                "action": "list_accounts", 
                "params": {}
            }
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response text: {response.text}")
        
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_simple_call()
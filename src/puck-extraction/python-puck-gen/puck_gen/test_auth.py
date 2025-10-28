# Copyright (c) 2025 AI Factory Ltd. All rights reserved.
# SPDX-License-Identifier: Proprietary

"""
Test script for PayloadCMS API key authentication.
"""

import os
import sys
from payload_client import PayloadConfig, PayloadCMSClient

def test_api_key_auth():
    """Test API key authentication with PayloadCMS."""
    
    # Get configuration from environment variables
    base_url = os.getenv('PAYLOAD_BASE_URL', 'http://localhost:3000')
    api_key = os.getenv('PAYLOAD_API_KEY')
    
    if not api_key:
        print("❌ PAYLOAD_API_KEY environment variable not set")
        print("To test authentication, set PAYLOAD_API_KEY to a valid API key")
        return False
    
    # Create config and client
    config = PayloadConfig(
        base_url=base_url,
        api_key=api_key
    )
    
    client = PayloadCMSClient(config)
    
    print(f"🔧 Testing authentication with:")
    print(f"   Base URL: {base_url}")
    print(f"   API Key: {api_key[:8]}..." if len(api_key) > 8 else f"   API Key: {api_key}")
    
    # Test authentication
    print("\n🔐 Testing authentication...")
    auth_success = client.authenticate()
    
    if not auth_success:
        print("❌ Authentication failed")
        return False
    
    print("✅ Authentication successful")
    
    # Test API access by getting apps
    print("\n📋 Testing API access by fetching apps...")
    apps = client.get_apps()
    
    if apps is None:
        print("❌ Failed to fetch apps - API call failed")
        return False
    
    print(f"✅ Successfully fetched {len(apps)} apps:")
    for app in apps:
        print(f"   - {app.get('name', 'Unknown')} (ID: {app.get('id', 'Unknown')})")
    
    return True

def test_username_password_auth():
    """Test username/password authentication as fallback."""
    
    base_url = os.getenv('PAYLOAD_BASE_URL', 'http://localhost:3000')
    username = os.getenv('PAYLOAD_USERNAME')
    password = os.getenv('PAYLOAD_PASSWORD')
    
    if not username or not password:
        print("\n🔧 Skipping username/password test - PAYLOAD_USERNAME or PAYLOAD_PASSWORD not set")
        return True
    
    config = PayloadConfig(
        base_url=base_url,
        username=username,
        password=password
    )
    
    client = PayloadCMSClient(config)
    
    print(f"\n🔧 Testing username/password authentication:")
    print(f"   Base URL: {base_url}")
    print(f"   Username: {username}")
    
    # Test authentication
    print("\n🔐 Testing username/password authentication...")
    auth_success = client.authenticate()
    
    if not auth_success:
        print("❌ Username/password authentication failed")
        return False
    
    print("✅ Username/password authentication successful")
    
    # Test API access
    print("\n📋 Testing API access with username/password...")
    apps = client.get_apps()
    
    if apps is None:
        print("❌ Failed to fetch apps with username/password")
        return False
    
    print(f"✅ Successfully fetched {len(apps)} apps with username/password")
    return True

if __name__ == "__main__":
    print("🧪 PayloadCMS Authentication Test\n")
    
    api_key_success = test_api_key_auth()
    username_password_success = test_username_password_auth()
    
    print("\n📊 Test Results:")
    print(f"   API Key Authentication: {'✅ PASS' if api_key_success else '❌ FAIL'}")
    print(f"   Username/Password Authentication: {'✅ PASS' if username_password_success else '❌ FAIL'}")
    
    if api_key_success or username_password_success:
        print("\n🎉 At least one authentication method is working!")
        sys.exit(0)
    else:
        print("\n💥 All authentication methods failed!")
        sys.exit(1)
#!/usr/bin/env tsx
/**
 * Debug Pipedream API Response Structure
 * 
 * Inspect the raw API response to understand pagination
 */

import { pipedreamClient } from '@/src/lib/pipedream/client';

async function debugPipedreamAPI() {
  if (!pipedreamClient) {
    console.error('❌ Pipedream client not configured');
    process.exit(1);
  }

  console.log('🔍 Debugging Pipedream API response structure...\n');
  
  try {
    console.log('📄 Fetching first page of apps...');
    const response = await pipedreamClient.apps.list({ limit: 5 });
    
    console.log('📊 Raw response structure:');
    console.log('Type:', typeof response);
    console.log('Is Array:', Array.isArray(response));
    
    if (Array.isArray(response)) {
      console.log('Length:', response.length);
      console.log('Sample app keys:', response.map(app => app.key || app.slug).slice(0, 3));
    } else {
      console.log('Response keys:', Object.keys(response));
      console.log('Full response:', JSON.stringify(response, null, 2));
    }
    
  } catch (error) {
    console.error('❌ API Error:', error);
  }
}

debugPipedreamAPI().catch(console.error);
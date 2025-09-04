#!/usr/bin/env npx tsx

// Test HuggingFace directly
import { HfInference } from '@huggingface/inference';

async function test() {
  const hfToken = '***REMOVED***';
  const hf = new HfInference(hfToken);
  
  const model = 'sentence-transformers/all-mpnet-base-v2';
  const text = 'Test embedding';
  
  console.log(`Testing ${model} directly with HfInference...`);
  
  try {
    const startTime = Date.now();
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout after 10s')), 10000);
    });
    
    // Create the embedding promise
    const embedPromise = hf.featureExtraction({
      model,
      inputs: text,
    });
    
    // Race between timeout and actual call
    const result = await Promise.race([embedPromise, timeoutPromise]);
    
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ SUCCESS in ${elapsed}ms`);
    
    // Check the result structure
    if (Array.isArray(result)) {
      if (Array.isArray(result[0])) {
        console.log(`Result is nested array: [${result.length}][${result[0].length}]`);
        console.log(`First few values: ${result[0].slice(0, 5)}`);
      } else {
        console.log(`Result is flat array: ${result.length} dimensions`);
        console.log(`First few values: ${result.slice(0, 5)}`);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error(`❌ FAILED: ${error.message}`);
    if (error.cause) {
      console.error(`Cause: ${error.cause}`);
    }
    throw error;
  }
}

test().catch(console.error);
#!/usr/bin/env npx tsx

// Test which HuggingFace embedding models actually work
import { HfInference } from '@huggingface/inference';

const models = [
  { name: 'sentence-transformers/all-MiniLM-L6-v2', dims: 384 },
  { name: 'sentence-transformers/all-mpnet-base-v2', dims: 768 },
  { name: 'BAAI/bge-small-en-v1.5', dims: 384 },
  { name: 'BAAI/bge-base-en-v1.5', dims: 768 },
  { name: 'BAAI/bge-large-en-v1.5', dims: 1024 },
  // { name: 'BAAI/bge-m3', dims: 1024 }, // Skip - this one hangs
  { name: 'thenlper/gte-small', dims: 384 },
  { name: 'thenlper/gte-base', dims: 768 },
];

async function testModels() {
  const hfToken = process.env.HF_TOKEN || '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';
  const hf = new HfInference(hfToken);
  const testText = "Test embedding generation";
  
  console.log('Testing HuggingFace embedding models...\n');
  
  for (const model of models) {
    process.stdout.write(`Testing ${model.name} (${model.dims}D)... `);
    
    try {
      const startTime = Date.now();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const embedPromise = hf.featureExtraction({
        model: model.name,
        inputs: testText,
      });
      
      const result = await Promise.race([embedPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;
      
      // Check dimensions
      let dims = 0;
      if (Array.isArray(result)) {
        if (Array.isArray(result[0])) {
          dims = result[0].length; // Nested array
        } else {
          dims = result.length; // Flat array
        }
      }
      
      if (dims === model.dims) {
        console.log(`✅ SUCCESS in ${elapsed}ms`);
      } else {
        console.log(`⚠️  Dimension mismatch: got ${dims}, expected ${model.dims}`);
      }
    } catch (error: any) {
      if (error.message === 'Timeout') {
        console.log('❌ TIMEOUT (5s)');
      } else {
        console.log(`❌ ERROR: ${error.message?.substring(0, 50)}`);
      }
    }
  }
}

testModels().catch(console.error);
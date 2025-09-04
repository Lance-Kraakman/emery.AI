#!/usr/bin/env npx tsx

// Direct test of HuggingFace embedding API
import { HfInference } from '@huggingface/inference';

async function testEmbeddings() {
  const hfToken = process.env.HF_TOKEN;
  
  if (!hfToken) {
    console.error('❌ HF_TOKEN is not set!');
    process.exit(1);
  }
  
  console.log('✅ HF_TOKEN is set');
  console.log(`Token starts with: ${hfToken.substring(0, 10)}...`);
  
  const hf = new HfInference(hfToken);
  const testText = "This is a test sentence for embedding generation.";
  
  // Test different models
  const models = [
    'BAAI/bge-m3',
    'BAAI/bge-large-en-v1.5', 
    'sentence-transformers/all-mpnet-base-v2',
    'sentence-transformers/all-MiniLM-L6-v2'
  ];
  
  for (const model of models) {
    console.log(`\n🔍 Testing model: ${model}`);
    try {
      const startTime = Date.now();
      
      const result = await hf.featureExtraction({
        model,
        inputs: testText,
      });
      
      const elapsed = Date.now() - startTime;
      
      if (Array.isArray(result)) {
        console.log(`✅ Success! Got embedding with ${result.length} dimensions in ${elapsed}ms`);
        
        // Check if it's nested array
        if (Array.isArray(result[0])) {
          console.log(`   Note: Result is nested array, actual dimensions: ${result[0].length}`);
        }
      } else {
        console.log(`⚠️  Unexpected result type: ${typeof result}`);
      }
    } catch (error) {
      console.error(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.stack) {
        console.error(`   Stack: ${error.stack.split('\n')[1]?.trim()}`);
      }
    }
  }
  
  // Now test using the AI SDK approach
  console.log('\n📦 Testing via AI SDK embed function:');
  try {
    const { embed } = await import('ai');
    const { getEmbeddingModel } = await import('../lib/ai/models');
    
    const embeddingModel = getEmbeddingModel();
    console.log(`Using model config: ${JSON.stringify({ modelId: embeddingModel.modelId, provider: embeddingModel.provider })}`);
    
    const startTime = Date.now();
    const { embedding } = await embed({
      model: embeddingModel,
      value: testText,
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ AI SDK Success! Got embedding with ${embedding.length} dimensions in ${elapsed}ms`);
  } catch (error) {
    console.error(`❌ AI SDK Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error) {
      console.error('Full error:', error);
    }
  }
}

testEmbeddings().catch(console.error);
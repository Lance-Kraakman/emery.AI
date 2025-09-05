#!/usr/bin/env npx tsx
// Test our actual embedding service with enhanced logging

import { EmbeddingService } from '../ddd/application/services/embedding-service';

async function testEmbeddingService() {
  console.log('Testing EmbeddingService with enhanced logging...');
  
  const embeddingService = new EmbeddingService();
  
  try {
    // Test single embedding
    console.log('\n=== SINGLE EMBEDDING TEST ===');
    const text = 'Test document for embedding';
    const embedding = await embeddingService.generateEmbedding(text);
    console.log(`Success: ${embedding.length} dimensions`);
    
    // Test batch embedding
    console.log('\n=== BATCH EMBEDDING TEST ===');
    const texts = [
      'First test document',
      'Second test document', 
      'Third test document'
    ];
    const embeddings = await embeddingService.generateEmbeddingsBatch(texts);
    console.log(`Batch success: ${embeddings.length} embeddings`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEmbeddingService().catch(console.error);
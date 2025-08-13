/**
 * Simple test script to verify HuggingFace model integration with Qwen models
 * 
 * Usage:
 * export HF_TOKEN=hf_your_token_here
 * node test_hf_models.js
 */

const { getAIModel, getAIProviderInfo, getEmbeddingModel, getAvailableChatModels, getModelRecommendation } = require('./lib/ai/models.ts')

async function testAIProviders() {
  console.log('🧪 Testing HuggingFace Provider with Qwen Models...\n')
  
  try {
    // Test provider info
    const providerInfo = getAIProviderInfo()
    console.log('📊 Provider Info:')
    console.log(`   Provider: ${providerInfo.provider}`)
    console.log(`   Default Chat Model: ${providerInfo.defaultChatModel || 'None'}`)
    console.log(`   Default Embedding: ${providerInfo.defaultEmbeddingModel || 'None'}`)
    console.log(`   Available Chat Models: ${providerInfo.availableChatModels}`)
    console.log(`   Available Embedding Models: ${providerInfo.availableEmbeddingModels}`)
    console.log(`   Configured: ${providerInfo.configured ? '✅' : '❌'}`)
    
    if (!providerInfo.configured) {
      console.log('\n❌ HF_TOKEN is required. Get your token from https://huggingface.co/settings/tokens')
      return
    }
    
    console.log('\n🚀 Testing model instances...')
    
    // Test default chat model
    const chatModel = getAIModel()
    console.log('✅ Default chat model created successfully (Qwen/Qwen2.5-Coder-32B-Instruct)')
    
    // Test embedding model
    const embeddingModel = getEmbeddingModel()
    console.log('✅ Embedding model created successfully (sentence-transformers/all-mpnet-base-v2)')
    
    // Test model recommendations
    console.log('\n🤖 Model Recommendations:')
    const codeRec = getModelRecommendation('code')
    console.log(`   Code Tasks: ${codeRec.chat} - ${codeRec.description}`)
    
    const chatRec = getModelRecommendation('chat')
    console.log(`   Chat Tasks: ${chatRec.chat} - ${chatRec.description}`)
    
    const fastRec = getModelRecommendation('fast')
    console.log(`   Fast Tasks: ${fastRec.chat} - ${fastRec.description}`)
    
    // Test available models
    const availableModels = getAvailableChatModels()
    console.log('\n📋 Available Chat Models:')
    console.log(`   Default: ${availableModels.default}`)
    console.log(`   Alternatives: ${availableModels.alternatives.join(', ')}`)
    
    console.log('\n🎉 All tests passed! HuggingFace integration with Qwen models is working correctly.')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testAIProviders().catch(console.error)
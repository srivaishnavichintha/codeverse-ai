require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const AIService = require('../src/services/AIService');

async function testPotd() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const dateStr = new Date().toISOString().split('T')[0];
    console.log(`Generating POTD for ${dateStr}...`);
    
    const problem = await AIService.generatePOTD(dateStr);
    
    console.log('✅ Generated problem:');
    console.log(`Title: ${problem.title}`);
    console.log(`Slug: ${problem.slug}`);
    console.log(`Editorial Length: ${problem.editorial?.length || 0} chars`);
    console.log(`Test cases will be saved automatically by AIService.`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to generate POTD:', err);
    process.exit(1);
  }
}

testPotd();

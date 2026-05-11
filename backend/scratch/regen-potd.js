require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const potdService = require('../src/services/potd.service');

async function regen() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Passing null for problemId forces it to auto-generate via Gemini
    const result = await potdService.regeneratePOTD(null, null);
    
    console.log('✅ Successfully regenerated POTD!');
    console.log(`Title: ${result.problem.title}`);
    console.log(`Tags: ${result.problem.tags}`);
    console.log(`Hints Count: ${result.problem.hints?.length || 0}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to regenerate POTD:', err);
    process.exit(1);
  }
}

regen();

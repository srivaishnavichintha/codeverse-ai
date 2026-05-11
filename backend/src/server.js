require('dotenv').config();
const app       = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 CodeVerse API running on port ${PORT} [${process.env.NODE_ENV}]`);
    
    // Initialize POTD Scheduler
    const cron = require('node-cron');
    const potdService = require('./services/potd.service');

    // Runs every day at 12:00 PM
    cron.schedule('0 12 * * *', async () => {
      try {
        console.log('⏰ Running daily POTD generation job...');
        const result = await potdService.regeneratePOTD();
        console.log(`✅ Successfully generated POTD: ${result.problem.title}`);
      } catch (err) {
        console.error('❌ Failed to generate daily POTD:', err.message);
      }
    });
  });
});

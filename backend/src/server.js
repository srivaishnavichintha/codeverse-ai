require('dotenv').config();
const http      = require('http');
const app       = require('./app');
const connectDB = require('./config/db');
const { Server } = require('socket.io');
const { registerContestSockets } = require('./modules/contestZone/sockets/contestZone.socket');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // ── Create HTTP server + Socket.IO ─────────────────────────
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Store io instance on Express app so controllers can access it via req.app.get('io')
  app.set('io', io);

  // Register ContestZone socket handlers
  registerContestSockets(io);

  httpServer.listen(PORT, () => {
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

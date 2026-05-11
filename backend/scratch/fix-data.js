require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const POTD = require('../src/models/POTD');
const Problem = require('../src/models/Problem');
const { Discussion } = require('../src/models/Discussion');
const User = require('../src/models/User');

async function fixData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Fix POTD Link
    const problem = await Problem.findOne({ slug: 'potd-2026-05-09' }); // The one we generated
    if (problem) {
      const today = new Date().toISOString().slice(0, 10);
      await POTD.findOneAndUpdate(
        { date: today },
        { problem: problem._id, selectionMethod: 'auto' },
        { upsert: true }
      );
      console.log(`✅ Linked problem "${problem.title}" to today's POTD.`);
    }

    // 2. Seed Mock Discussions
    let admin = await User.findOne();
    if (!admin) {
      admin = await User.create({
        username: 'mockuser',
        email: 'mock@example.com',
        password: 'password',
        role: 'user',
        isVerified: true
      });
    }

    await Discussion.deleteMany({});
    
    await Discussion.create([
      {
        title: "How to approach dynamic programming problems?",
        body: "I'm struggling with DP. Any tips on how to identify overlapping subproblems?",
        author: admin._id,
        tags: ["dp", "help", "strategy"],
        upvoteCount: 15,
        commentCount: 4,
      },
      {
        title: "Just solved my first Hard problem!",
        body: "After weeks of grinding, I finally solved Merge K Sorted Lists without looking at the editorial!",
        author: admin._id,
        tags: ["success", "motivation"],
        upvoteCount: 42,
        commentCount: 8,
      },
      {
        title: "What's the best way to prepare for system design?",
        body: "Looking for resources to study system design for upcoming interviews.",
        author: admin._id,
        tags: ["system-design", "interview"],
        upvoteCount: 23,
        commentCount: 12,
      }
    ]);
    console.log('✅ Seeded 3 mock discussions.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixData();

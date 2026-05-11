require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const User = require('../models/User');
const Problem = require('../models/Problem');
const TestCase = require('../models/TestCase');

async function seed() {
  await connectDB();
  await Promise.all([User.deleteMany(), Problem.deleteMany(), TestCase.deleteMany()]);

  // Admin user
  const admin = await User.create({
    username: 'admin',
    email: 'admin@codeverse.dev',
    passwordHash: 'Admin@1234',
    displayName: 'CodeVerse Admin',
    role: 'admin',
    isVerified: true,
  });

  // Sample problems
  const twoSum = await Problem.create({
    slug: 'two-sum',
    title: 'Two Sum',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices* of the two numbers such that they add up to \`target\`.`,
    difficulty: 'Easy',
    tags: ['array', 'hash-table'],
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 9' },
    ],
    starterCode: [
      { language: 'python', code: 'def twoSum(self, nums, target):\n    pass' },
      { language: 'javascript', code: 'var twoSum = function(nums, target) {\n    \n};' },
    ],
    isPublished: true,
    createdBy: admin._id,
  });

  await Problem.create({
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    description: 'Given a string `s`, find the length of the longest substring without repeating characters.',
    difficulty: 'Medium',
    tags: ['string', 'sliding-window', 'hash-table'],
    constraints: '0 <= s.length <= 5 * 10^4',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc"' },
    ],
    isPublished: true,
    createdBy: admin._id,
  });

  // Test cases (hidden)
  await TestCase.insertMany([
    { problem: twoSum._id, input: '[2,7,11,15]\n9',  output: '[0,1]', isHidden: false, isSample: true, order: 0 },
    { problem: twoSum._id, input: '[3,2,4]\n6',      output: '[1,2]', isHidden: true,  order: 1 },
    { problem: twoSum._id, input: '[3,3]\n6',        output: '[0,1]', isHidden: true,  order: 2 },
    { problem: twoSum._id, input: '[-1,-2,-3,-4,-5]\n-8', output: '[2,4]', isHidden: true, order: 3 },
  ]);

  console.log('✅ Seed complete');
  mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });

// frontend/src/utils/mockGenerator.js
// Deterministic, seeded mock generator. The seed is the username so the same
// profile renders identically across reloads — evaluators won't see flicker.

function hashString(s = 'codeverse') {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const TOPICS = [
  'Arrays', 'Strings', 'Hash Map', 'Two Pointers', 'Sliding Window',
  'Binary Search', 'Trees', 'Graphs', 'DP', 'Greedy', 'Backtracking', 'Bit Manipulation',
];
const LANGS = ['JavaScript', 'Python', 'C++', 'Java', 'Go', 'Rust'];
const ROLES = ['SDE', 'Frontend', 'ML', 'Backend'];
const ACHIEVEMENT_POOL = [
  { code: 'first_blood', title: 'First Blood', description: 'Solved your first problem', rarity: 'common', icon: '🩸' },
  { code: 'streak_7', title: '7-Day Streak', description: 'Coded 7 days in a row', rarity: 'common', icon: '🔥' },
  { code: 'streak_30', title: '30-Day Streak', description: 'A full month of grind', rarity: 'rare', icon: '⚡' },
  { code: 'contest_top10', title: 'Top 10 Finisher', description: 'Top 10 in a public contest', rarity: 'epic', icon: '🏆' },
  { code: 'battle_5_wins', title: 'Battle Veteran', description: '5 peer battles won in a row', rarity: 'rare', icon: '⚔️' },
  { code: 'interview_90', title: 'Interview Ace', description: 'Scored 90+ in an AI interview', rarity: 'epic', icon: '🎯' },
  { code: 'polyglot', title: 'Polyglot', description: 'Solved problems in 4+ languages', rarity: 'rare', icon: '🌐' },
  { code: 'night_owl', title: 'Night Owl', description: '50 submissions after midnight', rarity: 'common', icon: '🌙' },
  { code: 'legendary_solver', title: 'Legendary Solver', description: 'Solved 25 hard problems', rarity: 'legendary', icon: '👑' },
];

export function genHeatmap(rng, days = 365) {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const r = rng();
    // Cluster activity in waves to look human.
    const intensity = r < 0.45 ? 0 : Math.floor(rng() * 6) + 1;
    out.push({ date: d.toISOString().slice(0, 10), count: intensity });
  }
  return out;
}

export function genWeeklyTrend(rng, weeks = 12) {
  const out = [];
  let baseline = 8 + Math.floor(rng() * 8);
  for (let i = 0; i < weeks; i++) {
    baseline += Math.floor(rng() * 6) - 2;
    baseline = Math.max(3, baseline);
    const solved = baseline + Math.floor(rng() * 4);
    const attempts = solved + Math.floor(rng() * 5);
    out.push({ week: `W${i + 1}`, solved, attempts });
  }
  return out;
}

export function genTopics(rng) {
  return TOPICS.map((t) => ({ topic: t, solved: Math.floor(rng() * 35) + 5 })).sort((a, b) => b.solved - a.solved);
}

export function genLanguages(rng) {
  const picks = LANGS.slice(0, 3 + Math.floor(rng() * 3));
  const raw = picks.map((l) => ({ language: l, count: Math.floor(rng() * 80) + 20 }));
  const total = raw.reduce((s, x) => s + x.count, 0);
  return raw.map((r) => ({ ...r, percent: Math.round((r.count / total) * 100) }));
}

export function genSubmissions(rng) {
  const easy = 40 + Math.floor(rng() * 60);
  const medium = 30 + Math.floor(rng() * 50);
  const hard = 5 + Math.floor(rng() * 25);
  const accepted = easy + medium + hard;
  const total = accepted + Math.floor(rng() * 60) + 20;
  return { total, accepted, easy, medium, hard, accuracy: Math.round((accepted / total) * 100) };
}

export function genContests(rng) {
  const recent = Array.from({ length: 8 }).map((_, i) => {
    const rank = Math.floor(rng() * 1500) + 30;
    const totalParticipants = 2000 + Math.floor(rng() * 4000);
    return {
      _id: `c_${i}`,
      contestTitle: `CodeVerse Round #${120 - i}`,
      type: rng() > 0.3 ? 'public' : 'private',
      rank,
      totalParticipants,
      score: Math.floor(rng() * 600) + 100,
      deltaRating: Math.floor(rng() * 80) - 30,
      ratingAfter: 1500 + Math.floor(rng() * 600),
      finishedAt: new Date(Date.now() - i * 7 * 86400000).toISOString(),
    };
  });
  const totals = {
    participated: recent.length,
    bestRank: Math.min(...recent.map((c) => c.rank)),
    avgRank: Math.round(recent.reduce((a, b) => a + b.rank, 0) / recent.length),
    totalScore: recent.reduce((a, b) => a + b.score, 0),
  };
  return { totals, recent };
}

export function genInterviews(rng) {
  const recent = Array.from({ length: 6 }).map((_, i) => {
    const overall = 60 + Math.floor(rng() * 35);
    return {
      _id: `i_${i}`,
      role: ROLES[i % ROLES.length],
      topic: TOPICS[Math.floor(rng() * TOPICS.length)],
      durationSec: 1500 + Math.floor(rng() * 1200),
      scores: {
        overall,
        technical: Math.max(40, overall + Math.floor(rng() * 10) - 5),
        communication: Math.max(40, overall + Math.floor(rng() * 14) - 7),
        problemSolving: Math.max(40, overall + Math.floor(rng() * 10) - 5),
        codeQuality: Math.max(40, overall + Math.floor(rng() * 10) - 5),
      },
      aiFeedback:
        'Strong structured thinking. Clarified constraints early. Could improve on edge-case enumeration before coding.',
      completedAt: new Date(Date.now() - i * 4 * 86400000).toISOString(),
    };
  });
  const avg = recent.reduce(
    (a, i) => {
      a.overall += i.scores.overall;
      a.technical += i.scores.technical;
      a.communication += i.scores.communication;
      a.problemSolving += i.scores.problemSolving;
      return a;
    },
    { overall: 0, technical: 0, communication: 0, problemSolving: 0 }
  );
  Object.keys(avg).forEach((k) => (avg[k] = Math.round(avg[k] / recent.length)));
  return { count: recent.length, avg, recent };
}

export function genBattles(rng) {
  const recent = Array.from({ length: 10 }).map((_, i) => {
    const won = rng() > 0.4;
    return {
      _id: `b_${i}`,
      opponent: ['neo_dev', 'k4lid', 'astra', 'rustacean', 'hexa', 'queen_bit'][i % 6],
      problemTitle: ['Twin Trees', 'Maze Runner', 'Stream Median', 'Token Joust', 'GraphSprint'][i % 5],
      won,
      eloDelta: won ? +Math.floor(rng() * 24) + 6 : -Math.floor(rng() * 22) - 4,
      durationSec: 600 + Math.floor(rng() * 900),
      finishedAt: new Date(Date.now() - i * 2 * 86400000).toISOString(),
    };
  });
  const wins = recent.filter((b) => b.won).length;
  const losses = recent.length - wins;
  let longest = 0;
  let cur = 0;
  for (const b of recent) {
    if (b.won) {
      cur++;
      longest = Math.max(longest, cur);
    } else cur = 0;
  }
  return {
    wins, losses, total: recent.length,
    winRate: Math.round((wins / recent.length) * 100),
    longestStreak: longest,
    recent,
  };
}

export function genAchievements(rng) {
  const shuffled = [...ACHIEVEMENT_POOL].sort(() => rng() - 0.5);
  return shuffled.slice(0, 6 + Math.floor(rng() * 3)).map((a, i) => ({
    ...a,
    _id: `a_${i}`,
    xpReward: a.rarity === 'legendary' ? 500 : a.rarity === 'epic' ? 250 : a.rarity === 'rare' ? 100 : 25,
    unlockedAt: new Date(Date.now() - i * 5 * 86400000).toISOString(),
  }));
}

export function genSkills(rng) {
  const presets = [
    { name: 'Data Structures', category: 'dsa' },
    { name: 'Algorithms', category: 'dsa' },
    { name: 'System Design', category: 'backend' },
    { name: 'React', category: 'frontend' },
    { name: 'Node.js', category: 'backend' },
    { name: 'TypeScript', category: 'language' },
    { name: 'PyTorch', category: 'aiml' },
    { name: 'Docker', category: 'devops' },
  ];
  return presets.map((p) => ({ ...p, proficiency: 55 + Math.floor(rng() * 40) }));
}

export function genTimeline(rng) {
  const types = [
    { type: 'submission', label: 'Solved', icon: '✅' },
    { type: 'contest', label: 'Contested', icon: '🏆' },
    { type: 'interview', label: 'Interview', icon: '🎤' },
    { type: 'battle', label: 'Battle', icon: '⚔️' },
    { type: 'discussion', label: 'Discussion', icon: '💬' },
    { type: 'achievement', label: 'Unlocked', icon: '🏅' },
  ];
  return Array.from({ length: 14 }).map((_, i) => {
    const t = types[Math.floor(rng() * types.length)];
    return {
      _id: `t_${i}`,
      type: t.type,
      label: t.label,
      icon: t.icon,
      title: ['Trapping Rain Water', 'CodeVerse Round #117', 'Mock Interview: SDE-2', 'Battle vs neo_dev', 'New thread on DP'][i % 5],
      meta: ['Hard · DP', 'Rank 218 of 4321', 'Score 86', 'Won +18 ELO', '12 likes'][i % 5],
      at: new Date(Date.now() - i * 36 * 3600 * 1000).toISOString(),
    };
  });
}

export function genCommunity(rng) {
  return {
    discussions: Math.floor(rng() * 25) + 4,
    comments: Math.floor(rng() * 200) + 30,
    likes: Math.floor(rng() * 600) + 120,
    helpful: Math.floor(rng() * 40) + 5,
    reputation: Math.floor(rng() * 1500) + 250,
  };
}

export function genRankHistory(rng) {
  let r = 1500 + Math.floor(rng() * 400);
  return Array.from({ length: 16 }).map((_, i) => {
    r += Math.floor(rng() * 60) - 25;
    return { round: i + 1, rating: Math.max(800, r) };
  });
}

export function fullMockBundle(username = 'codeverse') {
  const rng = makeRng(hashString(username));
  return {
    submissions: genSubmissions(rng),
    topics: genTopics(rng),
    languages: genLanguages(rng),
    heatmap: genHeatmap(rng),
    weeklyTrend: genWeeklyTrend(rng),
    contests: genContests(rng),
    interviews: genInterviews(rng),
    battles: genBattles(rng),
    achievements: genAchievements(rng),
    skills: genSkills(rng),
    timeline: genTimeline(rng),
    community: genCommunity(rng),
    rankHistory: genRankHistory(rng),
  };
}

export { hashString, makeRng };

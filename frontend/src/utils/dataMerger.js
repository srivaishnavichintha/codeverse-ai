// frontend/src/utils/dataMerger.js
// Real data ALWAYS wins. Mock only fills empties (or sections listed in `gaps`).
import { fullMockBundle } from './mockGenerator';

const isPlainObject = (v) =>
  v != null && typeof v === 'object' && (v.constructor === Object || Object.getPrototypeOf(v) === null);

const isEmpty = (v) => {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
};

export function mergeProfile(real, username) {
  const safeName = username || real?.profile?.username || 'codeverse';
  const mock = fullMockBundle(safeName);
  const gaps = new Set(real?.gaps || []);

  const pick = (key, realVal) => (gaps.has(key) || isEmpty(realVal) ? mock[key] : realVal);

  const realProfile = real?.profile || {};
  const profile = {
    username: safeName,
    displayName: safeName,
    bio: 'Building the future, one commit at a time. AI · Systems · Open Source.',
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(safeName)}`,
    roles: ['member', 'pro'],
    xp: 8420,
    level: 14,
    rank: 217,
    streak: { current: 23, longest: 41 },
    socials: { github: `https://github.com/${safeName}`, linkedin: '#', twitter: '#' },
    profileCompletion: 82,
    createdAt: new Date(Date.now() - 380 * 86400000).toISOString(),
    location: 'Remote · Earth',
    pronouns: 'they/them',
    interests: ['Systems', 'Compilers', 'AI Agents'],
    ...realProfile,
  };
  // Defensive: never let real return a falsy username/displayName.
  profile.username = profile.username || safeName;
  profile.displayName = profile.displayName || profile.username;
  profile.skills = isEmpty(profile.skills) ? mock.skills : profile.skills;
  profile.languages = isEmpty(profile.languages)
    ? mock.languages.map((l) => ({ name: l.language, percent: l.percent }))
    : profile.languages;

  return {
    profile,
    submissions: pick('submissions', real?.submissions),
    topics: pick('topics', real?.topics),
    languages: pick('languages', real?.languages),
    heatmap: pick('heatmap', real?.heatmap),
    weeklyTrend: pick('weeklyTrend', real?.weeklyTrend),
    contests: pick('contests', real?.contests),
    interviews: pick('interviews', real?.interviews),
    battles: pick('battles', real?.battles),
    achievements: pick('achievements', real?.achievements),
    timeline: mock.timeline,
    community: mock.community,
    rankHistory: mock.rankHistory,
  };
}

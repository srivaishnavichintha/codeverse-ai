const fs = require('fs');
let code = fs.readFileSync('src/pages/Battleground/BattlegroundPage.jsx', 'utf8');

// 1. Remove the static constants at the top
code = code.replace(
/const RATING_HISTORY = \[[\\s\\S]*?\];\s*const maxRating = [\\s\\S]*?const ratingRange = maxRating - minRating \|\| 1;/m,
''
);

// 2. Add dynamic variables inside the component
code = code.replace(
/const filtered = challenges.filter\(\(c\) => c.status === tab\);\s*const upcomingForSidebar = challenges.filter\(\(c\) => c.status === "upcoming"\).slice\(0, 3\);\s*const latestRating = stats.rating \|\| RATING_HISTORY\[RATING_HISTORY.length - 1\].score;\s*const prevRating = RATING_HISTORY\[RATING_HISTORY.length - 2\].score;\s*const ratingDelta = latestRating - prevRating;/m,
`  const filtered = challenges.filter((c) => c.status === tab);
  const upcomingForSidebar = challenges.filter((c) => c.status === "upcoming").slice(0, 3);

  const historyData = stats.ratingHistory && stats.ratingHistory.length > 0
    ? stats.ratingHistory
    : [{ label: "Start", score: 1200, win: true }, { label: "Now", score: stats.rating || 1200, win: true }];

  const maxRating = Math.max(...historyData.map((r) => r.score));
  const minRating = Math.min(...historyData.map((r) => r.score));
  const ratingRange = maxRating - minRating || 1;

  const latestRating = historyData[historyData.length - 1].score;
  const prevRating = historyData.length > 1 ? historyData[historyData.length - 2].score : latestRating;
  const ratingDelta = latestRating - prevRating;`
);

// 3. Update the setStats call
code = code.replace(
/const peerStats = statsRes.data\?\.data\?\.peerStats \|\| \{\};\s*setStats\(\{\s*wins: peerStats.contestWins \|\| 0,\s*participated: peerStats.contestsParticipated \|\| 0,\s*globalRank: user.rank \|\| 0,\s*rating: user.rating \|\| 0\s*\}\);/m,
`const peerStats = statsRes.data?.data?.peerStats || {};
        setStats({
          wins: peerStats.contestWins || 0,
          participated: peerStats.contestsParticipated || 0,
          globalRank: peerStats.globalRank || user.rank || 0,
          rating: user.rating || 1200,
          ratingHistory: peerStats.ratingHistory || []
        });`
);

// 4. Update the state initialization
code = code.replace(
  `const [stats, setStats] = useState({ wins: 0, participated: 0, globalRank: 0, rating: 0 });`,
  `const [stats, setStats] = useState({ wins: 0, participated: 0, globalRank: 0, rating: 0, ratingHistory: [] });`
);

// 5. Update JSX usages of RATING_HISTORY
code = code.replace(/RATING_HISTORY\.map/g, 'historyData.map');
code = code.replace(/RATING_HISTORY\[0\]/g, 'historyData[0]');
code = code.replace(/RATING_HISTORY\[RATING_HISTORY/g, 'historyData[historyData');

fs.writeFileSync('src/pages/Battleground/BattlegroundPage.jsx', code);
console.log('Fixed BattlegroundPage rating history!');

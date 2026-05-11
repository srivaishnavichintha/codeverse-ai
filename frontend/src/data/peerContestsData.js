// ============================================================
// CodeVerse — Peer Challenge & Contests Data
// ============================================================

export const CURRENT_USER = {
  id: "u001",
  name: "Arjun Sharma",
  username: "arjun_codes",
  avatar: "AS",
  level: 12,
  rank: "Gold III",
  points: 4820,
  nextLevelPoints: 5500,
  accuracy: 74.3,
  streak: 14,
  problemsSolved: 187,
  totalAttempted: 251,
  contestsParticipated: 18,
  contestWins: 11,
};

export const PEERS = [
  { id: "u002", name: "Priya Nair", username: "priya_nair", avatar: "PN", level: 12, rank: "Gold III", points: 4950, accuracy: 78.1, problemsSolved: 201, streak: 21, contestWins: 13, status: "online" },
  { id: "u003", name: "Rahul Verma", username: "rahul_v", avatar: "RV", level: 11, rank: "Gold II", points: 4420, accuracy: 71.2, problemsSolved: 168, streak: 7, contestWins: 8, status: "in-contest" },
  { id: "u004", name: "Sneha Patel", username: "sneha_codes", avatar: "SP", level: 12, rank: "Gold III", points: 4780, accuracy: 73.5, problemsSolved: 192, streak: 18, contestWins: 10, status: "online" },
  { id: "u005", name: "Karan Mehta", username: "karan_m", avatar: "KM", level: 13, rank: "Gold IV", points: 5120, accuracy: 80.2, problemsSolved: 215, streak: 30, contestWins: 16, status: "offline" },
  { id: "u006", name: "Ananya Singh", username: "ananya_s", avatar: "AS2", level: 11, rank: "Gold II", points: 4380, accuracy: 69.8, problemsSolved: 155, streak: 4, contestWins: 7, status: "online" },
];

export const LEADERBOARD = [
  { rank: 1, name: "Karan Mehta", username: "karan_m", avatar: "KM", points: 5120, level: 13, problemsSolved: 215 },
  { rank: 2, name: "Priya Nair", username: "priya_nair", avatar: "PN", points: 4950, level: 12, problemsSolved: 201 },
  { rank: 3, name: "Sneha Patel", username: "sneha_codes", avatar: "SP", points: 4780, level: 12, problemsSolved: 192 },
  { rank: 4, name: "Arjun Sharma", username: "arjun_codes", avatar: "AS", points: 4820, level: 12, problemsSolved: 187 },
  { rank: 5, name: "Rahul Verma", username: "rahul_v", avatar: "RV", points: 4420, level: 11, problemsSolved: 168 },
  { rank: 6, name: "Ananya Singh", username: "ananya_s", avatar: "AS2", points: 4380, level: 11, problemsSolved: 155 },
];

export const INITIAL_SENT_INVITES = [
  { id: "inv001", to: PEERS[2], sentAt: "2 hours ago", status: "pending", problem: "Binary Search Tree" },
  { id: "inv002", to: PEERS[4], sentAt: "1 day ago", status: "accepted", problem: "Two Sum" },
  { id: "inv003", to: PEERS[1], sentAt: "3 days ago", status: "rejected", problem: "Merge Intervals" },
];

export const INITIAL_RECEIVED_INVITES = [
  { id: "inv101", from: PEERS[0], sentAt: "30 min ago", status: "pending", problem: "Valid Parentheses" },
  { id: "inv102", from: PEERS[3], sentAt: "5 hours ago", status: "pending", problem: "LRU Cache" },
];

export const CONTESTS_DATA = [
  {
    id: 1, title: "Weekly Contest 392", type: "Weekly", status: "ongoing",
    startTime: "2025-06-01T10:00:00Z", duration: 90, participants: 24821, problems: 4,
    description: "Compete with thousands of coders worldwide. Solve 4 problems in 90 minutes.",
    prizes: ["200 CodeCoins", "Weekly Badge", "Leaderboard Points"], difficulty: "Mixed",
    result: null, myRank: null,
  },
  {
    id: 2, title: "Biweekly Contest 128", type: "Biweekly", status: "ongoing",
    startTime: "2025-06-01T14:00:00Z", duration: 90, participants: 18342, problems: 4,
    description: "Biweekly coding challenge featuring medium to hard problems.",
    prizes: ["150 CodeCoins", "Biweekly Badge"], difficulty: "Medium-Hard",
    result: null, myRank: null,
  },
  {
    id: 3, title: "Summer Coding Championship", type: "Special", status: "upcoming",
    startTime: "2025-06-15T09:00:00Z", duration: 300, participants: 0, problems: 6,
    description: "A grand seasonal tournament with exclusive prizes and ranking rewards.",
    prizes: ["5000 CodeCoins", "Champion Trophy", "Interview Fast-Track Badge"], difficulty: "Mixed",
    result: null, myRank: null,
  },
  {
    id: 4, title: "Algorithm Masters Cup", type: "Special", status: "upcoming",
    startTime: "2025-06-20T12:00:00Z", duration: 180, participants: 0, problems: 5,
    description: "Elite-level contest for advanced algorithmic thinkers. Only top 10% qualify.",
    prizes: ["3000 CodeCoins", "Master Badge", "Exclusive T-shirt"], difficulty: "Hard",
    result: null, myRank: null,
  },
  {
    id: 5, title: "Weekly Contest 391", type: "Weekly", status: "past",
    startTime: "2025-05-25T10:00:00Z", duration: 90, participants: 22401, problems: 4,
    myRank: 1284, myScore: 11, result: "win",
    description: "Weekly competitive programming round.",
    prizes: ["200 CodeCoins", "Weekly Badge"], difficulty: "Mixed",
  },
  {
    id: 6, title: "Biweekly Contest 127", type: "Biweekly", status: "past",
    startTime: "2025-05-18T14:00:00Z", duration: 90, participants: 17890, problems: 4,
    myRank: 3842, myScore: 7, result: "loss",
    description: "Biweekly coding challenge.",
    prizes: ["150 CodeCoins", "Biweekly Badge"], difficulty: "Medium-Hard",
  },
  {
    id: 7, title: "Weekly Contest 390", type: "Weekly", status: "past",
    startTime: "2025-05-18T10:00:00Z", duration: 90, participants: 21034, problems: 4,
    myRank: 987, myScore: 12, result: "win",
    description: "Weekly competitive programming round.",
    prizes: ["200 CodeCoins", "Weekly Badge"], difficulty: "Mixed",
  },
  {
    id: 8, title: "Spring Coding Blitz", type: "Special", status: "past",
    startTime: "2025-04-01T00:00:00Z", duration: 180, participants: 38200, problems: 5,
    myRank: 512, myScore: 17, result: "win",
    description: "Special spring contest with exclusive prizes.",
    prizes: ["2500 CodeCoins", "Spring Badge"], difficulty: "Mixed",
  },
];

// Avatar color palette
const AVATAR_COLORS = ["cv-avatar-teal", "cv-avatar-purple", "cv-avatar-rose", "cv-avatar-gold", "cv-avatar-cyan", "cv-avatar-emerald"];
export function getAvatarColor(id = "") {
  const n = parseInt(id.replace(/\D/g, "") || "0");
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export const CHALLENGE_PROBLEMS = [
  "Two Sum", "Reverse Linked List", "Binary Search",
  "Valid Parentheses", "Maximum Subarray", "Climbing Stairs",
  "Best Time to Buy Stock", "Merge Intervals",
];

const { query } = require('../../config/database');

class SubmissionRepository {
  async create({ userId, problemId, language, sourceCode }) {
    const r = await query(
      `INSERT INTO submissions(user_id, problem_id, language, source_code, verdict)
       VALUES($1,$2,$3,$4,'pending')
       RETURNING id, verdict, submitted_at`,
      [userId, problemId, language, sourceCode]
    );
    return r.rows[0];
  }

  async updateVerdict(id, { verdict, runtime_ms, memory_kb, score, error_message, judge_metadata }) {
    const r = await query(
      `UPDATE submissions
       SET verdict = $1, runtime_ms = $2, memory_kb = $3, score = $4,
           error_message = $5, judge_metadata = $6, judged_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [verdict, runtime_ms, memory_kb, score || 0, error_message || null,
       judge_metadata ? JSON.stringify(judge_metadata) : null, id]
    );
    return r.rows[0] || null;
  }

  async findById(id) {
    const r = await query(
      `SELECT s.*, u.username, p.slug AS problem_slug, p.title AS problem_title
       FROM submissions s
       JOIN users    u ON u.id = s.user_id
       JOIN problems p ON p.id = s.problem_id
       WHERE s.id = $1`,
      [id]
    );
    return r.rows[0] || null;
  }

  // Source code is stripped from list views for performance
  async findByUser(userId, { limit, offset, problemId, verdict }) {
    const conditions = ['s.user_id = $1'];
    const values = [userId];
    let i = 2;

    if (problemId) { conditions.push(`s.problem_id = $${i++}`); values.push(problemId); }
    if (verdict)   { conditions.push(`s.verdict = $${i++}`);    values.push(verdict);   }

    const where = 'WHERE ' + conditions.join(' AND ');

    const r = await query(
      `SELECT s.id, s.problem_id, s.language, s.verdict,
              s.runtime_ms, s.memory_kb, s.score, s.submitted_at,
              p.slug AS problem_slug, p.title AS problem_title
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       ${where}
       ORDER BY s.submitted_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const count = await query(
      `SELECT COUNT(*) FROM submissions s ${where}`,
      values
    );

    return { rows: r.rows, total: parseInt(count.rows[0].count) };
  }

  async findByProblem(problemId, { limit, offset, userId }) {
    const conditions = ['s.problem_id = $1'];
    const values = [problemId];
    let i = 2;

    if (userId) { conditions.push(`s.user_id = $${i++}`); values.push(userId); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const r = await query(
      `SELECT s.id, s.user_id, s.language, s.verdict,
              s.runtime_ms, s.memory_kb, s.score, s.submitted_at,
              u.username, u.display_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.submitted_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const count = await query(
      `SELECT COUNT(*) FROM submissions s ${where}`, values
    );

    return { rows: r.rows, total: parseInt(count.rows[0].count) };
  }

  // Leaderboard: fastest accepted submissions per problem
  async getFastestAccepted(problemId, { limit, offset }) {
    const r = await query(
      `SELECT DISTINCT ON (s.user_id)
              s.id, s.user_id, s.language, s.runtime_ms, s.memory_kb,
              s.submitted_at, u.username, u.display_name,
              RANK() OVER (ORDER BY s.runtime_ms ASC) AS rank
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       WHERE s.problem_id = $1 AND s.verdict = 'accepted'
       ORDER BY s.user_id, s.runtime_ms ASC
       LIMIT $2 OFFSET $3`,
      [problemId, limit, offset]
    );
    return r.rows;
  }
}

module.exports = new SubmissionRepository();

const { query, getClient } = require('../../config/database');

class UserRepository {
  async findById(id) {
    const r = await query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url,
              u.bio, u.country, u.github_url, u.linkedin_url, u.website_url,
              u.role, u.is_verified, u.created_at, u.last_seen_at
       FROM users u WHERE u.id = $1 AND u.is_active = TRUE`,
      [id]
    );
    return r.rows[0] || null;
  }

  async findByUsername(username) {
    const r = await query(
      `SELECT id, username, email, password_hash, role, is_active
       FROM users WHERE username = $1`,
      [username]
    );
    return r.rows[0] || null;
  }

  async findByEmail(email) {
    const r = await query(
      `SELECT id, username, email, password_hash, role, is_active
       FROM users WHERE email = $1`,
      [email]
    );
    return r.rows[0] || null;
  }

  async create({ username, email, password_hash, display_name }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO users(username, email, password_hash, display_name)
         VALUES($1,$2,$3,$4) RETURNING id, username, email, display_name, created_at`,
        [username, email, password_hash, display_name || username]
      );
      const user = r.rows[0];
      await client.query(`INSERT INTO user_stats(user_id) VALUES($1)`, [user.id]);
      await client.query('COMMIT');
      return user;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async updateProfile(id, fields) {
    const allowed = ['display_name','bio','country','github_url','linkedin_url','website_url','avatar_url'];
    const updates = [];
    const values  = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = $${i++}`); values.push(v); }
    }
    if (!updates.length) return null;
    values.push(id);
    const r = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${i} RETURNING id, username, display_name, updated_at`,
      values
    );
    return r.rows[0] || null;
  }

  async getStats(userId) {
    const r = await query(
      `SELECT us.*,
              ROUND(
                us.accepted_submissions::NUMERIC / NULLIF(us.total_submissions, 0) * 100, 2
              ) AS accuracy_pct
       FROM user_stats us WHERE us.user_id = $1`,
      [userId]
    );
    return r.rows[0] || null;
  }

  async getSolvedProblems(userId, { limit, offset }) {
    const r = await query(
      `SELECT p.id, p.slug, p.title, p.difficulty, ups.first_solved_at,
              ups.best_runtime_ms, ups.best_memory_kb
       FROM user_problem_stats ups
       JOIN problems p ON p.id = ups.problem_id
       WHERE ups.user_id = $1 AND ups.is_solved = TRUE
       ORDER BY ups.first_solved_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const count = await query(
      `SELECT COUNT(*) FROM user_problem_stats WHERE user_id = $1 AND is_solved = TRUE`,
      [userId]
    );
    return { rows: r.rows, total: parseInt(count.rows[0].count) };
  }

  async getActivity(userId, days = 365) {
    const r = await query(
      `SELECT active_date, submissions
       FROM user_activity
       WHERE user_id = $1 AND active_date >= NOW() - INTERVAL '${days} days'
       ORDER BY active_date ASC`,
      [userId]
    );
    return r.rows;
  }

  async getLeaderboard({ limit, offset }) {
    const r = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.country,
              us.total_solved, us.rating, us.rank,
              RANK() OVER (ORDER BY us.rating DESC) AS position
       FROM user_stats us
       JOIN users u ON u.id = us.user_id
       WHERE u.is_active = TRUE
       ORDER BY us.rating DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await query(`SELECT COUNT(*) FROM users WHERE is_active = TRUE`);
    return { rows: r.rows, total: parseInt(count.rows[0].count) };
  }

  async saveRefreshToken(userId, tokenHash, expiresAt) {
    await query(
      `INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES($1,$2,$3)`,
      [userId, tokenHash, expiresAt]
    );
  }

  async revokeRefreshToken(tokenHash) {
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
  }

  async findRefreshToken(tokenHash) {
    const r = await query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );
    return r.rows[0] || null;
  }
}

module.exports = new UserRepository();

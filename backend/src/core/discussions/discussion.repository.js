const { query, getClient } = require('../../config/database');

class DiscussionRepository {
  async findByProblem(problemId, { limit, offset, sort = 'newest' }) {
    const orderMap = {
      newest:   'd.created_at DESC',
      oldest:   'd.created_at ASC',
      popular:  'd.upvotes DESC',
    };
    const order = orderMap[sort] || orderMap.newest;

    const r = await query(
      `SELECT d.id, d.title, d.status, d.view_count, d.upvotes, d.downvotes,
              d.is_pinned, d.created_at, d.updated_at,
              u.id AS author_id, u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*) FROM comments c WHERE c.discussion_id = d.id
                AND c.is_deleted = FALSE) AS comment_count
       FROM discussions d
       JOIN users u ON u.id = d.author_id
       WHERE d.problem_id = $1
       ORDER BY d.is_pinned DESC, ${order}
       LIMIT $2 OFFSET $3`,
      [problemId, limit, offset]
    );

    const count = await query(
      `SELECT COUNT(*) FROM discussions WHERE problem_id = $1`, [problemId]
    );

    return { rows: r.rows, total: parseInt(count.rows[0].count) };
  }

  async findById(id) {
    const r = await query(
      `SELECT d.*, u.username, u.display_name, u.avatar_url
       FROM discussions d JOIN users u ON u.id = d.author_id
       WHERE d.id = $1`,
      [id]
    );
    return r.rows[0] || null;
  }

  async create({ problemId, authorId, title, body }) {
    const r = await query(
      `INSERT INTO discussions(problem_id, author_id, title, body)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [problemId, authorId, title, body]
    );
    return r.rows[0];
  }

  async incrementViews(id) {
    await query(`UPDATE discussions SET view_count = view_count + 1 WHERE id = $1`, [id]);
  }

  async update(id, { title, body }) {
    const updates = [];
    const values  = [];
    let i = 1;
    if (title) { updates.push(`title = $${i++}`); values.push(title); }
    if (body)  { updates.push(`body = $${i++}`);  values.push(body);  }
    if (!updates.length) return null;
    values.push(id);
    const r = await query(
      `UPDATE discussions SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${i} RETURNING *`,
      values
    );
    return r.rows[0] || null;
  }

  async delete(id) {
    await query(`DELETE FROM discussions WHERE id = $1`, [id]);
  }

  // ── Comments ────────────────────────────────────────────────────────────────

  async getComments(discussionId, { limit, offset }) {
    const r = await query(
      `SELECT c.id, c.parent_id, c.body, c.upvotes, c.downvotes,
              c.is_deleted, c.created_at, c.updated_at,
              u.id AS author_id, u.username, u.display_name, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.discussion_id = $1 AND c.parent_id IS NULL AND c.is_deleted = FALSE
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [discussionId, limit, offset]
    );

    const count = await query(
      `SELECT COUNT(*) FROM comments
       WHERE discussion_id = $1 AND parent_id IS NULL AND is_deleted = FALSE`,
      [discussionId]
    );

    // Fetch replies for each top-level comment
    const commentIds = r.rows.map(c => c.id);
    let replies = [];
    if (commentIds.length) {
      const rep = await query(
        `SELECT c.*, u.username, u.display_name, u.avatar_url
         FROM comments c JOIN users u ON u.id = c.author_id
         WHERE c.parent_id = ANY($1) AND c.is_deleted = FALSE
         ORDER BY c.created_at ASC`,
        [commentIds]
      );
      replies = rep.rows;
    }

    const replyMap = {};
    for (const reply of replies) {
      if (!replyMap[reply.parent_id]) replyMap[reply.parent_id] = [];
      replyMap[reply.parent_id].push(reply);
    }

    const threaded = r.rows.map(c => ({ ...c, replies: replyMap[c.id] || [] }));
    return { rows: threaded, total: parseInt(count.rows[0].count) };
  }

  async createComment({ discussionId, authorId, parentId, body }) {
    const r = await query(
      `INSERT INTO comments(discussion_id, author_id, parent_id, body)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [discussionId, authorId, parentId || null, body]
    );
    return r.rows[0];
  }

  async findCommentById(id) {
    const r = await query(`SELECT * FROM comments WHERE id = $1`, [id]);
    return r.rows[0] || null;
  }

  async updateComment(id, body) {
    const r = await query(
      `UPDATE comments SET body = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [body, id]
    );
    return r.rows[0] || null;
  }

  async softDeleteComment(id) {
    await query(
      `UPDATE comments SET is_deleted = TRUE, body = '[deleted]', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  // ── Votes ───────────────────────────────────────────────────────────────────

  async vote(userId, targetType, targetId, value) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id, value FROM votes
         WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
        [userId, targetType, targetId]
      );

      const table = targetType === 'discussion' ? 'discussions' : 'comments';

      if (existing.rows.length) {
        const prev = existing.rows[0].value;
        if (prev === value) {
          // Toggle off (undo vote)
          await client.query(
            `DELETE FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
            [userId, targetType, targetId]
          );
          const col = value === 'upvote' ? 'upvotes' : 'downvotes';
          await client.query(
            `UPDATE ${table} SET ${col} = GREATEST(0, ${col} - 1) WHERE id = $1`,
            [targetId]
          );
        } else {
          // Switch vote
          await client.query(
            `UPDATE votes SET value = $1 WHERE user_id = $2 AND target_type = $3 AND target_id = $4`,
            [value, userId, targetType, targetId]
          );
          const addCol = value === 'upvote' ? 'upvotes' : 'downvotes';
          const subCol = value === 'upvote' ? 'downvotes' : 'upvotes';
          await client.query(
            `UPDATE ${table} SET ${addCol} = ${addCol} + 1,
             ${subCol} = GREATEST(0, ${subCol} - 1) WHERE id = $1`,
            [targetId]
          );
        }
      } else {
        await client.query(
          `INSERT INTO votes(user_id, target_type, target_id, value) VALUES($1,$2,$3,$4)`,
          [userId, targetType, targetId, value]
        );
        const col = value === 'upvote' ? 'upvotes' : 'downvotes';
        await client.query(
          `UPDATE ${table} SET ${col} = ${col} + 1 WHERE id = $1`,
          [targetId]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = new DiscussionRepository();

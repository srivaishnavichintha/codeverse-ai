const { query, getClient } = require('../../config/database');

class ProblemRepository {
  async findAll({ limit, offset, difficulty, tagSlug, search, userId }) {
    const conditions = ['p.is_published = TRUE'];
    const values = [];
    let i = 1;

    if (difficulty) { conditions.push(`p.difficulty = $${i++}`); values.push(difficulty); }
    if (tagSlug) {
      conditions.push(`EXISTS (
        SELECT 1 FROM problem_tags pt JOIN tags t ON t.id = pt.tag_id
        WHERE pt.problem_id = p.id AND t.slug = $${i++}
      )`);
      values.push(tagSlug);
    }
    if (search) {
      conditions.push(`to_tsvector('english', p.title || ' ' || COALESCE(p.description,'')) @@ plainto_tsquery($${i++})`);
      values.push(search);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Solved status for authenticated user
    const solvedJoin = userId
      ? `LEFT JOIN user_problem_stats ups ON ups.problem_id = p.id AND ups.user_id = '${userId}'`
      : '';
    const solvedSelect = userId ? ', ups.is_solved' : ', FALSE AS is_solved';

    const r = await query(
      `SELECT p.id, p.slug, p.title, p.difficulty, p.created_at,
              ps.total_submissions, ps.accepted_count,
              ROUND(ps.accepted_count::NUMERIC / NULLIF(ps.total_submissions,0)*100,1) AS acceptance_rate,
              ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
              ${solvedSelect}
       FROM problems p
       LEFT JOIN problem_stats ps ON ps.problem_id = p.id
       LEFT JOIN problem_tags pt  ON pt.problem_id = p.id
       LEFT JOIN tags t            ON t.id = pt.tag_id
       ${solvedJoin}
       ${where}
       GROUP BY p.id, ps.total_submissions, ps.accepted_count ${userId ? ', ups.is_solved' : ''}
       ORDER BY p.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(DISTINCT p.id) FROM problems p
       LEFT JOIN problem_tags pt ON pt.problem_id = p.id
       LEFT JOIN tags t ON t.id = pt.tag_id
       ${where}`,
      values
    );

    return { rows: r.rows, total: parseInt(countResult.rows[0].count) };
  }

  async findBySlug(slug, userId = null) {
    const solvedJoin = userId
      ? `LEFT JOIN user_problem_stats ups ON ups.problem_id = p.id AND ups.user_id = '${userId}'`
      : '';
    const solvedSelect = userId ? ', ups.is_solved, ups.attempts, ups.best_runtime_ms' : ', FALSE AS is_solved, 0 AS attempts, NULL AS best_runtime_ms';

    const r = await query(
      `SELECT p.*,
              ps.total_attempts, ps.total_submissions, ps.accepted_count,
              ROUND(ps.accepted_count::NUMERIC / NULLIF(ps.total_submissions,0)*100,1) AS acceptance_rate,
              ARRAY_AGG(DISTINCT jsonb_build_object('name', t.name, 'slug', t.slug))
                FILTER (WHERE t.name IS NOT NULL) AS tags
              ${solvedSelect}
       FROM problems p
       LEFT JOIN problem_stats ps ON ps.problem_id = p.id
       LEFT JOIN problem_tags pt  ON pt.problem_id = p.id
       LEFT JOIN tags t            ON t.id = pt.tag_id
       ${solvedJoin}
       WHERE p.slug = $1 AND p.is_published = TRUE
       GROUP BY p.id, ps.total_attempts, ps.total_submissions, ps.accepted_count
                ${userId ? ', ups.is_solved, ups.attempts, ups.best_runtime_ms' : ''}`,
      [slug]
    );
    return r.rows[0] || null;
  }

  async findById(id) {
    const r = await query(`SELECT * FROM problems WHERE id = $1`, [id]);
    return r.rows[0] || null;
  }

  async getExamples(problemId) {
    const r = await query(
      `SELECT id, input, output, explanation, sort_order
       FROM problem_examples WHERE problem_id = $1 ORDER BY sort_order`,
      [problemId]
    );
    return r.rows;
  }

  // Only visible test cases are returned via API — hidden ones stay server-side
  async getVisibleTestCases(problemId) {
    const r = await query(
      `SELECT id, input, expected_output, sort_order
       FROM test_cases WHERE problem_id = $1 AND visibility = 'visible'
       ORDER BY sort_order`,
      [problemId]
    );
    return r.rows;
  }

  // Used by the judge service only — never exposed to API consumers
  async getAllTestCases(problemId) {
    const r = await query(
      `SELECT id, visibility, input, expected_output, score_weight, sort_order
       FROM test_cases WHERE problem_id = $1 ORDER BY sort_order`,
      [problemId]
    );
    return r.rows;
  }

  async create(data, createdBy) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { title, description, difficulty, constraints, hints,
              time_limit_ms, memory_limit_kb, tags, examples, test_cases } = data;

      const slug = require('slugify')(title, { lower: true, strict: true });

      const r = await client.query(
        `INSERT INTO problems(slug, title, description, difficulty, constraints, hints,
                              time_limit_ms, memory_limit_kb, created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [slug, title, description, difficulty, constraints, hints || null,
         time_limit_ms || 2000, memory_limit_kb || 262144, createdBy]
      );
      const problem = r.rows[0];

      // Tags
      if (tags?.length) {
        for (const tagName of tags) {
          await client.query(
            `INSERT INTO tags(name, slug) VALUES($1, $2) ON CONFLICT(slug) DO NOTHING`,
            [tagName, require('slugify')(tagName, { lower: true })]
          );
          await client.query(
            `INSERT INTO problem_tags(problem_id, tag_id)
             SELECT $1, id FROM tags WHERE name = $2 ON CONFLICT DO NOTHING`,
            [problem.id, tagName]
          );
        }
      }

      // Examples
      if (examples?.length) {
        for (let i = 0; i < examples.length; i++) {
          const ex = examples[i];
          await client.query(
            `INSERT INTO problem_examples(problem_id, input, output, explanation, sort_order)
             VALUES($1,$2,$3,$4,$5)`,
            [problem.id, ex.input, ex.output, ex.explanation || null, i]
          );
        }
      }

      // Test cases
      if (test_cases?.length) {
        for (let i = 0; i < test_cases.length; i++) {
          const tc = test_cases[i];
          await client.query(
            `INSERT INTO test_cases(problem_id, visibility, input, expected_output, score_weight, sort_order)
             VALUES($1,$2,$3,$4,$5,$6)`,
            [problem.id, tc.visibility || 'hidden', tc.input, tc.expected_output,
             tc.score_weight || 1.0, i]
          );
        }
      }

      await client.query('COMMIT');
      return problem;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id, fields, changedBy) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Save version snapshot
      const current = await client.query(`SELECT * FROM problems WHERE id = $1`, [id]);
      if (!current.rows.length) throw new Error('Problem not found');
      const prev = current.rows[0];

      await client.query(
        `INSERT INTO problem_versions(problem_id, version, title, description, diff_summary, changed_by)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [id, prev.version, prev.title, prev.description, fields.diff_summary || null, changedBy]
      );

      const allowed = ['title','description','difficulty','constraints','hints',
                       'time_limit_ms','memory_limit_kb','is_published'];
      const updates = [];
      const values  = [];
      let i = 1;
      for (const [k, v] of Object.entries(fields)) {
        if (allowed.includes(k)) { updates.push(`${k} = $${i++}`); values.push(v); }
      }
      updates.push(`version = version + 1`);
      updates.push(`updated_at = NOW()`);
      values.push(id);

      const r = await client.query(
        `UPDATE problems SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );

      await client.query('COMMIT');
      return r.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getStats(problemId) {
    const r = await query(
      `SELECT ps.*,
              ROUND(ps.accepted_count::NUMERIC / NULLIF(ps.total_submissions,0)*100,2) AS acceptance_rate
       FROM problem_stats ps WHERE ps.problem_id = $1`,
      [problemId]
    );
    return r.rows[0] || null;
  }

  async getAllTags() {
    const r = await query(
      `SELECT t.id, t.name, t.slug, COUNT(pt.problem_id) AS problem_count
       FROM tags t LEFT JOIN problem_tags pt ON pt.tag_id = t.id
       GROUP BY t.id ORDER BY t.name`
    );
    return r.rows;
  }
}

module.exports = new ProblemRepository();

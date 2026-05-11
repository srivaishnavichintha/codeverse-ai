import { api, setAuthToken, getAuthToken, isAuthenticated } from './apiClient.js';

export { setAuthToken, getAuthToken, isAuthenticated };

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE NORMALIZER
// Supports:
// 1. { success: true, data: ... }
// 2. Flat mock responses
// 3. Axios response wrappers
// ─────────────────────────────────────────────────────────────────────────────
function unwrap(response) {
  const raw = response?.data ?? response;

  if (
    raw &&
    typeof raw === 'object' &&
    raw.success !== undefined &&
    raw.data !== undefined
  ) {
    return raw.data;
  }

  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function normalizePagination(payload, params = {}) {
  // Flat array support
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      page: Number(params.page || 1),
      pageSize: Number(params.pageSize || 15),
    };
  }

  // Wrapped pagination support
  if (payload?.pagination) {
    return {
      items:
        payload?.data ??
        payload?.items ??
        payload?.docs ??
        [],

      total:
        payload?.pagination?.total ??
        payload?.pagination?.count ??
        0,

      page:
        payload?.pagination?.page ??
        1,

      pageSize:
        payload?.pagination?.limit ??
        payload?.pagination?.pageSize ??
        params.pageSize ??
        15,
    };
  }

  // Fallback
  return {
    items:
      payload?.data ??
      payload?.items ??
      payload?.docs ??
      [],

    total:
      payload?.total ??
      0,

    page:
      payload?.page ??
      1,

    pageSize:
      payload?.pageSize ??
      15,
  };
}

function normalizeProblem(problem) {
  if (!problem) return null;

  return {
    ...problem,

    id:
      problem.id ??
      problem._id?.toString(),

    acceptance:
      problem.acceptance ??
      problem.acceptanceRate ??
      0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMS API
// ─────────────────────────────────────────────────────────────────────────────
export const ProblemsAPI = {
  // GET /problems
  list: async (params = {}) => {
    const response = await api.get('/problems', { params });

    const payload = unwrap(response);

    return normalizePagination(payload, params);
  },

  // GET /problems/:slug
  detail: async (slug) => {
    const response = await api.get(`/problems/${slug}`);

    const payload = unwrap(response);

    return normalizeProblem(payload);
  },

  // GET /problems/tags
  tags: async () => {
    const response = await api.get('/problems/tags');

    return unwrap(response);
  },

  // Since backend DOES NOT HAVE these routes yet,
  // keep safe fallback responses

  editorial: async (slug) => {
    try {
      const response = await api.get(`/problems/${slug}/editorial`);

      return unwrap(response);
    } catch (err) {
      return null;
    }
  },

  solutions: async (slug) => {
    try {
      const response = await api.get(`/problems/${slug}/solutions`);

      return unwrap(response);
    } catch (err) {
      return [];
    }
  },

  discussions: async (slug, params = {}) => {
    try {
      const response = await api.get(
        `/problems/${slug}/discussions`,
        { params }
      );

      return unwrap(response);
    } catch (err) {
      return [];
    }
  },

  postDiscussion: async (slug, body) => {
    try {
      const response = await api.post(
        `/problems/${slug}/discussions`,
        body
      );

      return unwrap(response);
    } catch (err) {
      throw err;
    }
  },

  like: async (slug) => {
    try {
      const response = await api.post(
        `/problems/${slug}/like`
      );

      return unwrap(response);
    } catch (err) {
      throw err;
    }
  },

  dislike: async (slug) => {
    try {
      const response = await api.post(
        `/problems/${slug}/dislike`
      );

      return unwrap(response);
    } catch (err) {
      throw err;
    }
  },

  bookmark: async (slug) => {
    try {
      const response = await api.post(
        `/problems/${slug}/bookmark`
      );

      return unwrap(response);
    } catch (err) {
      throw err;
    }
  },

  // ADMIN

  create: async (body) => {
    const response = await api.post(
      '/problems',
      body
    );

    return unwrap(response);
  },

  update: async (problemId, body) => {
    const response = await api.patch(
      `/problems/${problemId}`,
      body
    );

    return unwrap(response);
  },

  stats: async (problemId) => {
    const response = await api.get(
      `/problems/${problemId}/stats`
    );

    return unwrap(response);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// POTD API
// ─────────────────────────────────────────────────────────────────────────────
export const POTDAPI = {
  get: async () => {
    try {
      const response = await api.get('/potd');

      const payload = unwrap(response);

      return {
        problem: payload?.problem ?? null,
        streak: payload?.streak ?? 0,
        lastSolvedAt: payload?.lastSolvedAt ?? null,
        date: payload?.date ?? null,
      };
    } catch (err) {
      return {
        problem: null,
        streak: 0,
        lastSolvedAt: null,
        date: null,
      };
    }
  },

  submit: async (payload) => {
    const response = await api.post(
      '/potd/submit',
      payload
    );

    return unwrap(response);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS API
// ─────────────────────────────────────────────────────────────────────────────
export const StatsAPI = {
  problemStats: async () => {
    const response = await api.get(
      '/user/problem-stats'
    );

    return unwrap(response);
  },

  recentSubmissions: async () => {
    const response = await api.get(
      '/submissions/recent'
    );

    const payload = unwrap(response);

    if (Array.isArray(payload)) {
      return {
        items: payload.slice(0, 5),
      };
    }

    return {
      items:
        (
          payload?.items ??
          payload?.docs ??
          payload?.data ??
          []
        ).slice(0, 5),
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGES API
// ─────────────────────────────────────────────────────────────────────────────
export const ChallengesAPI = {
  daily: async () => {
    try {
      const response = await api.get(
        '/challenges/daily'
      );

      return unwrap(response);
    } catch (err) {
      return [];
    }
  },

  join: async (id) => {
    const response = await api.post(
      '/challenges/join',
      { id }
    );

    return unwrap(response);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CODE API
// ─────────────────────────────────────────────────────────────────────────────
export const CodeAPI = {
  template: async (language, slug) => {
    const DEFAULT_TEMPLATES = {
      cpp: '#include <iostream>\n\nint main() {\n    // Write C++ code here\n \n\n    return 0;\n}',
      java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write Java code here\n        \n    }\n}',
      python: 'def solve():\n    # Write Python code here\n    pass\n\nif __name__ == "__main__":\n    solve()',
      javascript: 'function solve() {\n    // Write JavaScript code here\n    \n}\n\nsolve();'
    };

    try {
      if (slug) {
        const response = await api.get(
          `/problems/${slug}`
        );

        const problem = normalizeProblem(
          unwrap(response)
        );

        const code =
          problem?.starterCode?.[language] ??
          problem?.starterCode ??
          '';

        if (code && typeof code === 'string' && code.trim().length > 0 && !code.includes('// start coding')) {
          return {
            language,
            code,
          };
        }
      }
    } catch (err) {
      // Ignore and use fallback
    }

    return {
      language,
      code: DEFAULT_TEMPLATES[language] || '// start coding\n',
    };
  },

  // POST /code/run
  run: async (payload) => {
    try {
      const response = await api.post(
        '/code/run',
        payload
      );

      const data = unwrap(response);

      return {
        verdict: data?.verdict ?? data?.status ?? 'Unknown',
        status: data?.status ?? 'Unknown',
        output: data?.output ?? data?.stdout ?? '',
        error: data?.error ?? data?.stderr ?? data?.compile_output ?? '',
        cases: data?.cases ?? null,
        runtimeMs: data?.runtimeMs ?? null,
        memoryKb: data?.memoryKb ?? null,
        runtime: data?.runtimeMs != null ? `${data.runtimeMs} ms` : null,
        memory: data?.memoryKb != null ? `${(data.memoryKb / 1024).toFixed(2)} MB` : null,
      };
    } catch (err) {
      if (err.response && err.response.status === 429) {
        return {
          verdict: 'Rate Limit Exceeded',
          status: 'failed',
          error: 'You have exceeded the Daily quota for Submissions on the Judge0 API Free Plan. Please wait or upgrade your API key.',
          output: '',
          cases: null,
          runtimeMs: null,
          memoryKb: null
        };
      }
      return {
        verdict: 'Error',
        status: 'failed',
        error: err.response?.data?.message || err.message,
        cases: null
      };
    }
  },

  // POST /code/submit
  submit: async (payload) => {
    try {
      const response = await api.post(
        '/submissions',
        payload
      );

      const data = unwrap(response);

      const testResults = data?.testResults ?? [];

      return {
        verdict: data?.verdict ?? data?.status ?? 'Pending',
        passed: data?.passed ?? data?.passedCount ?? data?.testCasesPassed ?? 0,
        total: data?.total ?? data?.totalCount ?? data?.totalTestCases ?? 0,
        runtimeMs: data?.runtimeMs ?? null,
        memoryKb: data?.memoryKb ?? null,
        runtime: data?.runtimeMs != null ? `${data.runtimeMs} ms` : null,
        memory: data?.memoryKb != null ? `${(data.memoryKb / 1024).toFixed(2)} MB` : null,
        testResults,
        cases: testResults.map((t, index) => ({
          id: index,
          status: t?.passed ? 'accepted' : 'failed',
          input: t?.input ?? '',
          expected: t?.expectedOutput ?? t?.expected ?? '',
          got: t?.actualOutput ?? t?.got ?? '',
          error: t?.error ?? '',
        })),
        _id: data?._id ?? null,
      };
    } catch (err) {
      if (err.response && err.response.status === 429) {
        return {
          verdict: 'Rate Limit Exceeded',
          status: 'failed',
          error: 'You have exceeded the Daily quota for Submissions on the Judge0 API Free Plan. Please wait or upgrade your API key.',
          testResults: [],
          cases: [],
          passed: 0,
          total: 0,
          runtimeMs: null,
          memoryKb: null
        };
      }
      return {
        verdict: 'Error',
        status: 'failed',
        error: err.response?.data?.message || err.message,
        testResults: [],
        cases: [],
        passed: 0,
        total: 0
      };
    }
  },

  saveDraft: async (payload) => {
    const response = await api.post(
      '/code/save-draft',
      payload
    );

    return unwrap(response);
  },

  reset: async (payload) => {
    const response = await api.post(
      '/code/reset',
      payload
    );

    return unwrap(response);
  },

  customTestcase: async (payload) => {
    const response = await api.post(
      '/code/custom-testcase',
      payload
    );

    return unwrap(response);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH API
// ─────────────────────────────────────────────────────────────────────────────
export const AuthAPI = {
  register: async (body) => {
    const response = await api.post(
      '/auth/register',
      body
    );

    const payload = response.data;
    return {
      token: payload.token,
      user: payload.data?.user || payload.user,
    };
  },

  login: async (body) => {
    const response = await api.post(
      '/auth/login',
      body
    );

    const payload = response.data;
    return {
      token: payload.token,
      user: payload.data?.user || payload.user,
    };
  },

  me: async () => {
    const response = await api.get(
      '/auth/me'
    );

    return unwrap(response);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS API
// ─────────────────────────────────────────────────────────────────────────────
export const SubmissionsAPI = {
  // GET /submissions
  list: async (params = {}) => {
    const response = await api.get(
      '/submissions',
      { params }
    );

    return unwrap(response);
  },

  // GET /submissions/:submissionId
  get: async (submissionId) => {
    const response = await api.get(
      `/submissions/${submissionId}`
    );

    return unwrap(response);
  },

  // GET /problems/:problemId/submissions
  byProblem: async (problemId) => {
    const response = await api.get(
      `/problems/${problemId}/submissions`
    );

    const payload = unwrap(response);

    if (Array.isArray(payload)) {
      return payload;
    }

    return (
      payload?.items ??
      payload?.docs ??
      payload?.data ??
      []
    );
  },

  // GET /submissions/problem/:problemId/fastest
  fastest: async (problemId) => {
    const response = await api.get(
      `/submissions/problem/${problemId}/fastest`
    );

    return unwrap(response);
  },

  // GET /submissions
  mine: async () => {
    const response = await api.get(
      '/submissions'
    );

    return unwrap(response);
  },
};
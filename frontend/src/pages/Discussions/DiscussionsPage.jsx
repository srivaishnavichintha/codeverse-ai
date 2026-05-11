import { useEffect } from "react";
import { api } from "../../services/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
   DISCUSSION_TAGS, CATEGORIES, TRENDING_POSTS,
  TOP_CONTRIBUTORS, timeAgo, POST_TYPE_MAP,
} from "../../data/discussionsData.js";
import { POTDAPI } from "../../services/problemsService.js";
import { deleteDiscussion } from "../../services/discussions.service.js";
import Icon from "../../components/Icon/Icon.jsx";
import "./Discussions.css";

export default function DiscussionsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("All");
  const [selectedTags, setSelectedTags] = useState([]);
  const [sort, setSort] = useState("recent");
  const [createOpen, setCreateOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [potd, setPotd] = useState(null);
  const navigate = useNavigate();

  const toggleTag = (t) =>
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const filteredPosts = useMemo(() => {
    let list = [...posts];

    if (query) {
      const q = query.toLowerCase();

      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.preview.toLowerCase().includes(q)
      );
    }

    if (category !== "all") {
      const targetType = POST_TYPE_MAP[category];
      if (targetType) {
        list = list.filter((p) => p.type === targetType);
      }
    }

    if (difficulty !== "All") {
      list = list.filter((p) => p.difficulty === difficulty);
    }

    if (selectedTags.length > 0) {
      list = list.filter((p) => selectedTags.every((t) => p.tags?.includes(t)));
    }

    if (sort === "upvoted") {
      list.sort((a, b) => b.upvotes - a.upvotes);
    } else if (sort === "commented") {
      list.sort((a, b) => b.comments - a.comments);
    } else {
      list.sort(
        (a, b) =>
          new Date(b.timestamp) - new Date(a.timestamp)
      );
    }

    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    return list;
  }, [posts, query, sort, category, difficulty, selectedTags]);

  const fetchDiscussions = async () => {
    try {
      setLoading(true);

      const [res, trendRes, contribRes, potdRes] = await Promise.all([
        api.get("/discussions"),
        api.get("/discussions/stats/trending"),
        api.get("/discussions/stats/contributors"),
        POTDAPI.get().catch(() => null) // Ignore error if POTD fails
      ]);

      const mapped = (res.data?.data?.docs ?? []).map((d) => ({
        id: d._id,
        title: d.title,
        preview: d.body,
        body: d.body,
        tags: d.tags,
        comments: d.commentCount,
        upvotes: d.upvoteCount,
        upvotedBy: d.upvotedBy,
        timestamp: d.createdAt,
        author: d.author?.username,
        avatar: d.author?.username?.slice(0, 2).toUpperCase(),
        rating: d.author?.level || 0,
        type: d.category || (d.problem ? "problem" : (d.tags && d.tags.includes("interview")) ? "interview" : "general"),
        isPinned: d.isPinned,
      }));

      setPosts(mapped);
      setTrending(trendRes.data.data || []);
      setContributors(contribRes.data.data || []);
      if (potdRes) setPotd(potdRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        Loading discussions...
      </div>
    );
  }

  return (
    <>
      <div className="cv-discussions-layout">
        {/* Left sidebar */}
        <aside className="cv-discussions-left">
          <button
            className="cv-btn cv-btn-primary cv-disc-create-btn"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="plus" size={14} /> Create Post
          </button>

          <div>
            <div className="cv-disc-section-title">Categories</div>
            <ul className="cv-disc-cat-list">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <button
                    className={`cv-disc-cat-btn${category === c.id ? " active" : ""}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="cv-disc-section-title">Difficulty</div>
            <div className="cv-disc-diff-row">
              {["All", "Easy", "Medium", "Hard"].map((d) => (
                <button
                  key={d}
                  className={`cv-disc-diff-btn${difficulty === d ? " active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="cv-disc-section-title">Tags</div>
            <div className="cv-disc-tags-wrap">
              {DISCUSSION_TAGS.map((t) => (
                <button
                  key={t}
                  className={`cv-disc-tag-btn${selectedTags.includes(t) ? " active" : ""}`}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main feed */}
        <main style={{ minWidth: 0 }}>
          {/* Search Bar */}
          <div className="cv-glass" style={{ marginBottom: 20, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="search" size={16} color="var(--text-faint)" />
            <input
              type="text"
              placeholder="Search discussions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", flex: 1, fontSize: 14
              }}
            />
          </div>

          {/* Sort bar */}
          <div className="cv-disc-feed-header">
            <div className="cv-disc-sort-tabs">
              {[
                { id: "recent", label: "Most Recent" },
                { id: "upvoted", label: "Most Upvoted" },
                { id: "commented", label: "Most Discussed" },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`cv-disc-sort-btn${sort === t.id ? " active" : ""}`}
                  onClick={() => setSort(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="cv-disc-count">{filteredPosts.length} posts</span>
          </div>

          <div className="cv-disc-posts">
            {filteredPosts.length === 0 ? (
              <div className="cv-glass" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                <div style={{ font: "700 16px var(--font-display)", color: "var(--text-primary)" }}>
                  No posts match
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                  Try adjusting your filters or create the first post!
                </div>
              </div>
            ) : (
              filteredPosts.map((p, i) => (
                <div key={p.id} className="anim-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <PostCard post={p} onDelete={(id) => setPosts(prev => prev.filter(x => x.id !== id))} />
                </div>
              ))
            )}
          </div>
        </main>

        {/* Right panel */}
        <aside className="cv-discussions-right cv-disc-right-panel">
          {/* Trending */}
          <div className="cv-glass cv-disc-panel-card">
            <div className="cv-disc-panel-header">
              <Icon name="trending" size={15} color="var(--secondary-teal)" />
              <h3>Trending</h3>
            </div>
            <ul className="cv-trending-list">
              {trending.map((t, i) => (
                <li key={t._id} className="cv-trending-item" style={{ cursor: "pointer" }} onClick={() => navigate(`/discussions/${t._id}`)}>
                  <span className="cv-trending-num">{i + 1}</span>
                  <div>
                    <div className="cv-trending-title">{t.title}</div>
                    <div className="cv-trending-comments">{t.commentCount} comments • {t.upvoteCount} upvotes</div>
                  </div>
                </li>
              ))}
              {trending.length === 0 && <li className="cv-trending-item">No trending posts yet.</li>}
            </ul>
          </div>

          {/* Top Contributors */}
          <div className="cv-glass cv-disc-panel-card">
            <div className="cv-disc-panel-header">
              <Icon name="trophy" size={15} color="var(--gold)" />
              <h3>Top Contributors</h3>
            </div>
            <div className="cv-contrib-list">
              {contributors.map((u) => (
                <div key={u.username} className="cv-contrib-item">
                  <div className="cv-avatar cv-avatar-md cv-avatar-teal" style={{ borderRadius: "50%", fontSize: 10 }}>
                    {u.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="cv-contrib-info">
                    <div className="cv-contrib-name">{u.username}</div>
                    <div className="cv-contrib-posts">{u.posts} posts</div>
                  </div>
                  <span className="cv-contrib-rating">{u.level || "Beginner"}</span>
                </div>
              ))}
              {contributors.length === 0 && <div className="cv-contrib-item">No contributors yet.</div>}
            </div>
          </div>

          {/* Daily Challenge */}
          <div className="cv-glass cv-disc-panel-card">
            <div className="cv-disc-panel-header">
              <Icon name="zap" size={15} color="var(--primary-teal)" />
              <h3>Daily Challenge</h3>
            </div>
            {potd ? (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>
                  {potd.problem?.title || "Problem of the Day"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
                  {potd.problem?.difficulty || "Medium"} {potd.problem?.tags?.length ? `• ${potd.problem.tags.join(', ')}` : ""}
                </div>
                <button className="cv-btn" style={{ width: "100%", justifyContent: "center", fontSize: 12 }} onClick={() => navigate(`/problems/${potd.problem?.slug}`)}>
                  Solve POTD →
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Loading POTD...</div>
            )}
          </div>
        </aside>
      </div>

      {createOpen && <CreatePostModal onClose={() => setCreateOpen(false)} onSuccess={(newPost) => setPosts([newPost, ...posts])} />}
    </>
  );
}

// ── Post Card ──
function PostCard({ post, onDelete }) {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [bookmarked, setBookmarked] = useState(false);
  const [score, setScore] = useState(post.upvotes || 0);
  const [isUpvoted, setIsUpvoted] = useState(post.upvotedBy?.includes(user?._id) || false);

  const isAuthor = user && post.author === user.username;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDiscussion(post.id);
      if (onDelete) onDelete(post.id);
    } catch (err) {
      console.error("Failed to delete discussion", err);
    }
  };

  const handleVote = async (e) => {
    e.stopPropagation();

    // Optimistic UI update
    setScore(prev => isUpvoted ? prev - 1 : prev + 1);
    setIsUpvoted(prev => !prev);

    try {
      await api.post(
        `/discussions/${post.id}/vote`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (err) {
      console.error(err);
      // Revert on failure
      setScore(prev => isUpvoted ? prev + 1 : prev - 1);
      setIsUpvoted(prev => !prev);
    }
  };

  return (
    <article
      className={`cv-glass cv-post-card${post.solvedByUser ? " is-solved" : ""}`}
      onClick={() => navigate(`/discussions/${post.id}`)}
      style={{ cursor: "pointer" }}
    >
      <div className="cv-post-card-inner">
        {/* Votes */}
        <div className="cv-post-votes">
          <button
            className={`cv-post-vote-btn up ${isUpvoted ? "active" : ""}`}
            onClick={handleVote}
          >
            <Icon name="arrowBigUp" size={18} />
          </button>
          <span className="cv-post-score">{score}</span>
        </div>

        {/* Body */}
        <div className="cv-post-body">
          <div className="cv-post-meta">
            {post.isPinned && (
              <span style={{ color: "var(--primary-teal)", display: "inline-flex", alignItems: "center", gap: 4, marginRight: 8, fontSize: 12, fontWeight: 600 }}>
                <Icon name="zap" size={12} /> Pinned
              </span>
            )}
            <span className={`cv-post-type-badge ${post.type}`}>
              {post.type}
            </span>
            <span className="cv-post-author-avatar">{post.avatar}</span>
            <span className="cv-post-author">{post.author}</span>
            <span className="cv-post-rating">{post.rating}</span>
            <span>·</span>
            <span>{timeAgo(post.timestamp)}</span>
            {post.solvedByUser && (
              <span style={{ color: "var(--easy)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="checkCircle" size={12} /> Solved
              </span>
            )}
          </div>

          <div className="cv-post-title">{post.title}</div>
          <div className="cv-post-preview">{post.preview}</div>

          {post.relatedProblem && (
            <div className="cv-post-related">
              <span style={{ color: "var(--text-faint)", fontSize: 11 }}>Problem:</span>
              <span style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>
                {post.relatedProblem}
              </span>
              {post.difficulty && (
                <span className={`diff-${post.difficulty.toLowerCase()}`} style={{ fontSize: 11 }}>
                  · {post.difficulty}
                </span>
              )}
            </div>
          )}

          <div className="cv-post-footer">
            <div className="cv-post-tags">
              {post.tags.map((t) => (
                <span key={t} className="cv-post-tag">{t}</span>
              ))}
            </div>
            <div className="cv-post-actions">
              <button className="cv-post-action-btn">
                <Icon name="messageSquare" size={13} />
                {post.comments}
              </button>
              <button
                className={`cv-post-action-btn${bookmarked ? " active" : ""}`}
                onClick={(e) => { e.stopPropagation(); setBookmarked(!bookmarked); }}
              >
                <Icon name="bookmark" size={13} />
              </button>
              <button className="cv-post-action-btn" onClick={(e) => e.stopPropagation()}>
                <Icon name="share" size={13} />
              </button>
              {isAuthor && (
                <button className="cv-post-action-btn" onClick={handleDelete} style={{ color: "var(--error)" }}>
                  <Icon name="trash2" size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Create Post Modal ──
const POST_TYPES = [
  { id: "problem", label: "Problem Discussion" },
  { id: "doubt", label: "Doubt / Question" },
  { id: "interview", label: "Interview Experience" },
  { id: "general", label: "General" },
];

function CreatePostModal({ onClose, onSuccess }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState([]);
  const [type, setType] = useState("problem");
  const [problem, setProblem] = useState("");

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

 const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    let res;
    if (problem) {
      res = await api.post(
        `/problems/${problem}/discussions`,
        { title, body, tags, category: type }
      );
    } else {
      res = await api.post(
        `/discussions`,
        { title, body, tags, category: type }
      );
    }

    if (onSuccess && res.data?.data?.discussion) {
      const d = res.data.data.discussion;
      const newPost = {
        id: d._id,
        title: d.title,
        preview: d.body,
        body: d.body,
        tags: d.tags,
        comments: d.commentCount || 0,
        upvotes: d.upvoteCount || 0,
        upvotedBy: d.upvotedBy || [],
        timestamp: d.createdAt,
        author: d.author?.username,
        avatar: d.author?.username?.slice(0, 2).toUpperCase(),
        rating: d.author?.level || 0,
        type: d.category || (d.problem ? "problem" : (d.tags && d.tags.includes("interview")) ? "interview" : "general"),
        isPinned: d.isPinned || false
      };
      onSuccess(newPost);
    }

    onClose();
  } catch (err) {
    console.error(err);
  }
};

  return (
    <div className="cv-overlay" onClick={onClose}>
      <div
        className="cv-glass cv-create-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cv-modal-header">
          <h2>Create Post</h2>
          <button className="cv-iconbtn" onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cv-modal-body">
            {/* Post type */}
            <div className="cv-form-field">
              <label className="cv-form-label">Post Type</label>
              <div className="cv-post-type-btns">
                {POST_TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className={`cv-post-type-sel-btn${type === t.id ? " active" : ""}`}
                    onClick={() => setType(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="cv-form-field">
              <label className="cv-form-label">Title</label>
              <input
                required
                className="cv-input"
                style={{ padding: "10px 14px" }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Be specific. What are you discussing?"
              />
            </div>

            {/* Content */}
            <div className="cv-form-field">
              <label className="cv-form-label">Content</label>
              <div className="cv-glass" style={{ padding: 0, overflow: "hidden" }}>
                <div className="cv-editor-toolbar-mini">
                  <button type="button" className="cv-editor-mini-btn" title="Bold">
                    <Icon name="bold" size={13} />
                  </button>
                  <button type="button" className="cv-editor-mini-btn" title="Code">
                    <Icon name="code" size={13} />
                  </button>
                  <button type="button" className="cv-editor-mini-btn" title="List">
                    <Icon name="list" size={13} />
                  </button>
                </div>
                <textarea
                  className="cv-editor-textarea"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share your approach, code, or question. Markdown supported."
                />
              </div>
            </div>

            {/* Related problem */}
            <div className="cv-form-field">
              <label className="cv-form-label">Related Problem (optional)</label>
              <input
                className="cv-input"
                style={{ padding: "10px 14px" }}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Search problem by name or number…"
              />
            </div>

            {/* Tags */}
            <div className="cv-form-field">
              <label className="cv-form-label">Tags</label>
              <div className="cv-disc-tags-wrap">
                {DISCUSSION_TAGS.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`cv-disc-tag-btn${tags.includes(t) ? " active" : ""}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cv-modal-footer">
            <button type="button" className="cv-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cv-btn cv-btn-primary">
              Publish Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

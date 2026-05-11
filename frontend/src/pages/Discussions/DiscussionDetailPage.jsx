import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  getDiscussion,
  getComments,
  addComment,
  voteDiscussion,
  voteComment,
  pinDiscussion
} from "../../services/discussions.service.js";
import Icon from "../../components/Icon/Icon.jsx";
import "./Discussions.css";
import { timeAgo } from "../../data/discussionsData.js";

export default function DiscussionDetailPage() {
  const { discussionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [discussion, setDiscussion] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [discussionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [discRes, commRes] = await Promise.all([
        getDiscussion(discussionId),
        getComments(discussionId)
      ]);
      setDiscussion(discRes.data.data);
      setComments(commRes.data.data.docs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!discussion) return;
    try {
      await voteDiscussion(discussion._id);
      // Optimistic update
      const isUpvoted = discussion.upvotedBy?.includes(user?._id);
      setDiscussion(prev => ({
        ...prev,
        upvoteCount: isUpvoted ? prev.upvoteCount - 1 : prev.upvoteCount + 1,
        upvotedBy: isUpvoted 
          ? prev.upvotedBy.filter(id => id !== user?._id)
          : [...(prev.upvotedBy || []), user?._id]
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handlePin = async () => {
    if (!discussion) return;
    try {
      await pinDiscussion(discussion._id);
      setDiscussion(prev => ({ ...prev, isPinned: !prev.isPinned }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommentVote = async (commentId) => {
    try {
      await voteComment(commentId);
      setComments(prev => prev.map(c => {
        if (c._id === commentId) {
          const isUpvoted = c.upvotedBy?.includes(user?._id);
          return {
            ...c,
            upvoteCount: isUpvoted ? c.upvoteCount - 1 : c.upvoteCount + 1,
            upvotedBy: isUpvoted 
              ? c.upvotedBy.filter(id => id !== user?._id)
              : [...(c.upvotedBy || []), user?._id]
          };
        }
        return c;
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await addComment(discussionId, { body: newComment });
      setComments([res.data.data.comment, ...comments]);
      setNewComment("");
      setDiscussion(prev => ({ ...prev, commentCount: prev.commentCount + 1 }));
      // Refetch to get author population
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading discussion...</div>;
  if (!discussion) return <div style={{ padding: 40 }}>Discussion not found.</div>;

  const isAuthor = user && discussion.author && user._id === discussion.author._id;
  const isUpvoted = user && discussion.upvotedBy?.includes(user._id);

  return (
    <div style={{ padding: "28px 40px 60px", width: "100%", boxSizing: "border-box" }}>
      <main style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
        
        <button className="cv-prob-back" onClick={() => navigate("/discussions")} style={{ marginBottom: 20 }}>
          <Icon name="arrowLeft" size={14} /> Back to Discussions
        </button>

        <article className="cv-glass cv-post-card" style={{ cursor: "default" }}>
          <div className="cv-post-card-inner">
            <div className="cv-post-votes">
              <button className={`cv-post-vote-btn up ${isUpvoted ? "active" : ""}`} onClick={handleVote}>
                <Icon name="arrowBigUp" size={18} />
              </button>
              <span className="cv-post-score">{discussion.upvoteCount}</span>
            </div>

            <div className="cv-post-body">
              <div className="cv-post-meta">
                <span className="cv-post-author-avatar">
                  {discussion.author?.username?.slice(0, 2).toUpperCase() || "U"}
                </span>
                <span className="cv-post-author">{discussion.author?.username || "Unknown"}</span>
                <span>·</span>
                <span>{timeAgo(discussion.createdAt)}</span>
                {discussion.isPinned && (
                  <span style={{ color: "var(--primary-teal)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="zap" size={12} /> Pinned
                  </span>
                )}
              </div>

              <h1 className="cv-post-title" style={{ fontSize: 24, margin: "10px 0" }}>{discussion.title}</h1>
              
              <div className="cv-post-preview" style={{ whiteSpace: "pre-wrap", margin: "20px 0", color: "var(--text-primary)" }}>
                {discussion.body}
              </div>

              <div className="cv-post-footer" style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                <div className="cv-post-tags">
                  {discussion.tags?.map((t) => (
                    <span key={t} className="cv-post-tag">{t}</span>
                  ))}
                </div>
                <div className="cv-post-actions">
                  <button className="cv-post-action-btn">
                    <Icon name="messageSquare" size={13} />
                    {discussion.commentCount} Comments
                  </button>
                  {isAuthor && (
                    <button className={`cv-post-action-btn ${discussion.isPinned ? "active" : ""}`} onClick={handlePin}>
                      <Icon name="zap" size={13} />
                      {discussion.isPinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Comments Section */}
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontFamily: "var(--font-display)", marginBottom: 20 }}>Comments ({discussion.commentCount})</h3>
          
          <form onSubmit={handleSubmitComment} style={{ marginBottom: 30 }}>
            <div className="cv-glass" style={{ padding: 0, overflow: "hidden" }}>
              <textarea
                className="cv-editor-textarea"
                style={{ minHeight: 100 }}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={!newComment.trim()}>
                Post Comment
              </button>
            </div>
          </form>

          <div className="cv-disc-posts">
            {comments.map((comment, i) => {
              const isCommentUpvoted = user && comment.upvotedBy?.includes(user._id);
              return (
                <div key={comment._id || i} className="cv-glass cv-post-card" style={{ padding: 16, cursor: "default" }}>
                  <div className="cv-post-card-inner">
                    <div className="cv-post-votes">
                      <button className={`cv-post-vote-btn up ${isCommentUpvoted ? "active" : ""}`} onClick={() => handleCommentVote(comment._id)}>
                        <Icon name="arrowBigUp" size={16} />
                      </button>
                      <span className="cv-post-score" style={{ fontSize: 12 }}>{comment.upvoteCount}</span>
                    </div>
                    <div className="cv-post-body">
                      <div className="cv-post-meta">
                        <span className="cv-post-author-avatar">
                          {comment.author?.username?.slice(0, 2).toUpperCase() || "U"}
                        </span>
                        <span className="cv-post-author">{comment.author?.username || "Unknown"}</span>
                        <span>·</span>
                        <span>{timeAgo(comment.createdAt)}</span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 14 }}>
                        {comment.body}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {comments.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text-faint)", padding: 40 }}>
                No comments yet. Be the first to share your thoughts!
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
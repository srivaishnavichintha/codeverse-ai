// frontend/src/components/profile/cards/CommunityCard.jsx
import { Card, CardTitle } from '../Card';
import { Stat } from '../Stat';
import { MessageSquare, Heart, ThumbsUp, Award, BookOpen } from 'lucide-react';

export function CommunityCard({ data }) {
  const d = data || {};
  return (
    <Card>
      <CardTitle>Community Impact</CardTitle>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={<BookOpen size={18} />} label="Discussions" value={d.discussions} accent="#6366f1" />
        <Stat icon={<MessageSquare size={18} />} label="Comments" value={d.comments} accent="#06b6d4" />
        <Stat icon={<Heart size={18} />} label="Likes" value={d.likes} accent="#f43f5e" />
        <Stat icon={<ThumbsUp size={18} />} label="Helpful" value={d.helpful} accent="#10b981" />
        <Stat icon={<Award size={18} />} label="Reputation" value={d.reputation} accent="#f59e0b" />
      </div>
    </Card>
  );
}

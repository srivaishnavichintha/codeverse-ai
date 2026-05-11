// frontend/src/components/profile/ProfileHeader.jsx
import { motion } from 'framer-motion';
import { Github, Linkedin, Twitter, Globe, MapPin, Calendar, Flame, Trophy, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { fmtDate, fmtNum } from '../../utils/format';

export function ProfileHeader({ profile }) {
  const { theme, toggle } = useTheme();
  const completion = profile.profileCompletion ?? 0;
  return (
    <div className="relative cv-glass overflow-hidden p-6 md:p-8">
      <div className="absolute inset-0 opacity-30 pointer-events-none cv-grad-soft-bg" />
      <div className="relative flex flex-col md:flex-row gap-6 items-start md:items-center">
        <div className="relative">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full p-[3px] cv-ring">
            <img
              src={profile.avatar}
              alt={profile.username}
              className="w-full h-full rounded-full object-cover bg-slate-200"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 cv-glass px-2 py-0.5 text-xs font-semibold rounded-full">
            Lv {profile.level}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold cv-grad-text">{profile.displayName || profile.username}</h1>
            {profile.roles?.map((r) => (
              <span key={r} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full cv-grad-soft-bg border border-white/10">
                {r}
              </span>
            ))}
          </div>
          <div className="opacity-70 text-sm">@{profile.username}</div>
          <p className="mt-2 text-sm md:text-base max-w-2xl opacity-90">{profile.bio}</p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs opacity-80">
            {profile.location && <span className="flex items-center gap-1"><MapPin size={12} /> {profile.location}</span>}
            {profile.createdAt && <span className="flex items-center gap-1"><Calendar size={12} /> Joined {fmtDate(profile.createdAt)}</span>}
            <span className="flex items-center gap-1"><Flame size={12} className="text-orange-500" /> {profile.streak?.current || 0}d streak</span>
            <span className="flex items-center gap-1"><Trophy size={12} className="text-amber-500" /> Rank #{fmtNum(profile.rank)}</span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <div className="flex justify-between text-[10px] uppercase opacity-70 mb-1">
                <span>Profile completion</span><span>{completion}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completion}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full cv-grad-bg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="cv-glass p-2 rounded-full"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="flex gap-2 opacity-90">
            {profile.socials?.github && <a href={profile.socials.github} target="_blank" rel="noreferrer" className="cv-glass p-2 rounded-full"><Github size={14} /></a>}
            {profile.socials?.linkedin && <a href={profile.socials.linkedin} target="_blank" rel="noreferrer" className="cv-glass p-2 rounded-full"><Linkedin size={14} /></a>}
            {profile.socials?.twitter && <a href={profile.socials.twitter} target="_blank" rel="noreferrer" className="cv-glass p-2 rounded-full"><Twitter size={14} /></a>}
            {profile.socials?.website && <a href={profile.socials.website} target="_blank" rel="noreferrer" className="cv-glass p-2 rounded-full"><Globe size={14} /></a>}
          </div>
          <div className="cv-glass px-3 py-1.5 text-xs font-semibold">
            <span className="opacity-70">XP </span>
            <span className="cv-grad-text font-bold">{fmtNum(profile.xp)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

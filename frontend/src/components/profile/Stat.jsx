// frontend/src/components/profile/Stat.jsx
import { motion } from 'framer-motion';
import { fmtNum } from '../../utils/format';

export function Stat({ label, value, delta, icon, accent }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="cv-glass p-4 flex items-center gap-3"
      style={{ borderLeft: `3px solid ${accent || 'transparent'}` }}
    >
      {icon && <div className="w-10 h-10 rounded-lg flex items-center justify-center cv-grad-soft-bg text-lg">{icon}</div>}
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
        <div className="text-2xl font-bold leading-tight cv-grad-text">{fmtNum(value)}</div>
        {delta != null && (
          <div className={`text-xs ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

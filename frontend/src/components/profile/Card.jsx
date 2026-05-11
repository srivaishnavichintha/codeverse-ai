// frontend/src/components/profile/Card.jsx
import clsx from 'clsx';
import { motion } from 'framer-motion';

export function Card({ className, children, hover = true, delay = 0, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('cv-glass p-5', hover && 'cv-card-hover', className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold tracking-wide uppercase opacity-80">{children}</h3>
      {action}
    </div>
  );
}

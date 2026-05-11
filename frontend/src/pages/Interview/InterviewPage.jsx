import { AnimatePresence, motion } from 'framer-motion';
import { InterviewProvider, useInterview } from '../../context/InterviewContext';
import Dashboard from '../../components/Dashboard/Dashboard';
import Permissions from '../../components/Interview/Permissions';
import CodingRound from '../../components/Coding/CodingRound';
import FollowUp from '../../components/FollowUp/FollowUp';
import Evaluation from '../../components/Evaluation/Evaluation';
import ViolationWarning from '../../components/shared/ViolationWarning';

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
};

function InterviewRouter() {
  const { phase } = useInterview();

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ViolationWarning manages its own AnimatePresence & visibility */}
      <ViolationWarning />

      <AnimatePresence mode="wait">
        {phase === 'dashboard' && (
          <motion.div key="dashboard" {...pageTransition}>
            <Dashboard />
          </motion.div>
        )}
        {phase === 'permissions' && (
          <motion.div key="permissions" {...pageTransition}>
            <Permissions />
          </motion.div>
        )}
        {phase === 'coding' && (
          <motion.div key="coding" {...pageTransition}>
            <CodingRound />
          </motion.div>
        )}
        {phase === 'followup' && (
          <motion.div key="followup" {...pageTransition}>
            <FollowUp />
          </motion.div>
        )}
        {phase === 'evaluation' && (
          <motion.div key="evaluation" {...pageTransition}>
            <Evaluation />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <InterviewProvider>
      <InterviewRouter />
    </InterviewProvider>
  );
}

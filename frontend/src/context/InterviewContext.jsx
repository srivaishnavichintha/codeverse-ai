import React, { createContext, useContext, useState, useRef } from 'react'
import { InterviewAPI } from '../services/interviewService'

const InterviewContext = createContext(null)

export function InterviewProvider({ children }) {
  const [phase, setPhase] = useState('dashboard')
  const [violations, setViolations] = useState(0)
  const [showViolationWarning, setShowViolationWarning] = useState(false)
  const [violationMessage, setViolationMessage] = useState('')
  const [terminated, setTerminated] = useState(false)
  const [currentProblem, setCurrentProblem] = useState(0)

  // Backend session state
  const [sessionId, setSessionId] = useState(null)
  const [problems, setProblems] = useState([])
  const [questions, setQuestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Use a ref so the fullscreen-change listener always sees the latest count
  const violationsRef = useRef(0)

  const addViolation = (msg) => {
    // Ignore duplicate violations fired while warning is already showing
    if (showViolationWarning) return

    const newCount = violationsRef.current + 1
    violationsRef.current = newCount

    setViolations(newCount)
    setViolationMessage(msg)
    setShowViolationWarning(true)

    // On 3rd violation: show warning first, then transition to evaluation
    // after the user manually dismisses (dismissWarning handles the phase change)
    if (newCount >= 3) {
      setTerminated(true)
    }
  }

  const dismissWarning = () => {
    setShowViolationWarning(false)
    // If already terminated, now navigate away
    if (violationsRef.current >= 3) {
      finishInterview()
    }
  }
  // When a violation occurs, report it:
const response = await api.post(`/interview/${sessionId}/violation`, { type: violationType });
if (response.data.terminated) { /* handle termination */ }

  const startInterview = () => setPhase('permissions')

  const [initError, setInitError] = useState(null)

  const initBackendSession = async () => {
    setIsLoading(true)
    setInitError(null)
    try {
      const data = await InterviewAPI.start()
      setSessionId(data._id || data.sessionId)
      setProblems(data.assignedProblems ? data.assignedProblems.map(ap => ap.problem) : data.problems || [])
      setPhase('coding')
    } catch (err) {
      console.error('Failed to start interview session:', err)
      setInitError(err?.response?.data?.message || 'Failed to start interview. Please check your credits and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const beginCoding = () => initBackendSession()

  const resumeSession = async (resumeSessionId) => {
    setIsLoading(true)
    setInitError(null)
    try {
      const data = await InterviewAPI.getSession(resumeSessionId)
      setSessionId(resumeSessionId)
      // data has { session, questions }
      if (data.session) {
        setProblems(data.session.assignedProblems ? data.session.assignedProblems.map(ap => ap.problem) : [])
        
        if (data.session.phase === 'ai') {
           setQuestions(data.questions || [])
           setPhase('followup')
        } else {
           setPhase('coding')
        }
      }
    } catch (err) {
      console.error('Failed to resume interview session:', err)
      setInitError('Failed to resume interview. It may have expired.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const beginFollowUp = async () => {
    setPhase('followup')
    if (sessionId) {
      try {
        const data = await InterviewAPI.getQuestions(sessionId)
        setQuestions(data.questions || data)
      } catch (err) {
        console.error('Failed to load questions:', err)
      }
    }
  }
  
  const finishInterview = async () => {
    setPhase('evaluation')
    if (sessionId) {
      try {
        await InterviewAPI.terminate(sessionId)
      } catch (err) {
        console.error('Failed to terminate:', err)
      }
    }
  }

  const resetInterview = () => {
    setPhase('dashboard')
    setViolations(0)
    violationsRef.current = 0
    setTerminated(false)
    setCurrentProblem(0)
    setShowViolationWarning(false)
    setSessionId(null)
    setProblems([])
    setQuestions([])
  }

  return (
    <InterviewContext.Provider value={{
      phase, setPhase,
      violations, addViolation,
      showViolationWarning, violationMessage, dismissWarning,
      terminated,
      currentProblem, setCurrentProblem,
      sessionId, problems, questions, isLoading, initError,
      startInterview, beginCoding, beginFollowUp, finishInterview, resetInterview,
      resumeSession
    }}>
      {children}
    </InterviewContext.Provider>
  )
}

export function useInterview() {
  return useContext(InterviewContext)
}

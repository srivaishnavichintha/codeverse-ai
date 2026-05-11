// src/routes/videoRoutes.js
const router     = require('express').Router()
const upload     = require('../middleware/videoUpload')
const ctrl       = require('../controllers/videoController')
const { authenticate: protect, authorize } = require('../middleware/auth') // your existing auth middleware

// POST   /api/upload-interview-video          — candidate uploads recording
router.post('/', protect, upload.single('video'), ctrl.uploadVideo)

// GET    /api/upload-interview-video/:sessionId        — admin fetch meta
router.get('/:sessionId', protect, authorize('admin'), ctrl.getRecording)

// GET    /api/upload-interview-video/:sessionId/stream — admin stream video
router.get('/:sessionId/stream', protect, authorize('admin'), ctrl.streamVideo)

module.exports = router

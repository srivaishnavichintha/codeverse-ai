// src/controllers/videoController.js
const path = require('path')
const fs   = require('fs')
const InterviewRecording = require('../models/InterviewRecording')

// ── POST /api/upload-interview-video ────────────────────────────────
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file received.' })
    }

    const { sessionId, violations } = req.body
    const userId = req.user?._id || req.user?.id

    // Parse violations JSON sent from frontend
    let parsedViolations = []
    if (violations) {
      try { parsedViolations = JSON.parse(violations) } catch { /* ignore */ }
    }

    // Save record to DB
    const recording = await InterviewRecording.create({
      session:    sessionId,
      user:       userId,
      filePath:   req.file.path,
      fileName:   req.file.filename,
      mimeType:   req.file.mimetype || 'video/webm',
      sizeBytes:  req.file.size,
      violations: parsedViolations,
      status:     'stored',
    })

    return res.status(201).json({
      success: true,
      message: 'Interview recording saved.',
      data: {
        recordingId: recording._id,
        fileName:    recording.fileName,
        sizeBytes:   recording.sizeBytes,
        violations:  parsedViolations.length,
      },
    })
  } catch (err) {
    console.error('[VideoUpload]', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

// ── GET /api/upload-interview-video/:sessionId  (admin/review) ──────
exports.getRecording = async (req, res) => {
  try {
    const { sessionId } = req.params
    const recording = await InterviewRecording.findOne({ session: sessionId })
      .populate('user', 'username email')

    if (!recording) {
      return res.status(404).json({ success: false, message: 'No recording found for this session.' })
    }

    return res.json({ success: true, data: recording })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// ── GET /api/upload-interview-video/:sessionId/stream  (admin) ──────
exports.streamVideo = async (req, res) => {
  try {
    const { sessionId } = req.params
    const recording = await InterviewRecording.findOne({ session: sessionId })

    if (!recording || !fs.existsSync(recording.filePath)) {
      return res.status(404).json({ success: false, message: 'Video file not found.' })
    }

    const stat   = fs.statSync(recording.filePath)
    const range  = req.headers.range

    if (range) {
      // Partial content (video seek support)
      const parts  = range.replace(/bytes=/, '').split('-')
      const start  = parseInt(parts[0], 10)
      const end    = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
      const chunk  = end - start + 1

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunk,
        'Content-Type':   recording.mimeType,
      })
      fs.createReadStream(recording.filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type':   recording.mimeType,
      })
      fs.createReadStream(recording.filePath).pipe(res)
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

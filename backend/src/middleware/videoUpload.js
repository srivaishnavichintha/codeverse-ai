// src/middleware/videoUpload.js
const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads/interview-videos')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const sessionId = _req.body?.sessionId || 'unknown'
    const ts = Date.now()
    cb(null, `interview_${sessionId}_${ts}.webm`)
  },
})

const fileFilter = (_req, file, cb) => {
  const allowed = ['video/webm', 'video/mp4', 'video/ogg', 'application/octet-stream']
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only video files allowed'), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
})

module.exports = upload

// src/models/InterviewRecording.js
const mongoose = require('mongoose')

const InterviewRecordingSchema = new mongoose.Schema(
  {
    session:    { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filePath:   { type: String, required: true },          // absolute path on disk
    fileName:   { type: String, required: true },
    mimeType:   { type: String, default: 'video/webm' },
    sizeBytes:  { type: Number },
    violations: { type: Array, default: [] },               // violation log from frontend
    durationMs: { type: Number },                           // optional — set if backend probes
    status:     { type: String, enum: ['stored', 'processing', 'done', 'failed'], default: 'stored' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('InterviewRecording', InterviewRecordingSchema)

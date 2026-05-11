const mongoose = require('mongoose');

/**
 * POTD (Problem of the Day)
 *
 * Stores one document per day.  `date` is stored as 'YYYY-MM-DD' so we can
 * query by exact date without timezone headaches.
 * `problem` is an ObjectId ref to an existing Problem document.
 */
const potdSchema = new mongoose.Schema(
  {
    date: {
      type: String,           // 'YYYY-MM-DD'
      required: true,
      unique: true,
      index: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true,
    },
    // How the problem was selected — useful for auditing
    selectionMethod: {
      type: String,
      enum: ['auto', 'admin'],
      default: 'auto',
    },
    selectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('POTD', potdSchema);

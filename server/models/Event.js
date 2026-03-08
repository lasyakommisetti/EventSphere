const mongoose = require('mongoose')

const sessionSchema = new mongoose.Schema({
  title: String,
  time: Date,
  speaker: String,
  duration: Number, // minutes
}, { _id: false })

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['hackathon', 'workshop', 'conference', 'seminar', 'webinar'],
    required: true,
  },
  venue: {
    type: { type: String, enum: ['physical', 'virtual'], required: true },
    location: String,
    link: String,
  },
  schedule: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    sessions: [sessionSchema],
  },
  teamConfig: {
    minSize: { type: Number, default: 1 },
    maxSize: { type: Number, default: 5 },
    allowSolo: { type: Boolean, default: true },
  },
  registrationLimit: { type: Number, required: true },
  currentCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'completed'],
    default: 'draft',
  },
  tags: [{ type: String, lowercase: true }],
  bannerUrl: String,
}, { timestamps: true })

eventSchema.index({ adminId: 1, status: 1 })
eventSchema.index({ tags: 1 })
eventSchema.index({ status: 1, 'schedule.start': 1 })

module.exports = mongoose.model('Event', eventSchema)

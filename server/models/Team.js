const mongoose = require('mongoose')

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
  }],
  pendingInvites: [{
    email: String,
    token: String,
    expiresAt: Date,
  }],
  status: {
    type: String,
    enum: ['forming', 'complete', 'approved', 'rejected'],
    default: 'forming',
  },
}, { timestamps: true })

teamSchema.index({ eventId: 1, leaderId: 1 })
teamSchema.index({ 'pendingInvites.token': 1 })

module.exports = mongoose.model('Team', teamSchema)

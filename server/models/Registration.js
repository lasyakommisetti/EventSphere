const mongoose = require('mongoose')
const crypto = require('crypto')

const registrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'waitlisted', 'cancelled'],
    default: 'confirmed',
  },
  checkIn: {
    done: { type: Boolean, default: false },
    time: Date,
    method: { type: String, enum: ['qr', 'manual'] },
    qrToken: {
      type: String,
      default: () => crypto.randomBytes(32).toString('hex'),
    },
  },
  registeredAt: { type: Date, default: Date.now },
}, { timestamps: true })

registrationSchema.index({ eventId: 1, status: 1 })
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true })
registrationSchema.index({ 'checkIn.qrToken': 1 })

module.exports = mongoose.model('Registration', registrationSchema)

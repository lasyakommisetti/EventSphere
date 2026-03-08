const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  channel: { type: String, enum: ['email', 'whatsapp', 'in-app'], required: true },
  recipientScope: { type: String, enum: ['all', 'team', 'individual'], default: 'individual' },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  subject: { type: String, required: true },
  body: { type: String, required: true },
  scheduledAt: Date,
  sentAt: Date,
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
}, { timestamps: true })

notificationSchema.index({ recipients: 1, status: 1 })
notificationSchema.index({ eventId: 1, status: 1 })

module.exports = mongoose.model('Notification', notificationSchema)

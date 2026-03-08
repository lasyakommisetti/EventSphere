const Notification = require('../models/Notification')
const Registration = require('../models/Registration')
const Event = require('../models/Event')

// Admin: broadcast announcement to all confirmed registrants
exports.broadcastAnnouncement = async (req, res) => {
  try {
    const { eventId, subject, body, channel = 'in-app' } = req.body

    const event = await Event.findOne({ _id: eventId, adminId: req.user.id })
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const registrations = await Registration.find({ eventId, status: 'confirmed' }).select('userId')
    const recipientIds = registrations.map((r) => r.userId)

    if (!recipientIds.length) {
      return res.status(400).json({ message: 'No confirmed registrants to notify' })
    }

    const notification = await Notification.create({
      eventId,
      channel,
      recipientScope: 'all',
      recipients: recipientIds,
      subject,
      body,
      status: 'sent',
      sentAt: new Date(),
    })

    // Emit real-time notification to all connected participants
    const io = req.app.get('io')
    if (io) {
      recipientIds.forEach((userId) => {
        io.to(`user:${userId}`).emit('notification', {
          _id: notification._id,
          subject,
          body,
          eventId,
          createdAt: notification.createdAt,
        })
      })
    }

    // Mock: log email/whatsapp sends
    if (channel === 'email') {
      console.log(`[MOCK EMAIL BROADCAST] ${recipientIds.length} recipients | Subject: ${subject}`)
    } else if (channel === 'whatsapp') {
      console.log(`[MOCK WHATSAPP BROADCAST] ${recipientIds.length} recipients | Message: ${body.slice(0, 60)}...`)
    }

    res.status(201).json({ notification, recipientCount: recipientIds.length })
  } catch (err) {
    console.error('broadcastAnnouncement:', err)
    res.status(500).json({ message: 'Failed to send announcement' })
  }
}

// Admin: get all notifications sent for an event
exports.getEventNotifications = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, adminId: req.user.id })
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const notifications = await Notification.find({ eventId: req.params.eventId })
      .sort({ createdAt: -1 })
      .limit(50)

    res.json({ notifications })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' })
  }
}

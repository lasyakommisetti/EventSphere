const Event = require('../models/Event')
const Registration = require('../models/Registration')
const User = require('../models/User')
const Notification = require('../models/Notification')
const { queueNotification } = require('../services/notification.service')

// Participant: Register for event (atomic seat counter)
exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.body
    const userId = req.user.id

    // Check duplicate registration
    const existing = await Registration.findOne({ userId, eventId })
    if (existing) {
      return res.status(409).json({ message: 'Already registered for this event' })
    }

    // Atomic increment — only succeeds if seats remain ($expr for field-to-field comparison)
    const event = await Event.findOneAndUpdate(
      {
        _id: eventId,
        status: 'active',
        $expr: { $lt: ['$currentCount', '$registrationLimit'] },
      },
      { $inc: { currentCount: 1 } },
      { new: true }
    )

    // If no event returned, either not found, not active, or full
    const eventDoc = event || (await Event.findOne({ _id: eventId, status: 'active' }))
    if (!eventDoc) {
      return res.status(404).json({ message: 'Event not found or not accepting registrations' })
    }

    const isFull = !event // atomic update failed = event was full
    const status = isFull ? 'waitlisted' : 'confirmed'

    const registration = await Registration.create({ userId, eventId, status })

    // Denormalize to user
    await User.findByIdAndUpdate(userId, {
      $addToSet: { eventRegistrations: registration._id },
    })

    // Emit real-time seat update
    const emitSeatUpdate = req.app.get('emitSeatUpdate')
    if (emitSeatUpdate && eventDoc) {
      emitSeatUpdate(eventId, eventDoc.currentCount, eventDoc.registrationLimit)
    }

    // Queue mock email confirmation
    if (status === 'confirmed') {
      const user = await User.findById(userId)
      queueNotification('registration-confirmation', { user, event: eventDoc })
    }

    // In-app notification
    await Notification.create({
      eventId,
      channel: 'in-app',
      recipientScope: 'individual',
      recipients: [userId],
      subject: status === 'confirmed' ? 'Registration Confirmed!' : 'Added to Waitlist',
      body:
        status === 'confirmed'
          ? `You are registered for ${eventDoc.title}. Check your QR code in My Events.`
          : `You've been added to the waitlist for ${eventDoc.title}. We'll notify you if a spot opens.`,
      status: 'sent',
      sentAt: new Date(),
    })

    res.status(201).json({ registration, status })
  } catch (err) {
    console.error('registerForEvent:', err)
    res.status(500).json({ message: 'Registration failed' })
  }
}

// Participant: Get my registrations
exports.getMyRegistrations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const [registrations, total] = await Promise.all([
      Registration.find({ userId: req.user.id })
        .populate('eventId', 'title type status schedule venue bannerUrl')
        .populate('teamId', 'name status')
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(limit),
      Registration.countDocuments({ userId: req.user.id }),
    ])

    res.json({ registrations, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch registrations' })
  }
}

// Participant: Cancel registration
exports.cancelRegistration = async (req, res) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.id,
      userId: req.user.id,
    })

    if (!registration) return res.status(404).json({ message: 'Registration not found' })
    if (registration.status === 'cancelled') {
      return res.status(400).json({ message: 'Already cancelled' })
    }

    const wasConfirmed = registration.status === 'confirmed'
    registration.status = 'cancelled'
    await registration.save()

    // Free up seat if was confirmed
    if (wasConfirmed) {
      await Event.findByIdAndUpdate(registration.eventId, {
        $inc: { currentCount: -1 },
      })

      // Promote first waitlisted
      const waitlisted = await Registration.findOneAndUpdate(
        { eventId: registration.eventId, status: 'waitlisted' },
        { status: 'confirmed' },
        { sort: { registeredAt: 1 }, new: true }
      )

      if (waitlisted) {
        await Event.findByIdAndUpdate(registration.eventId, { $inc: { currentCount: 1 } })
        await Notification.create({
          eventId: registration.eventId,
          channel: 'in-app',
          recipientScope: 'individual',
          recipients: [waitlisted.userId],
          subject: 'Spot Available — You\'re In!',
          body: 'A spot opened up for your waitlisted event. Your registration is now confirmed!',
          status: 'sent',
          sentAt: new Date(),
        })
      }
    }

    res.json({ message: 'Registration cancelled' })
  } catch (err) {
    res.status(500).json({ message: 'Cancellation failed' })
  }
}

// Participant: Get my notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 30
    const skip = (page - 1) * limit

    const [notifications, total] = await Promise.all([
      Notification.find({ recipients: req.user.id, channel: 'in-app' })
        .populate('eventId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ recipients: req.user.id, channel: 'in-app' }),
    ])

    res.json({ notifications, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' })
  }
}

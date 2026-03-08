const Event = require('../models/Event')
const Registration = require('../models/Registration')
const Team = require('../models/Team')
const { queueNotification } = require('../services/notification.service')

// Admin: Create event
exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, adminId: req.user.id })
    res.status(201).json({ event })
  } catch (err) {
    console.error('createEvent:', err)
    res.status(500).json({ message: 'Failed to create event' })
  }
}

// Admin: Update event
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    )
    if (!event) return res.status(404).json({ message: 'Event not found' })
    res.json({ event })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update event' })
  }
}

// Admin: Delete event
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({ _id: req.params.id, adminId: req.user.id })
    if (!event) return res.status(404).json({ message: 'Event not found' })
    // Cascade: cancel registrations
    await Registration.updateMany({ eventId: req.params.id }, { status: 'cancelled' })
    res.json({ message: 'Event deleted' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete event' })
  }
}

// Admin: Get own events
exports.getAdminEvents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const filter = { adminId: req.user.id }
    if (req.query.status) filter.status = req.query.status

    const [events, total] = await Promise.all([
      Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Event.countDocuments(filter),
    ])

    res.json({ events, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch events' })
  }
}

// Public: List active events
exports.listEvents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const filter = { status: 'active' }
    if (req.query.type) filter.type = req.query.type
    if (req.query.tag) filter.tags = req.query.tag

    const [events, total] = await Promise.all([
      Event.find(filter)
        .select('-__v')
        .sort({ 'schedule.start': 1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
    ])

    res.json({ events, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch events' })
  }
}

// Public: Get single event
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select('-__v')
    if (!event) return res.status(404).json({ message: 'Event not found' })
    res.json({ event })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch event' })
  }
}

// Admin: Get event dashboard summary
exports.getEventSummary = async (req, res) => {
  try {
    const eventId = req.params.id
    const event = await Event.findOne({ _id: eventId, adminId: req.user.id })
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const [confirmed, waitlisted, checkedIn, teams] = await Promise.all([
      Registration.countDocuments({ eventId, status: 'confirmed' }),
      Registration.countDocuments({ eventId, status: 'waitlisted' }),
      Registration.countDocuments({ eventId, 'checkIn.done': true }),
      Team.countDocuments({ eventId }),
    ])

    res.json({
      event,
      stats: {
        confirmed,
        waitlisted,
        checkedIn,
        teams,
        capacity: event.registrationLimit,
        available: Math.max(0, event.registrationLimit - event.currentCount),
      },
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch summary' })
  }
}

// Admin: Get registrations for an event
exports.getEventRegistrations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const event = await Event.findOne({ _id: req.params.id, adminId: req.user.id })
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const filter = { eventId: req.params.id }
    if (req.query.status) filter.status = req.query.status

    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .populate('userId', 'name email phone avatar')
        .populate('teamId', 'name status')
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(limit),
      Registration.countDocuments(filter),
    ])

    res.json({ registrations, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch registrations' })
  }
}

// Admin: Clone an event
exports.cloneEvent = async (req, res) => {
  try {
    const source = await Event.findOne({ _id: req.params.id, adminId: req.user.id })
    if (!source) return res.status(404).json({ message: 'Event not found' })

    const cloned = source.toObject()
    delete cloned._id
    delete cloned.createdAt
    delete cloned.updatedAt
    cloned.title = `${source.title} (Copy)`
    cloned.status = 'draft'
    cloned.currentCount = 0
    cloned.adminId = req.user.id

    const event = await Event.create(cloned)
    res.status(201).json({ event })
  } catch (err) {
    res.status(500).json({ message: 'Failed to clone event' })
  }
}

// Admin: Export registrations as CSV
exports.exportCSV = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, adminId: req.user.id })
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const registrations = await Registration.find({ eventId: req.params.id })
      .populate('userId', 'name email phone')
      .populate('teamId', 'name')

    const rows = registrations.map((r) => {
      const u = r.userId
      const t = r.teamId
      return [
        u?.name ?? '',
        u?.email ?? '',
        u?.phone ?? '',
        r.status,
        t?.name ?? '',
        r.checkIn?.done ? 'Yes' : 'No',
        r.checkIn?.time ? new Date(r.checkIn.time).toISOString() : '',
        r.checkIn?.method ?? '',
        new Date(r.registeredAt).toISOString(),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })

    const header = '"Name","Email","Phone","Status","Team","Checked In","Check-in Time","Method","Registered At"'
    const csv = [header, ...rows].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_')}_participants.csv"`)
    res.send(csv)
  } catch (err) {
    res.status(500).json({ message: 'Failed to export CSV' })
  }
}

// Admin: Get all events summary for dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const adminEvents = await Event.find({ adminId: req.user.id }).select('_id registrationLimit currentCount status')
    const eventIds = adminEvents.map((e) => e._id)

    const [totalRegistrations, totalTeams, totalCheckedIn] = await Promise.all([
      Registration.countDocuments({ eventId: { $in: eventIds }, status: 'confirmed' }),
      Team.countDocuments({ eventId: { $in: eventIds } }),
      Registration.countDocuments({ eventId: { $in: eventIds }, 'checkIn.done': true }),
    ])

    res.json({
      totalEvents: adminEvents.length,
      activeEvents: adminEvents.filter((e) => e.status === 'active').length,
      totalRegistrations,
      totalTeams,
      totalCheckedIn,
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch dashboard stats' })
  }
}

const Event = require('../models/Event')
const Registration = require('../models/Registration')
const Team = require('../models/Team')

// Full analytics for a specific event
exports.getEventAnalytics = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, adminId: req.user.id })
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const eventId = event._id

    const [confirmed, waitlisted, cancelled, checkedIn, teams, approvedTeams] = await Promise.all([
      Registration.countDocuments({ eventId, status: 'confirmed' }),
      Registration.countDocuments({ eventId, status: 'waitlisted' }),
      Registration.countDocuments({ eventId, status: 'cancelled' }),
      Registration.countDocuments({ eventId, 'checkIn.done': true }),
      Team.countDocuments({ eventId }),
      Team.countDocuments({ eventId, status: 'approved' }),
    ])

    // Registration trend: group by day
    const regTrend = await Registration.aggregate([
      { $match: { eventId, status: { $in: ['confirmed', 'waitlisted'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ])

    // Check-in by hour (for event day)
    const checkinByHour = await Registration.aggregate([
      { $match: { eventId, 'checkIn.done': true } },
      {
        $group: {
          _id: { $hour: '$checkIn.time' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { hour: '$_id', count: 1, _id: 0 } },
    ])

    const attendanceRate = confirmed > 0 ? Math.round((checkedIn / confirmed) * 100) : 0
    const teamFormationRate = confirmed > 0 ? Math.round((teams * event.teamConfig.minSize / confirmed) * 100) : 0

    res.json({
      event: { title: event.title, status: event.status, registrationLimit: event.registrationLimit },
      stats: {
        confirmed,
        waitlisted,
        cancelled,
        checkedIn,
        notCheckedIn: confirmed - checkedIn,
        teams,
        approvedTeams,
        attendanceRate,
        teamFormationRate,
        capacityUsed: Math.round((event.currentCount / event.registrationLimit) * 100),
      },
      charts: {
        registrationTrend: regTrend,
        checkinByHour,
        statusBreakdown: [
          { name: 'Confirmed', value: confirmed, fill: '#3b82f6' },
          { name: 'Waitlisted', value: waitlisted, fill: '#f59e0b' },
          { name: 'Cancelled', value: cancelled, fill: '#ef4444' },
        ],
        checkinProgress: [
          { name: 'Checked In', value: checkedIn, fill: '#22c55e' },
          { name: 'Not Yet', value: confirmed - checkedIn, fill: '#e5e7eb' },
        ],
      },
    })
  } catch (err) {
    console.error('getEventAnalytics:', err)
    res.status(500).json({ message: 'Failed to fetch analytics' })
  }
}

// Cross-event analytics for admin dashboard
exports.getAdminAnalytics = async (req, res) => {
  try {
    const events = await Event.find({ adminId: req.user.id }).select('_id title registrationLimit currentCount status')
    const eventIds = events.map((e) => e._id)

    const [totalConfirmed, totalCheckedIn, totalTeams] = await Promise.all([
      Registration.countDocuments({ eventId: { $in: eventIds }, status: 'confirmed' }),
      Registration.countDocuments({ eventId: { $in: eventIds }, 'checkIn.done': true }),
      Team.countDocuments({ eventId: { $in: eventIds } }),
    ])

    // Per-event stats for bar chart
    const perEventStats = await Promise.all(
      events.map(async (event) => {
        const [confirmed, checkedIn, teams] = await Promise.all([
          Registration.countDocuments({ eventId: event._id, status: 'confirmed' }),
          Registration.countDocuments({ eventId: event._id, 'checkIn.done': true }),
          Team.countDocuments({ eventId: event._id }),
        ])
        return {
          name: event.title.length > 20 ? event.title.slice(0, 20) + '…' : event.title,
          registrations: confirmed,
          checkins: checkedIn,
          teams,
          capacity: event.registrationLimit,
        }
      })
    )

    res.json({
      summary: {
        totalEvents: events.length,
        activeEvents: events.filter((e) => e.status === 'active').length,
        totalConfirmed,
        totalCheckedIn,
        totalTeams,
        overallAttendanceRate: totalConfirmed > 0 ? Math.round((totalCheckedIn / totalConfirmed) * 100) : 0,
      },
      perEventStats,
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch analytics' })
  }
}

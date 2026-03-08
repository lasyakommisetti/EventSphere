const crypto = require('crypto')
const Team = require('../models/Team')
const Event = require('../models/Event')
const Registration = require('../models/Registration')
const User = require('../models/User')
const Notification = require('../models/Notification')
const { sendTeamInvite } = require('../services/email.service')

// Participant: Create a team for an event
exports.createTeam = async (req, res) => {
  try {
    const { name, eventId } = req.body
    const userId = req.user.id

    // Must be registered for the event
    const registration = await Registration.findOne({ userId, eventId, status: 'confirmed' })
    if (!registration) {
      return res.status(403).json({ message: 'You must be registered for this event to create a team' })
    }

    // Check if user already has a team in this event
    const existing = await Team.findOne({ eventId, 'members.userId': userId })
    if (existing) {
      return res.status(409).json({ message: 'You already belong to a team for this event' })
    }

    const team = await Team.create({
      name,
      eventId,
      leaderId: userId,
      members: [{ userId, joinedAt: new Date() }],
    })

    // Link team to registration
    await Registration.findByIdAndUpdate(registration._id, { teamId: team._id })

    res.status(201).json({ team })
  } catch (err) {
    console.error('createTeam:', err)
    res.status(500).json({ message: 'Failed to create team' })
  }
}

// Participant: Get teams for an event (my teams)
exports.getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({ 'members.userId': req.user.id })
      .populate('eventId', 'title schedule status')
      .populate('leaderId', 'name email avatar')
      .populate('members.userId', 'name email avatar')
      .sort({ createdAt: -1 })

    res.json({ teams })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teams' })
  }
}

// Participant: Get teams for a specific event
exports.getEventTeams = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const [teams, total] = await Promise.all([
      Team.find({ eventId: req.params.eventId })
        .populate('leaderId', 'name email avatar')
        .populate('members.userId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Team.countDocuments({ eventId: req.params.eventId }),
    ])

    res.json({ teams, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teams' })
  }
}

// Participant: Invite member by email (generates token)
exports.inviteMember = async (req, res) => {
  try {
    const { email } = req.body
    const teamId = req.params.id

    const team = await Team.findOne({ _id: teamId, leaderId: req.user.id })
    if (!team) return res.status(403).json({ message: 'Only the team leader can send invites' })

    const event = await Event.findById(team.eventId)
    if (!event) return res.status(404).json({ message: 'Event not found' })

    if (team.members.length >= event.teamConfig.maxSize) {
      return res.status(400).json({ message: 'Team is already at maximum size' })
    }

    // Check if already invited
    const alreadyInvited = team.pendingInvites.some(
      (inv) => inv.email === email && inv.expiresAt > new Date()
    )
    if (alreadyInvited) {
      return res.status(409).json({ message: 'Invite already sent to this email' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    team.pendingInvites.push({ email, token, expiresAt })
    await team.save()

    const inviteUrl = `${process.env.CLIENT_URL}/teams/join?token=${token}`

    // Send real email via Resend
    const invitee = await User.findOne({ email })
    await sendTeamInvite({
      to: email,
      inviteeName: invitee?.name || null,
      teamName: team.name,
      eventTitle: event.title,
      inviteUrl,
    })

    // In-app notification if user exists
    if (invitee) {
      const notification = await Notification.create({
        eventId: team.eventId,
        channel: 'in-app',
        recipientScope: 'individual',
        recipients: [invitee._id],
        subject: `Team Invite: ${team.name}`,
        body: `You've been invited to join team "${team.name}" for ${event.title}. Use this link to accept: ${inviteUrl}`,
        status: 'sent',
        sentAt: new Date(),
      })

      // Emit real-time notification to the invitee if they are online
      const io = req.app.get('io')
      if (io) {
        io.to(`user:${invitee._id}`).emit('notification', {
          _id: notification._id,
          subject: notification.subject,
          body: notification.body,
          eventId: team.eventId,
          createdAt: notification.createdAt,
        })
      }
    }

    res.json({ message: 'Invite sent', token, inviteUrl })
  } catch (err) {
    res.status(500).json({ message: 'Failed to send invite' })
  }
}

// Participant: Accept invite via token
exports.acceptInvite = async (req, res) => {
  try {
    const { token } = req.body
    const userId = req.user.id

    const team = await Team.findOne({
      'pendingInvites.token': token,
      'pendingInvites.expiresAt': { $gt: new Date() },
    })

    if (!team) {
      return res.status(400).json({ message: 'Invalid or expired invite token' })
    }

    const invite = team.pendingInvites.find((inv) => inv.token === token)

    // Check max size
    const event = await Event.findById(team.eventId)
    if (team.members.length >= event.teamConfig.maxSize) {
      return res.status(400).json({ message: 'Team is full' })
    }

    // Check if already a member
    const isMember = team.members.some((m) => m.userId.toString() === userId)
    if (isMember) {
      return res.status(409).json({ message: 'Already a member of this team' })
    }

    // Must be registered for the event
    const registration = await Registration.findOne({ userId, eventId: team.eventId, status: 'confirmed' })
    if (!registration) {
      return res.status(403).json({ message: 'You must be registered for this event to join a team' })
    }

    // Add member and remove invite (single-use)
    team.members.push({ userId, joinedAt: new Date() })
    team.pendingInvites = team.pendingInvites.filter((inv) => inv.token !== token)
    await team.save()

    // Link team to registration
    await Registration.findByIdAndUpdate(registration._id, { teamId: team._id })

    await team.populate('members.userId', 'name email avatar')

    res.json({ team, message: 'Joined team successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to join team' })
  }
}

// Admin: Get confirmed participants with no team for an event
exports.getTeamlessParticipants = async (req, res) => {
  try {
    const { eventId } = req.params

    // Verify the event belongs to this admin
    const event = await Event.findOne({ _id: eventId, adminId: req.user.id })
    if (!event) return res.status(403).json({ message: 'Not authorized' })

    // Confirmed registrations with no teamId
    const regs = await Registration.find({
      eventId,
      status: 'confirmed',
      teamId: { $exists: false },
    }).populate('userId', 'name email avatar')

    const participants = regs.map((r) => ({
      registrationId: r._id,
      user: r.userId,
    }))

    res.json({ participants })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teamless participants' })
  }
}

// Admin: Create a team on behalf of participants (assign members)
exports.adminCreateTeam = async (req, res) => {
  try {
    const { eventId, teamName, memberUserIds } = req.body

    if (!eventId || !teamName || !Array.isArray(memberUserIds) || memberUserIds.length === 0) {
      return res.status(400).json({ message: 'eventId, teamName and memberUserIds are required' })
    }

    // Verify event ownership
    const event = await Event.findOne({ _id: eventId, adminId: req.user.id })
    if (!event) return res.status(403).json({ message: 'Not authorized' })

    // Validate team size
    if (memberUserIds.length > event.teamConfig.maxSize) {
      return res.status(400).json({ message: `Team exceeds max size of ${event.teamConfig.maxSize}` })
    }

    // All members must be confirmed registrants with no existing team
    const regs = await Registration.find({
      eventId,
      userId: { $in: memberUserIds },
      status: 'confirmed',
    })

    if (regs.length !== memberUserIds.length) {
      return res.status(400).json({ message: 'Some members are not confirmed registrants for this event' })
    }

    const alreadyTeamed = regs.filter((r) => r.teamId)
    if (alreadyTeamed.length > 0) {
      return res.status(409).json({ message: 'Some members already belong to a team' })
    }

    // Use first member as leader
    const leaderId = memberUserIds[0]

    const team = await Team.create({
      name: teamName,
      eventId,
      leaderId,
      members: memberUserIds.map((uid) => ({ userId: uid, joinedAt: new Date() })),
      status: 'approved', // Admin-created teams are auto-approved
    })

    // Link team to all registrations
    await Registration.updateMany(
      { eventId, userId: { $in: memberUserIds } },
      { $set: { teamId: team._id } }
    )

    await team.populate('members.userId', 'name email avatar')
    await team.populate('leaderId', 'name email avatar')

    // Notify all members
    const io = req.app.get('io')
    for (const userId of memberUserIds) {
      const notification = await Notification.create({
        eventId,
        channel: 'in-app',
        recipientScope: 'individual',
        recipients: [userId],
        subject: `You've been added to team "${team.name}"`,
        body: `The event organizer has placed you in team "${team.name}" for ${event.title}.`,
        status: 'sent',
        sentAt: new Date(),
      })
      if (io) {
        io.to(`user:${userId}`).emit('notification', {
          _id: notification._id,
          subject: notification.subject,
          body: notification.body,
          eventId,
          createdAt: notification.createdAt,
        })
      }
    }

    res.status(201).json({ team })
  } catch (err) {
    console.error('adminCreateTeam:', err)
    res.status(500).json({ message: 'Failed to create team' })
  }
}

// Admin: Add unassigned participants to an existing team
exports.adminAddToTeam = async (req, res) => {
  try {
    const { memberUserIds } = req.body
    const teamId = req.params.id

    if (!Array.isArray(memberUserIds) || memberUserIds.length === 0) {
      return res.status(400).json({ message: 'memberUserIds is required' })
    }

    const team = await Team.findById(teamId).populate('eventId', 'adminId title teamConfig')
    if (!team) return res.status(404).json({ message: 'Team not found' })
    if (team.eventId.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const event = team.eventId
    const newTotal = team.members.length + memberUserIds.length
    if (newTotal > event.teamConfig.maxSize) {
      return res.status(400).json({
        message: `Adding these members would exceed the max team size of ${event.teamConfig.maxSize}`,
      })
    }

    // Validate all are confirmed registrants with no existing team
    const regs = await Registration.find({
      eventId: event._id,
      userId: { $in: memberUserIds },
      status: 'confirmed',
    })

    if (regs.length !== memberUserIds.length) {
      return res.status(400).json({ message: 'Some members are not confirmed registrants for this event' })
    }

    const alreadyTeamed = regs.filter((r) => r.teamId)
    if (alreadyTeamed.length > 0) {
      return res.status(409).json({ message: 'Some members already belong to a team' })
    }

    // Add members to team
    const newMembers = memberUserIds.map((uid) => ({ userId: uid, joinedAt: new Date() }))
    team.members.push(...newMembers)
    await team.save()

    // Link registrations
    await Registration.updateMany(
      { eventId: event._id, userId: { $in: memberUserIds } },
      { $set: { teamId: team._id } }
    )

    await team.populate('members.userId', 'name email avatar')
    await team.populate('leaderId', 'name email avatar')

    // Notify new members
    const io = req.app.get('io')
    for (const userId of memberUserIds) {
      const notification = await Notification.create({
        eventId: event._id,
        channel: 'in-app',
        recipientScope: 'individual',
        recipients: [userId],
        subject: `You've been added to team "${team.name}"`,
        body: `The event organizer has added you to team "${team.name}" for ${event.title}.`,
        status: 'sent',
        sentAt: new Date(),
      })
      if (io) {
        io.to(`user:${userId}`).emit('notification', {
          _id: notification._id,
          subject: notification.subject,
          body: notification.body,
          eventId: event._id,
          createdAt: notification.createdAt,
        })
      }
    }

    res.json({ team })
  } catch (err) {
    console.error('adminAddToTeam:', err)
    res.status(500).json({ message: 'Failed to add members to team' })
  }
}

// Admin: Update team status (approve/reject)
exports.updateTeamStatus = async (req, res) => {
  try {
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const team = await Team.findById(req.params.id).populate('eventId', 'adminId title')
    if (!team) return res.status(404).json({ message: 'Team not found' })
    if (team.eventId.adminId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    team.status = status
    await team.save()

    // Notify team members
    const memberIds = team.members.map((m) => m.userId)
    await Notification.create({
      eventId: team.eventId._id,
      channel: 'in-app',
      recipientScope: 'team',
      recipients: memberIds,
      subject: `Team ${status === 'approved' ? 'Approved' : 'Rejected'}: ${team.name}`,
      body: `Your team "${team.name}" for ${team.eventId.title} has been ${status}.`,
      status: 'sent',
      sentAt: new Date(),
    })

    res.json({ team })
  } catch (err) {
    res.status(500).json({ message: 'Failed to update team status' })
  }
}

const QRCode = require('qrcode')
const Registration = require('../models/Registration')
const Event = require('../models/Event')
const User = require('../models/User')

// Generate QR code image for a registration
exports.getQRCode = async (req, res) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      userId: req.user.id,
    })
    if (!registration) return res.status(404).json({ message: 'Registration not found' })
    if (registration.status !== 'confirmed') {
      return res.status(400).json({ message: 'Only confirmed registrations have a QR code' })
    }

    const qrData = JSON.stringify({
      token: registration.checkIn.qrToken,
      registrationId: registration._id,
    })

    const dataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 })
    res.json({ qrCode: dataUrl, token: registration.checkIn.qrToken })
  } catch (err) {
    console.error('getQRCode:', err)
    res.status(500).json({ message: 'Failed to generate QR code' })
  }
}

// Check in via QR token
exports.checkInByQR = async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ message: 'QR token is required' })

    const registration = await Registration.findOne({ 'checkIn.qrToken': token })
      .populate('userId', 'name email avatar')
      .populate('eventId', 'title adminId')

    if (!registration) return res.status(404).json({ message: 'Invalid QR code' })

    // Verify the scanner/admin owns this event
    const event = registration.eventId
    const isAdmin = req.user.role === 'admin' && event.adminId?.toString() === req.user.id
    const isScanner = req.user.role === 'scanner'
    if (!isAdmin && !isScanner) {
      return res.status(403).json({ message: 'Not authorized to check in for this event' })
    }

    if (registration.checkIn.done) {
      return res.status(409).json({
        message: 'Already checked in',
        checkedInAt: registration.checkIn.time,
        user: registration.userId,
      })
    }

    if (registration.status !== 'confirmed') {
      return res.status(400).json({ message: `Cannot check in — registration is ${registration.status}` })
    }

    registration.checkIn.done = true
    registration.checkIn.time = new Date()
    registration.checkIn.method = 'qr'
    await registration.save()

    // Emit real-time event
    const io = req.app.get('io')
    if (io) {
      io.to(`event:${event._id}`).emit('checkin', {
        registrationId: registration._id,
        user: registration.userId,
        time: registration.checkIn.time,
      })
    }

    res.json({
      message: 'Check-in successful',
      user: registration.userId,
      event: event.title,
      time: registration.checkIn.time,
    })
  } catch (err) {
    console.error('checkInByQR:', err)
    res.status(500).json({ message: 'Check-in failed' })
  }
}

// Manual check-in: search by name or email, then mark attendance
exports.searchForCheckin = async (req, res) => {
  try {
    const { query, eventId } = req.query
    if (!query || !eventId) {
      return res.status(400).json({ message: 'query and eventId are required' })
    }

    // Verify admin owns the event
    const event = await Event.findOne({ _id: eventId, adminId: req.user.id })
    if (!event && req.user.role !== 'scanner') {
      return res.status(403).json({ message: 'Not authorized' })
    }

    // Find matching users
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    }).select('_id name email avatar')

    if (!users.length) return res.json({ results: [] })

    const userIds = users.map((u) => u._id)
    const registrations = await Registration.find({
      eventId,
      userId: { $in: userIds },
      status: 'confirmed',
    }).populate('userId', 'name email avatar')

    res.json({ results: registrations })
  } catch (err) {
    res.status(500).json({ message: 'Search failed' })
  }
}

// Manual check-in: mark attendance by registrationId
exports.checkInManual = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId)
      .populate('userId', 'name email avatar')
      .populate('eventId', 'title adminId')

    if (!registration) return res.status(404).json({ message: 'Registration not found' })

    const event = registration.eventId
    const isAdmin = req.user.role === 'admin' && event.adminId?.toString() === req.user.id
    if (!isAdmin && req.user.role !== 'scanner') {
      return res.status(403).json({ message: 'Not authorized' })
    }

    if (registration.checkIn.done) {
      return res.status(409).json({ message: 'Already checked in', checkedInAt: registration.checkIn.time })
    }

    registration.checkIn.done = true
    registration.checkIn.time = new Date()
    registration.checkIn.method = 'manual'
    await registration.save()

    const io = req.app.get('io')
    if (io) {
      io.to(`event:${event._id}`).emit('checkin', {
        registrationId: registration._id,
        user: registration.userId,
        time: registration.checkIn.time,
      })
    }

    res.json({ message: 'Checked in manually', user: registration.userId, time: registration.checkIn.time })
  } catch (err) {
    res.status(500).json({ message: 'Manual check-in failed' })
  }
}

// Undo check-in
exports.undoCheckin = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId)
      .populate('eventId', 'adminId')

    if (!registration) return res.status(404).json({ message: 'Not found' })
    if (registration.eventId.adminId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    registration.checkIn.done = false
    registration.checkIn.time = undefined
    registration.checkIn.method = undefined
    await registration.save()

    res.json({ message: 'Check-in undone' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to undo check-in' })
  }
}

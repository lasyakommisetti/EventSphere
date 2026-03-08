const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const ctrl = require('../controllers/notification.controller')

router.post('/broadcast', verifyToken, checkRole('admin'), ctrl.broadcastAnnouncement)
router.get('/event/:eventId', verifyToken, checkRole('admin'), ctrl.getEventNotifications)

module.exports = router

const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const ctrl = require('../controllers/analytics.controller')

router.get('/admin', verifyToken, checkRole('admin'), ctrl.getAdminAnalytics)
router.get('/event/:eventId', verifyToken, checkRole('admin'), ctrl.getEventAnalytics)

module.exports = router

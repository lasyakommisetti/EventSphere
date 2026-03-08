const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const ctrl = require('../controllers/checkin.controller')

// Participant: get own QR code
router.get('/qr/:registrationId', verifyToken, ctrl.getQRCode)

// Admin/Scanner: check in
router.post('/qr', verifyToken, checkRole('admin', 'scanner'), ctrl.checkInByQR)
router.get('/search', verifyToken, checkRole('admin', 'scanner'), ctrl.searchForCheckin)
router.post('/manual/:registrationId', verifyToken, checkRole('admin', 'scanner'), ctrl.checkInManual)
router.post('/undo/:registrationId', verifyToken, checkRole('admin'), ctrl.undoCheckin)

module.exports = router

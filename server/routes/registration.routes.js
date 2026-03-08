const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validate = require('../middleware/validate')
const { registerForEventSchema } = require('../../shared/schemas/registration.schema')
const ctrl = require('../controllers/registration.controller')

router.post('/', verifyToken, checkRole('participant'), validate(registerForEventSchema), ctrl.registerForEvent)
router.get('/my', verifyToken, ctrl.getMyRegistrations)
router.get('/notifications', verifyToken, ctrl.getMyNotifications)
router.patch('/:id/cancel', verifyToken, ctrl.cancelRegistration)

module.exports = router

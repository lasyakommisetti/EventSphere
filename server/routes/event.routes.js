const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validate = require('../middleware/validate')
const { eventSchema, updateEventSchema } = require('../../shared/schemas/event.schema')
const ctrl = require('../controllers/event.controller')

// Public routes (no auth required)
router.get('/', ctrl.listEvents)
router.get('/:id', ctrl.getEvent)

// Participant routes
router.get('/my/registrations', verifyToken, ctrl.getAdminEvents) // reused pattern

// Admin routes
router.get('/admin/all', verifyToken, checkRole('admin'), ctrl.getAdminEvents)
router.get('/admin/dashboard', verifyToken, checkRole('admin'), ctrl.getDashboardStats)
router.get('/:id/summary', verifyToken, checkRole('admin'), ctrl.getEventSummary)
router.get('/:id/registrations', verifyToken, checkRole('admin'), ctrl.getEventRegistrations)
router.post('/', verifyToken, checkRole('admin'), validate(eventSchema), ctrl.createEvent)
router.put('/:id', verifyToken, checkRole('admin'), validate(updateEventSchema), ctrl.updateEvent)
router.delete('/:id', verifyToken, checkRole('admin'), ctrl.deleteEvent)
router.post('/:id/clone', verifyToken, checkRole('admin'), ctrl.cloneEvent)
router.get('/:id/export-csv', verifyToken, checkRole('admin'), ctrl.exportCSV)

module.exports = router

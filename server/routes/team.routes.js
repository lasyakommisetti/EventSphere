const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validate = require('../middleware/validate')
const { createTeamSchema, inviteMemberSchema } = require('../../shared/schemas/team.schema')
const ctrl = require('../controllers/team.controller')

router.post('/', verifyToken, checkRole('participant'), validate(createTeamSchema), ctrl.createTeam)
router.get('/my', verifyToken, ctrl.getMyTeams)
router.get('/event/:eventId', verifyToken, ctrl.getEventTeams)
router.get('/event/:eventId/teamless', verifyToken, checkRole('admin'), ctrl.getTeamlessParticipants)
router.post('/admin-create', verifyToken, checkRole('admin'), ctrl.adminCreateTeam)
router.post('/:id/invite', verifyToken, checkRole('participant'), validate(inviteMemberSchema), ctrl.inviteMember)
router.post('/join', verifyToken, checkRole('participant'), ctrl.acceptInvite)
router.post('/:id/add-members', verifyToken, checkRole('admin'), ctrl.adminAddToTeam)
router.patch('/:id/status', verifyToken, checkRole('admin'), ctrl.updateTeamStatus)

module.exports = router

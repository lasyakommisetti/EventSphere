const express = require('express')
const router = express.Router()
const validate = require('../middleware/validate')
const verifyToken = require('../middleware/verifyToken')
const { authLimiter } = require('../middleware/rateLimiter')
const { registerSchema, loginSchema } = require('../../shared/schemas/auth.schema')
const ctrl = require('../controllers/auth.controller')

router.post('/register', authLimiter, validate(registerSchema), ctrl.register)
router.post('/login', authLimiter, validate(loginSchema), ctrl.login)
router.post('/refresh', ctrl.refresh)
router.post('/logout', ctrl.logout)
router.get('/me', verifyToken, ctrl.me)

module.exports = router

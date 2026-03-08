require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const cookieParser = require('cookie-parser')
const connectDB = require('./config/db')
const { globalLimiter } = require('./middleware/rateLimiter')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3002',
    credentials: true,
  },
})

// Make io accessible in controllers via req.app.get('io')
app.set('io', io)

// Socket.io connection handling
io.on('connection', (socket) => {
  // Join personal room for notifications
  socket.on('join:user', (userId) => {
    socket.join(`user:${userId}`)
  })

  // Join event room for real-time seat counter + check-in updates
  socket.on('join:event', (eventId) => {
    socket.join(`event:${eventId}`)
  })

  socket.on('leave:event', (eventId) => {
    socket.leave(`event:${eventId}`)
  })

  socket.on('disconnect', () => {})
})

// Connect to MongoDB
connectDB()

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3002',
  credentials: true,
}))
app.use(globalLimiter)
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.use(mongoSanitize())

// Routes
app.use('/api/auth', require('./routes/auth.routes'))
app.use('/api/events', require('./routes/event.routes'))
app.use('/api/registrations', require('./routes/registration.routes'))
app.use('/api/teams', require('./routes/team.routes'))
app.use('/api/checkin', require('./routes/checkin.routes'))
app.use('/api/analytics', require('./routes/analytics.routes'))
app.use('/api/notifications', require('./routes/notification.routes'))

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Internal server error' })
})

// Emit seat update helper (called from registration controller)
app.set('emitSeatUpdate', (eventId, currentCount, limit) => {
  io.to(`event:${eventId}`).emit('seat:update', { eventId, currentCount, limit })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => console.log(`EvenShore API running on port ${PORT}`))

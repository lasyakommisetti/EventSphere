require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') })
// Use server's own node_modules to avoid version conflicts
const mongoose = require('../server/node_modules/mongoose')

// Load models
const User = require('../server/models/User')
const Event = require('../server/models/Event')
const Registration = require('../server/models/Registration')
const Team = require('../server/models/Team')
const Notification = require('../server/models/Notification')

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  // Clear existing seed data
  await Promise.all([
    User.deleteMany({ email: { $regex: /@evenshore\.demo$/ } }),
    Event.deleteMany({ tags: 'seed-demo' }),
  ])
  console.log('Cleared old seed data')

  // Create admin
  const admin = await User.create({
    name: 'Alice Admin',
    email: 'alice@evenshore.demo',
    passwordHash: 'Demo@1234',
    role: 'admin',
    phone: '+1 555 0100',
  })

  // Create participants
  const participants = await User.insertMany([
    { name: 'Bob Builder', email: 'bob@evenshore.demo', passwordHash: 'Demo@1234', role: 'participant', phone: '+1 555 0101' },
    { name: 'Carol Coder', email: 'carol@evenshore.demo', passwordHash: 'Demo@1234', role: 'participant', phone: '+1 555 0102' },
    { name: 'Dave Designer', email: 'dave@evenshore.demo', passwordHash: 'Demo@1234', role: 'participant', phone: '+1 555 0103' },
    { name: 'Eve Engineer', email: 'eve@evenshore.demo', passwordHash: 'Demo@1234', role: 'participant', phone: '+1 555 0104' },
    { name: 'Frank Frontend', email: 'frank@evenshore.demo', passwordHash: 'Demo@1234', role: 'participant' },
  ])

  // Hash passwords — insertMany bypasses pre-save hook, so hash manually
  const bcrypt = require('../server/node_modules/bcryptjs')
  const hashed = await bcrypt.hash('Demo@1234', 12)
  await User.updateMany(
    { email: { $regex: /@evenshore\.demo$/ } },
    { $set: { passwordHash: hashed } }
  )

  console.log('Created users')

  const now = new Date()
  const future = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const past = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // Create events
  const [hackathon, workshop, webinar] = await Event.insertMany([
    {
      title: 'HackNight 2026',
      description: 'A 24-hour hackathon bringing together the best builders. Teams of 2-4 compete to build innovative solutions.',
      adminId: admin._id,
      type: 'hackathon',
      venue: { type: 'physical', location: '123 Innovation Hub, San Francisco, CA' },
      schedule: { start: future(7), end: future(8) },
      teamConfig: { minSize: 2, maxSize: 4, allowSolo: false },
      registrationLimit: 100,
      currentCount: 4,
      status: 'active',
      tags: ['seed-demo', 'react', 'node', 'ai', 'beginner-friendly'],
    },
    {
      title: 'Next.js Deep Dive Workshop',
      description: 'Hands-on workshop covering App Router, Server Components, and deployment strategies.',
      adminId: admin._id,
      type: 'workshop',
      venue: { type: 'virtual', link: 'https://meet.google.com/demo-link' },
      schedule: { start: future(3), end: future(3) },
      teamConfig: { minSize: 1, maxSize: 1, allowSolo: true },
      registrationLimit: 50,
      currentCount: 2,
      status: 'active',
      tags: ['seed-demo', 'nextjs', 'typescript', 'workshop'],
    },
    {
      title: 'AI in Production — Webinar',
      description: 'Learn how top companies are deploying LLMs in production.',
      adminId: admin._id,
      type: 'webinar',
      venue: { type: 'virtual', link: 'https://zoom.us/demo' },
      schedule: { start: past(2), end: past(2) },
      teamConfig: { minSize: 1, maxSize: 1, allowSolo: true },
      registrationLimit: 200,
      currentCount: 2,
      status: 'completed',
      tags: ['seed-demo', 'ai', 'llm', 'production'],
    },
  ])

  console.log('Created events')

  // Register participants for hackathon
  const regs = await Registration.insertMany([
    { userId: participants[0]._id, eventId: hackathon._id, status: 'confirmed', checkIn: { done: true, time: new Date(), method: 'qr' } },
    { userId: participants[1]._id, eventId: hackathon._id, status: 'confirmed', checkIn: { done: false } },
    { userId: participants[2]._id, eventId: hackathon._id, status: 'confirmed', checkIn: { done: false } },
    { userId: participants[3]._id, eventId: hackathon._id, status: 'waitlisted', checkIn: { done: false } },
    { userId: participants[0]._id, eventId: workshop._id, status: 'confirmed', checkIn: { done: false } },
    { userId: participants[1]._id, eventId: workshop._id, status: 'confirmed', checkIn: { done: true, time: new Date(), method: 'manual' } },
    { userId: participants[0]._id, eventId: webinar._id, status: 'confirmed', checkIn: { done: true, time: past(2), method: 'qr' } },
    { userId: participants[1]._id, eventId: webinar._id, status: 'confirmed', checkIn: { done: true, time: past(2), method: 'qr' } },
  ])

  // Create team for hackathon
  const team = await Team.create({
    name: 'Pixel Pirates',
    eventId: hackathon._id,
    leaderId: participants[0]._id,
    members: [
      { userId: participants[0]._id, joinedAt: new Date() },
      { userId: participants[1]._id, joinedAt: new Date() },
    ],
    status: 'approved',
  })

  // Link team to registrations
  await Registration.updateMany(
    { userId: { $in: [participants[0]._id, participants[1]._id] }, eventId: hackathon._id },
    { teamId: team._id }
  )

  console.log('Created registrations & team')

  console.log('\n========== DEMO CREDENTIALS ==========')
  console.log('Admin:       alice@evenshore.demo  /  Demo@1234')
  console.log('Participant: bob@evenshore.demo    /  Demo@1234')
  console.log('Participant: carol@evenshore.demo  /  Demo@1234')
  console.log('=======================================\n')

  await mongoose.disconnect()
  console.log('Seed complete!')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

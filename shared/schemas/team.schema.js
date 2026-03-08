const { z } = require('zod')

const createTeamSchema = z.object({
  name: z.string().min(2).max(60).trim(),
  eventId: z.string().length(24), // ObjectId
})

const inviteMemberSchema = z.object({
  email: z.string().email().toLowerCase(),
})

module.exports = { createTeamSchema, inviteMemberSchema }

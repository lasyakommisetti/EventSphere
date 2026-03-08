const { z } = require('zod')

const registerSchema = z.object({
  name: z.string().min(2).max(60).trim(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  role: z.enum(['admin', 'participant']).optional().default('participant'),
  phone: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
})

module.exports = { registerSchema, loginSchema }

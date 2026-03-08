const { z } = require('zod')

const eventSchema = z.object({
  title: z.string().min(3).max(120).trim(),
  description: z.string().min(10).max(5000),
  type: z.enum(['hackathon', 'workshop', 'conference', 'seminar', 'webinar']),
  venue: z.object({
    type: z.enum(['physical', 'virtual']),
    location: z.string().optional(),
    link: z.string().url().optional(),
  }),
  schedule: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    sessions: z.array(z.object({
      title: z.string(),
      time: z.string().datetime(),
      speaker: z.string().optional(),
      duration: z.number().int().positive().optional(),
    })).optional().default([]),
  }),
  teamConfig: z.object({
    minSize: z.number().int().min(1).default(1),
    maxSize: z.number().int().min(1).max(20).default(5),
    allowSolo: z.boolean().default(true),
  }).optional().default({}),
  registrationLimit: z.number().int().min(1),
  status: z.enum(['draft', 'active', 'closed', 'completed']).optional().default('draft'),
  tags: z.array(z.string().toLowerCase()).optional().default([]),
  bannerUrl: z.string().url().optional(),
})

const updateEventSchema = eventSchema.partial()

module.exports = { eventSchema, updateEventSchema }

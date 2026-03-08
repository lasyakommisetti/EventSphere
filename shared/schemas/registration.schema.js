const { z } = require('zod')

const registerForEventSchema = z.object({
  eventId: z.string().length(24),
})

module.exports = { registerForEventSchema }

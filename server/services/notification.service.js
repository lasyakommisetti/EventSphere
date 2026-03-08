/**
 * Mock notification service
 * In production: replace console.log with real email/WhatsApp providers
 */

const mockEmailSend = async ({ to, subject, body }) => {
  console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`)
  console.log(`[MOCK EMAIL] Body: ${body.slice(0, 100)}...`)
  return { success: true, provider: 'mock-email' }
}

const mockWhatsAppSend = async ({ phone, body }) => {
  console.log(`[MOCK WHATSAPP] To: ${phone}`)
  console.log(`[MOCK WHATSAPP] Message: ${body.slice(0, 100)}...`)
  return { success: true, provider: 'mock-whatsapp' }
}

/**
 * Send registration confirmation (mock email)
 */
const sendRegistrationConfirmation = async (user, event) => {
  await mockEmailSend({
    to: user.email,
    subject: `Registration Confirmed: ${event.title}`,
    body: `Hi ${user.name},\n\nYou're registered for ${event.title} on ${new Date(event.schedule.start).toDateString()}.\n\nCheck your QR code in My Events.\n\nEvenShore Team`,
  })
}

/**
 * Send event reminder (mock WhatsApp)
 */
const sendEventReminder = async (user, event) => {
  await mockWhatsAppSend({
    phone: user.phone || 'N/A',
    body: `Reminder: ${event.title} starts ${new Date(event.schedule.start).toDateString()}. Don't forget your QR code!`,
  })
}

/**
 * BullMQ mock — in production use: new Queue('notifications', { connection: redis })
 * For hackathon: runs async without blocking the request thread
 */
const queueNotification = (type, payload) => {
  setImmediate(async () => {
    try {
      if (type === 'registration-confirmation') {
        await sendRegistrationConfirmation(payload.user, payload.event)
      } else if (type === 'event-reminder') {
        await sendEventReminder(payload.user, payload.event)
      }
    } catch (err) {
      console.error(`[NOTIFICATION QUEUE] Failed to send ${type}:`, err.message)
    }
  })
}

module.exports = { queueNotification, sendRegistrationConfirmation, sendEventReminder }

const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'EVENTSPHERE <onboarding@resend.dev>'

/**
 * Send team invite email with the join link
 */
const sendTeamInvite = async ({ to, inviteeName, teamName, eventTitle, inviteUrl }) => {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL - no key] Team invite to ${to}: ${inviteUrl}`)
    return { success: false, reason: 'No RESEND_API_KEY set' }
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `You're invited to join team "${teamName}" — ${eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Team Invite</title>
      </head>
      <body style="margin:0;padding:0;background:#f8faff;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%);padding:36px 40px;text-align:center;">
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-block;text-align:center;line-height:36px;font-size:18px;">🌐</div>
                      <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">EVENTSPHERE</span>
                    </div>
                    <p style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:8px 0 0;">Transforming Event Chaos Into Structured Intelligence</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">You've been invited! 🎉</h1>
                    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                      ${inviteeName ? `Hi ${inviteeName},` : 'Hi there,'}<br/><br/>
                      You've been invited to join team <strong style="color:#6366f1;">${teamName}</strong> for the event <strong style="color:#0f172a;">${eventTitle}</strong>.
                    </p>

                    <!-- Event card -->
                    <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                        <div style="width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:inline-block;text-align:center;line-height:40px;font-size:18px;flex-shrink:0;">👥</div>
                        <div>
                          <p style="margin:0;font-size:13px;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Team Invite</p>
                          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">${teamName}</p>
                        </div>
                      </div>
                      <p style="margin:0;font-size:13px;color:#64748b;">Event: <strong style="color:#334155;">${eventTitle}</strong></p>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align:center;margin-bottom:28px;">
                      <a href="${inviteUrl}"
                         style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">
                        Accept Invite &rarr;
                      </a>
                    </div>

                    <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;text-align:center;">Or copy this link into your browser:</p>
                    <div style="background:#f1f5f9;border-radius:8px;padding:10px 16px;word-break:break-all;">
                      <a href="${inviteUrl}" style="font-size:12px;color:#6366f1;text-decoration:none;">${inviteUrl}</a>
                    </div>

                    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
                      This invite link expires in <strong>24 hours</strong>. You must be registered for the event to join.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8faff;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;">
                      Sent by EVENTSPHERE &nbsp;·&nbsp; If you didn't expect this, you can safely ignore it.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  })

  if (error) {
    console.error('[EMAIL] Resend error:', error)
    return { success: false, error }
  }

  console.log(`[EMAIL] Invite sent to ${to} — id: ${data.id}`)
  return { success: true, id: data.id }
}

module.exports = { sendTeamInvite }
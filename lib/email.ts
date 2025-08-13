import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvitationEmail(email: string, invitationLink: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const imageUrl = `${baseUrl}/assets/mission.png`;

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'You have been invited to join an organization on Emery',
      html: `
<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding: 20px 0;">
      <table width="600" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #ddd;">
        <tr>
          <td align="center" style="padding: 40px 0; background-color: #f7f7f7;">
            <img src="${imageUrl}" alt="Emery Mission" width="150" style="display: block;" />
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h1 style="color: #333; font-family: Arial, sans-serif;">You're Invited!</h1>
            <p style="color: #555; font-family: Arial, sans-serif; line-height: 1.6;">
              You have been invited to join an organization on Emery. Click the button below to accept your invitation and get started.
            </p>
            <table border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
              <tr>
                <td align="center" style="border-radius: 5px; background-color: #007bff;">
                  <a href="${invitationLink}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; display: inline-block; padding: 15px 25px; border-radius: 5px;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
            </table>
            <p style="color: #888; font-family: Arial, sans-serif; font-size: 12px; margin-top: 30px;">
              If you did not expect this invitation, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 30px; background-color: #f7f7f7; color: #aaa; font-family: Arial, sans-serif; font-size: 12px;">
            &copy; 2025 Emery. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`,
    });
  } catch (error) {
    console.error('Error sending invitation email:', error);
  }
}

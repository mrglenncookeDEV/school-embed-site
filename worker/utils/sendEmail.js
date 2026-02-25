// Placeholder email sender. Replace endpoint with your provider.
export async function sendEmail({
  to,
  subject,
  body,
  attachment,
  fromName = "HousePoint Reminders",
  fromEmail = "reminders@housepoint.local",
  replyTo = null,
}) {
  if (!to || !subject || !attachment?.data) {
    throw new Error("Missing email fields");
  }

  await fetch("https://api.your-email-provider/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      to,
      from: {
        name: fromName,
        email: fromEmail,
      },
      reply_to: replyTo || fromEmail,
      subject,
      text: body,
      attachments: [
        {
          filename: attachment.name,
          content: attachment.data,
          type: "application/pdf",
        },
      ],
    }),
  });
}

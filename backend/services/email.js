const nodemailer = require("nodemailer");
const { getSettingsMap } = require("./settings");

async function sendEmail({ to, subject, text, html }) {
  const settings = getSettingsMap([
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
    "smtp_from"
  ]);

  if (!settings.smtp_host) {
    console.log("[email:dev-fallback]", { to, subject, text });
    return { delivered: false, mode: "dev-fallback" };
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port || 587),
    secure: Number(settings.smtp_port) === 465,
    auth: settings.smtp_user
      ? {
          user: settings.smtp_user,
          pass: settings.smtp_pass
        }
      : undefined
  });

  await transporter.sendMail({
    from: settings.smtp_from || settings.smtp_user,
    to,
    subject,
    text,
    html
  });

  return { delivered: true, mode: "smtp" };
}

module.exports = {
  sendEmail
};

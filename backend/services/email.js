const nodemailer = require("nodemailer");
const { getSettingsMap } = require("./settings");

function buildSesBody({ text, html }) {
  const body = {};
  if (text) {
    body.Text = { Data: text, Charset: "UTF-8" };
  }
  if (html) {
    body.Html = { Data: html, Charset: "UTF-8" };
  }
  return body;
}

function getEmailProvider(settings) {
  const provider = String(settings.mail_provider || "smtp").toLowerCase().trim();
  return provider === "ses" ? "ses" : "smtp";
}

async function sendWithSmtp(settings, { to, subject, text, html }) {
  if (!settings.smtp_host) {
    return null;
  }

  const from = settings.smtp_from || settings.smtp_user;
  if (!from) {
    return null;
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
    from,
    to,
    subject,
    text,
    html
  });

  return { delivered: true, mode: "smtp" };
}

async function sendWithSes(settings, { to, subject, text, html }) {
  if (!settings.ses_region) {
    return null;
  }

  const from = settings.ses_from || settings.smtp_from || settings.smtp_user;
  if (!from) {
    return null;
  }

  let sesSdk;
  try {
    sesSdk = require("@aws-sdk/client-ses");
  } catch (_error) {
    return null;
  }

  const hasStaticCredentials = Boolean(settings.ses_access_key_id && settings.ses_secret_access_key);
  const credentials = hasStaticCredentials
    ? {
        accessKeyId: settings.ses_access_key_id,
        secretAccessKey: settings.ses_secret_access_key,
        sessionToken: settings.ses_session_token || undefined
      }
    : undefined;

  const client = new sesSdk.SESClient({
    region: settings.ses_region,
    credentials,
    endpoint: settings.ses_endpoint || undefined
  });

  const body = buildSesBody({ text, html });
  if (!body.Text && !body.Html) {
    body.Text = { Data: "", Charset: "UTF-8" };
  }

  await client.send(
    new sesSdk.SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8"
        },
        Body: body
      }
    })
  );

  return { delivered: true, mode: "ses" };
}

async function sendEmail({ to, subject, text, html }) {
  const settings = getSettingsMap([
    "mail_provider",
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
    "smtp_from",
    "ses_region",
    "ses_access_key_id",
    "ses_secret_access_key",
    "ses_session_token",
    "ses_from",
    "ses_endpoint"
  ]);

  const provider = getEmailProvider(settings);
  const result = provider === "ses"
    ? await sendWithSes(settings, { to, subject, text, html })
    : await sendWithSmtp(settings, { to, subject, text, html });

  if (!result) {
    console.log("[email:dev-fallback]", { to, subject, text });
    return { delivered: false, mode: "dev-fallback" };
  }

  return result;
}

module.exports = {
  sendEmail
};

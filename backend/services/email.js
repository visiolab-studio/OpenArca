const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { getSettingsMap } = require("./settings");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeNewlines(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function renderTextContentHtml(text) {
  const normalized = normalizeNewlines(text).trim();
  if (!normalized) {
    return "";
  }
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px 0; line-height:1.65; color:#1f2937;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

let cachedDefaultLogoDataUri = null;

function getDefaultLogoDataUri() {
  if (cachedDefaultLogoDataUri !== null) {
    return cachedDefaultLogoDataUri;
  }

  try {
    const logoPath = path.resolve(__dirname, "../assets/logo-openarca.png");
    const buffer = fs.readFileSync(logoPath);
    cachedDefaultLogoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
    return cachedDefaultLogoDataUri;
  } catch (_error) {
    cachedDefaultLogoDataUri = "";
    return "";
  }
}

function getLogoUrl(settings, appUrl) {
  const hasCustomLogo = Boolean(String(settings.app_logo_filename || "").trim());
  if (hasCustomLogo) {
    const version = encodeURIComponent(String(settings.app_logo_updated_at || "").trim() || "1");
    return `${appUrl}/api/settings/logo?v=${version}`;
  }
  return getDefaultLogoDataUri();
}

function buildEmailHtml({ subject, text, html, settings, lang }) {
  const appName = String(settings.app_name || "OpenArca").trim() || "OpenArca";
  const appUrl = String(settings.app_url || "http://localhost:3330").replace(/\/$/, "");
  const logoUrl = getLogoUrl(settings, appUrl);
  const safeSubject = escapeHtml(subject || appName);
  const contentHtml = html || renderTextContentHtml(text);
  const footer = lang === "en"
    ? `This message was sent by the ${escapeHtml(appName)} system at <a href="${escapeHtml(appUrl)}" style="color:#6b7280;">${escapeHtml(appUrl)}</a>. You can manage notifications in your account settings.`
    : `Ta wiadomość została wysłana z systemu ${escapeHtml(appName)} pod adresem <a href="${escapeHtml(appUrl)}" style="color:#6b7280;">${escapeHtml(appUrl)}</a>. Powiadomieniami możesz zarządzać w ustawieniach konta.`;

  return `<!doctype html>
<html lang="${lang === "en" ? "en" : "pl"}">
  <body style="margin:0;padding:0;background:#eef1f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef1f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 60px 28px;text-align:center;">
                ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(appName)}" style="max-width:190px;width:100%;height:auto;display:inline-block;">` : `<div style="font-size:20px;font-weight:700;color:#111827;">${escapeHtml(appName)}</div>`}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px 28px;text-align:left;">
                <h1 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">${safeSubject}</h1>
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 26px 28px;border-top:1px solid #e5e7eb;text-align:left;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">${footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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

async function sendEmail({ to, subject, text, html, lang }) {
  const settings = getSettingsMap([
    "app_name",
    "app_url",
    "app_logo_filename",
    "app_logo_updated_at",
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
  const normalizedLang = lang === "en" ? "en" : "pl";
  const normalizedHtml = buildEmailHtml({
    subject,
    text,
    html,
    settings,
    lang: normalizedLang
  });

  const provider = getEmailProvider(settings);
  const result = provider === "ses"
    ? await sendWithSes(settings, { to, subject, text, html: normalizedHtml })
    : await sendWithSmtp(settings, { to, subject, text, html: normalizedHtml });

  if (!result) {
    console.log("[email:dev-fallback]", { to, subject, text });
    return { delivered: false, mode: "dev-fallback" };
  }

  return result;
}

module.exports = {
  sendEmail
};

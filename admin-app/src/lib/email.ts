import nodemailer from "nodemailer";

// Email delivery for login verification codes.
//
// Deliberately provider-agnostic plain SMTP so it works with non-Google
// providers (Brevo / Mailgun / 阿里云邮件推送 / 腾讯云 SES / 自建 SMTP 等) —
// some regions cannot reach Google services, so no Gmail-specific transport
// is used. Configure via env:
//
//   SMTP_HOST=smtp-relay.brevo.com
//   SMTP_PORT=587
//   SMTP_SECURE=false          # true for port 465
//   SMTP_USER=...
//   SMTP_PASS=...
//   EMAIL_FROM="OpenBible <no-reply@yourdomain.com>"
//
// When SMTP_HOST is unset (local dev), the code is printed to the server
// log instead of being emailed, and the login UI says so.

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendVerificationEmail(to: string, code: string) {
  if (!smtpConfigured()) {
    console.log(`[email:dev] 未配置 SMTP，验证码（${to}）：${code}`);
    return { delivered: false as const };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
    to,
    subject: "OpenBible 登录验证码",
    text: `您的 OpenBible 登录验证码是：${code}\n\n10 分钟内有效。如非本人操作，请忽略本邮件。`,
  });

  return { delivered: true as const };
}

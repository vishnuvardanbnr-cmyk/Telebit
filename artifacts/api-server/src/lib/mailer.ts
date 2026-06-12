import nodemailer from "nodemailer";
import { getSettings } from "./settings";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

async function buildTransport() {
  const s = await getSettings();
  if (!s.smtpEnabled || !s.smtpHost || !s.smtpUser || !s.smtpPass) return null;
  return {
    transport: nodemailer.createTransport({
      host: s.smtpHost,
      port: Number(s.smtpPort) || 587,
      secure: Number(s.smtpPort) === 465,
      auth: { user: s.smtpUser, pass: s.smtpPass },
    }),
    from: `"${s.smtpFromName || "Telebit Shop"}" <${s.smtpFromEmail || s.smtpUser}>`,
    settings: s,
  };
}

function wrap(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:520px;width:100%;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800;letter-spacing:1px;">Telebit Shop</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:12px;">Secure USDT Marketplace</p>
          </td>
        </tr>
        ${body}
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;">
            <p style="color:#aaa;font-size:11px;margin:0;text-align:center;">© ${new Date().getFullYear()} Telebit Shop. All rights reserved.<br>If you didn't expect this email, you can safely ignore it.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── OTP ───────────────────────────────────────────────────────────────────────

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "register" | "login" | "password_reset",
): Promise<void> {
  const ctx = await buildTransport();
  if (!ctx) throw new Error("Email service is not configured. Please contact support.");

  const label = purpose === "register" ? "Registration" : purpose === "login" ? "Sign-In" : "Password Reset";
  const action = purpose === "register" ? "complete your registration" : purpose === "login" ? "sign in" : "reset your password";

  await ctx.transport.sendMail({
    from: ctx.from,
    to,
    subject: `Telebit Shop — Your ${label} Verification Code`,
    html: wrap(`
      <tr><td style="padding:32px;">
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Hello,</p>
        <p style="color:#555;font-size:14px;margin:0 0 24px;">Use the code below to <strong>${action}</strong>. It expires in <strong>5 minutes</strong>.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="background:#f4f4f8;border:2px solid #4f46e5;border-radius:10px;padding:24px;">
            <span style="font-size:42px;font-weight:800;letter-spacing:12px;font-family:'Courier New',monospace;color:#4f46e5;">${code}</span>
          </td></tr>
        </table>
        <p style="color:#999;font-size:12px;margin:20px 0 0;text-align:center;">Never share this code with anyone. Telebit will never ask for it.</p>
      </td></tr>
    `),
  });
}

// ── Welcome ───────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const ctx = await buildTransport();
  if (!ctx || !ctx.settings.welcomeEmailEnabled) return;

  const safeName = escapeHtml(name);
  await ctx.transport.sendMail({
    from: ctx.from,
    to,
    subject: "Welcome to Telebit Shop!",
    html: wrap(`
      <tr><td style="padding:32px;">
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Hi ${safeName},</p>
        <p style="color:#555;font-size:14px;margin:0 0 24px;">Welcome to <strong style="color:#4f46e5;">Telebit Shop</strong>! Your account has been created successfully.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#f9f9ff;border:1px solid #e8e8ff;border-radius:10px;padding:24px;">
            <p style="color:#555;font-size:13px;margin:0 0 10px;font-weight:600;">Here's what you can do next:</p>
            <p style="color:#555;font-size:13px;margin:0 0 8px;">💰 &nbsp;Deposit USDT to your personal wallet address</p>
            <p style="color:#555;font-size:13px;margin:0 0 8px;">🛒 &nbsp;Browse our product catalog and place your first order</p>
            <p style="color:#555;font-size:13px;margin:0;">👥 &nbsp;Refer friends using your unique referral link</p>
          </td></tr>
        </table>
        <p style="color:#aaa;font-size:12px;margin:20px 0 0;text-align:center;">Log in to your dashboard to get started.</p>
      </td></tr>
    `),
  });
}

// ── Order Confirmation ────────────────────────────────────────────────────────

export async function sendOrderConfirmEmail(
  to: string,
  name: string,
  orderId: string,
  items: Array<{ productName: string; quantity: number; subtotal: string }>,
  total: string,
): Promise<void> {
  const ctx = await buildTransport();
  if (!ctx || !ctx.settings.orderConfirmEmailEnabled) return;

  const safeName = escapeHtml(name);
  const shortId = orderId.slice(0, 8).toUpperCase();

  const itemRows = items
    .map(
      (it) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px 0;color:#333;font-size:13px;">${escapeHtml(it.productName)}${it.quantity > 1 ? ` <span style="color:#999;">×${it.quantity}</span>` : ""}</td>
      <td style="padding:8px 0;color:#4f46e5;font-size:13px;font-weight:600;text-align:right;">${parseFloat(it.subtotal).toFixed(4)} USDT</td>
    </tr>`,
    )
    .join("");

  await ctx.transport.sendMail({
    from: ctx.from,
    to,
    subject: `Telebit Shop — Order #${shortId} Confirmed`,
    html: wrap(`
      <tr><td style="padding:32px;">
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Hi ${safeName},</p>
        <p style="color:#555;font-size:14px;margin:0 0 24px;">Thank you for your order! We've received it and it's being processed.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:20px;">
          <tr style="background:#f9f9ff;">
            <td style="padding:12px 16px;color:#4f46e5;font-size:12px;font-weight:700;letter-spacing:0.5px;">ORDER #${shortId}</td>
          </tr>
          <tr><td style="padding:12px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
              <tr>
                <td style="padding:10px 0 0;color:#333;font-size:14px;font-weight:700;border-top:2px solid #eee;">Total</td>
                <td style="padding:10px 0 0;color:#4f46e5;font-size:14px;font-weight:800;text-align:right;border-top:2px solid #eee;">${parseFloat(total).toFixed(4)} USDT</td>
              </tr>
            </table>
          </td></tr>
        </table>
        <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">Log in to track your order status.</p>
      </td></tr>
    `),
  });
}

// ── Deposit Credited ──────────────────────────────────────────────────────────

export async function sendDepositCreditEmail(
  to: string,
  name: string,
  amount: string,
): Promise<void> {
  const ctx = await buildTransport();
  if (!ctx || !ctx.settings.depositCreditEmailEnabled) return;

  const safeName = escapeHtml(name);
  const displayAmount = parseFloat(amount).toFixed(4);

  await ctx.transport.sendMail({
    from: ctx.from,
    to,
    subject: "Telebit Shop — Deposit Credited to Your Wallet",
    html: wrap(`
      <tr><td style="padding:32px;">
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Hi ${safeName},</p>
        <p style="color:#555;font-size:14px;margin:0 0 24px;">Your deposit has been confirmed and credited to your wallet!</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="background:#f9f9ff;border:1px solid #e8e8ff;border-radius:10px;padding:28px;">
            <div style="font-size:12px;color:#999;margin-bottom:6px;letter-spacing:1px;">AMOUNT CREDITED</div>
            <div style="font-size:38px;font-weight:800;color:#4f46e5;">+${displayAmount}</div>
            <div style="font-size:13px;color:#888;margin-top:4px;">USDT</div>
          </td></tr>
        </table>
        <p style="color:#aaa;font-size:12px;margin:20px 0 0;text-align:center;">Your balance is now available. Log in to shop now.</p>
      </td></tr>
    `),
  });
}

// ── Withdrawal Status ─────────────────────────────────────────────────────────

export async function sendWithdrawalStatusEmail(
  to: string,
  name: string,
  status: "approved" | "rejected",
  amount: string,
  note?: string | null,
): Promise<void> {
  const ctx = await buildTransport();
  if (!ctx || !ctx.settings.withdrawalStatusEmailEnabled) return;

  const safeName = escapeHtml(name);
  const displayAmount = parseFloat(amount).toFixed(4);
  const safeNote = note ? escapeHtml(note) : null;
  const isApproved = status === "approved";

  const statusBlock = isApproved
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;text-align:center;">
        <div style="font-size:12px;color:#16a34a;letter-spacing:1px;margin-bottom:6px;">WITHDRAWAL APPROVED</div>
        <div style="font-size:32px;font-weight:800;color:#16a34a;">${displayAmount} USDT</div>
      </div>`
    : `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:20px 24px;">
        <div style="font-size:12px;color:#dc2626;letter-spacing:1px;margin-bottom:6px;font-weight:700;">WITHDRAWAL REJECTED</div>
        <div style="font-size:28px;font-weight:800;color:#dc2626;">${displayAmount} USDT</div>
        ${safeNote ? `<p style="color:#888;font-size:13px;margin:12px 0 0;border-top:1px solid #fecaca;padding-top:10px;"><strong>Reason:</strong> ${safeNote}</p>` : ""}
      </div>`;

  const message = isApproved
    ? "Your withdrawal request has been approved and is being processed."
    : "Your withdrawal request could not be approved. Your balance has been refunded.";

  await ctx.transport.sendMail({
    from: ctx.from,
    to,
    subject: `Telebit Shop — Withdrawal ${isApproved ? "Approved" : "Rejected"}`,
    html: wrap(`
      <tr><td style="padding:32px;">
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Hi ${safeName},</p>
        <p style="color:#555;font-size:14px;margin:0 0 20px;">${message}</p>
        ${statusBlock}
        <p style="color:#aaa;font-size:12px;margin:20px 0 0;text-align:center;">Log in to view your transaction history.</p>
      </td></tr>
    `),
  });
}

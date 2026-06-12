import nodemailer from "nodemailer";
import { getSettings } from "./settings";

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "register" | "login",
): Promise<void> {
  const settings = await getSettings();

  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    throw new Error(
      "Email service is not configured. Please contact support.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort) || 587,
    secure: Number(settings.smtpPort) === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
  });

  const subject =
    purpose === "register"
      ? "Verify your email — Telebit Shop"
      : "Your sign-in code — Telebit Shop";

  const action =
    purpose === "register" ? "complete your registration" : "sign in";

  const fromName = settings.smtpFromName || "Telebit Shop";
  const fromEmail = settings.smtpFromEmail || settings.smtpUser;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fff;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 28px;">
          <div style="background: #4f46e5; border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-weight: 800; font-size: 18px;">T</span>
          </div>
          <span style="font-weight: 700; font-size: 18px; color: #111;">Telebit Shop</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px;">Verification Code</h2>
        <p style="color: #666; font-size: 14px; margin: 0 0 24px;">Use the code below to ${action}. It expires in <strong>5 minutes</strong>.</p>
        <div style="background: #f4f4f8; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 40px; font-weight: 800; letter-spacing: 10px; font-family: 'Courier New', monospace; color: #111;">${code}</span>
        </div>
        <p style="color: #999; font-size: 12px; margin: 0;">Never share this code with anyone. Telebit will never ask for it.</p>
      </div>
    `,
  });
}

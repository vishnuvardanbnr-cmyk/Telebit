import app from "./app";
import { logger } from "./lib/logger";
import { getSettings } from "./lib/settings";
import { setTelegramWebhook } from "./lib/telegram-bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Auto-register Telegram webhook using REPLIT_DOMAINS
  const rawDomains = process.env.REPLIT_DOMAINS;
  const domain = rawDomains?.split(",")[0]?.trim();
  if (domain) {
    const webhookUrl = `https://${domain}/api/auth/bot-webhook`;
    setTimeout(async () => {
      try {
        const settings = await getSettings();
        if (settings.telegramBotToken) {
          await setTelegramWebhook(settings.telegramBotToken, webhookUrl);
          logger.info({ webhookUrl }, "Telegram webhook auto-registered");
        }
      } catch (err) {
        logger.warn({ err }, "Telegram webhook auto-registration failed (non-fatal)");
      }
    }, 5_000);
  }
});

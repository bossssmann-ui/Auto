import { Telegraf } from "telegraf";
import "dotenv/config";

const token = process.env.AI_BOT_TOKEN;
if (!token) {
  console.error("❌ AI_BOT_TOKEN is not set in environment variables.");
  process.exit(1);
}

const bot = new Telegraf(token);

// /start command — greets the user
bot.start((ctx) => {
  const name = ctx.from?.first_name ?? "друг";
  ctx.reply(
    `Привет, ${name}! 👋\n\n` +
      "Я — AI-менеджер на стадии обучения. " +
      "Скоро я смогу отвечать на ваши вопросы с помощью искусственного интеллекта.\n\n" +
      "А пока — просто напишите мне что-нибудь, и я повторю ваше сообщение. 🤖",
  );
});

// Text message handler — echo placeholder for future AI integration
bot.on("text", (ctx) => {
  const userText = ctx.message.text;
  ctx.reply(`Вы написали: ${userText}`);
});

// Global error handler — log and continue
bot.catch((err, ctx) => {
  console.error(`❌ Ошибка при обработке апдейта ${ctx.update.update_id}:`, err);
});

// Launch the bot
bot.launch().then(() => {
  console.log("🤖 Бот запущен и слушает сообщения...");
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

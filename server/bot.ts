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
  ctx.reply(
    "Привет! Я ИИ-менеджер СпецТехМаш. Сейчас я прохожу обучение, " +
      "но скоро смогу проконсультировать вас по любым вопросам импорта авто и спецтехники.",
  );
});

// /help command — placeholder
bot.help((ctx) => {
  ctx.reply(
    "Доступные команды:\n" +
      "/start — начать диалог\n" +
      "/help — показать справку\n\n" +
      "Просто напишите ваш вопрос, и я постараюсь помочь!",
  );
});

// Text message handler — echo placeholder for future AI integration
bot.on("text", (ctx) => {
  const userText = ctx.message.text;
  ctx.reply(
    `Я получил ваше сообщение: ${userText}. (Здесь скоро будет ответ от нейросети)`,
  );
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

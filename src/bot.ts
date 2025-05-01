import dotenv from "dotenv";
import express from "express";
import { Telegraf } from "telegraf";
import bodyParser from "body-parser";
import { commands } from "./user-commands.js";
import { initCommands } from "./initCommands.js";

// Load environment variables
dotenv.config();

const botToken = process.env["BOT_TOKEN"];
if (!botToken) throw new Error("BOT_TOKEN не задан в .env файле!");

// Initialize the bot
const bot = new Telegraf(botToken);

// Initialize all commands
initCommands(bot);

// Setup Express server
const app = express();
app.use(bodyParser.json());

app.get("/", (_, res) => res.send("✅ Сервер працює!"));

const PORT = process.env["PORT"] || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Express сервер працює на http://localhost:${PORT}`);
});

// Start the bot
bot.telegram.setMyCommands(commands);

bot
  .launch()
  .then(() => {
    console.log("🤖 Бот запущений!");
  })
  .catch((err) => {
    console.error("❌ Помилка запуску бота:", err);
  });

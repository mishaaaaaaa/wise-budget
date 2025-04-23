import dotenv from "dotenv";
import express from "express";
import { Telegraf } from "telegraf";
import bodyParser from "body-parser";
import fetch from "node-fetch";
// import { getXataClient } from "./xata.js";
import { xataClient } from "./xataClient.js";
import { MonobankClientInfo } from "./types.js";

// ✅ XataClient wrapper implemented

dotenv.config();

const botToken = process.env["BOT_TOKEN"];
if (!botToken) throw new Error("BOT_TOKEN не задан в .env файле!");

const bot = new Telegraf(botToken);

// 📌 /start
bot.start((ctx) => {
  ctx.reply(
    "Привіт! Я бот для контролю бюджету Monobank. Введи /connect, щоб розпочати."
  );
});

// 📌 /connect
bot.command("connect", async (ctx) => {
  await ctx.reply(
    "Введи, будь ласка, свій токен Monobank: https://api.monobank.ua/"
  );
});

// 📌 /me — получить информацию о клиенте Monobank
bot.command("me", async (ctx) => {
  const userId = ctx.from.id;
  const client = xataClient();

  const user = await client.getUserByTelegramId(userId);

  if (!user) {
    return ctx.reply("❗ Спершу підключи токен через /connect");
  }

  const token = user.monobank_token;

  try {
    const response = await fetch(
      "https://api.monobank.ua/personal/client-info",
      {
        headers: { "X-Token": token },
      }
    );

    if (!response.ok) {
      return ctx.reply("❌ Не вдалося отримати дані клієнта.");
    }

    const data = (await response.json()) as MonobankClientInfo;
    const name = data.name || user.monobank_name || "Клієнт";
    const info = data.accounts
      .map((acc) => {
        const balance = (acc.balance / 100).toFixed(2);
        const currency = acc.currencyCode;
        return `• Баланс: ${balance} (валюта ${currency})`;
      })
      .join("\n");

    return ctx.reply(`👤 Ім'я: ${name}\n${info}`);
  } catch (err) {
    console.error(err);
    return ctx.reply("❌ Сталася помилка при отриманні інформації.");
  }
});

// 📩 Обработка текстовых сообщений (токен)
bot.on("text", async (ctx) => {
  const token = ctx.message.text.trim();

  try {
    const response = await fetch(
      "https://api.monobank.ua/personal/client-info",
      {
        headers: { "X-Token": token },
      }
    );

    if (!response.ok) throw new Error("Невірний токен");

    const data = (await response.json()) as MonobankClientInfo;
    const name = data.name || "Клієнт";

    await ctx.reply(`✅ Вітаю, ${name}! Токен дійсний.`);

    // Using the new XataClient wrapper with proper type handling
    const client = xataClient();
    await client.saveOrUpdateUser({
      telegramId: ctx.from.id,
      username: ctx.from.username || "",
      firstName: ctx.from.first_name || "",
      lastName: ctx.from.last_name || "",
      languageCode: ctx.from.language_code || "",
      isPremium: ctx.from.is_premium === true,
      monobankToken: token,
      monobankName: name,
    });
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Помилка! Токен неправильний або сервер недоступний.");
  }
});

// 🚀 Express-сервер
const app = express();
app.use(bodyParser.json());

app.get("/", (_, res) => res.send("✅ Сервер працює!"));

const PORT = process.env["PORT"] || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Express сервер працює на http://localhost:${PORT}`);
});

// 🤖 Запуск бота
bot
  .launch()
  .then(() => {
    console.log("🤖 Бот запущений!");
  })
  .catch((err) => {
    console.error("❌ Помилка запуску бота:", err);
  });

import dotenv from "dotenv";
import express from "express";
import { Telegraf } from "telegraf";
import bodyParser from "body-parser";
import fetch from "node-fetch"; // если используешь node-fetch
import { supabase } from "./supabase.js";

dotenv.config();

// 🔐 Проверяем наличие токена бота
const botToken = process.env["BOT_TOKEN"];
if (!botToken) throw new Error("BOT_TOKEN не задан в .env файле!");

const bot = new Telegraf(botToken);

// 📌 Команда /start
bot.start((ctx) => {
  ctx.reply(
    "Привіт! Я бот для контролю бюджету Monobank. Введи /connect, щоб розпочати."
  );
});

// 📌 Команда /connect
bot.command("connect", async (ctx) => {
  await ctx.reply(
    "Введи, будь ласка, свій токен Monobank: https://api.monobank.ua/"
  );
});

bot.command("me", async (ctx) => {
  const userId = ctx.from.id;

  const { data: user, error } = await supabase
    .from("users")
    .select("monobank_token, monobank_name")
    .eq("telegram_id", userId)
    .single();

  if (error || !user) {
    console.error("❌ Не знайдено користувача:", error);
    return ctx.reply("❗ Спершу підключи токен через /connect");
  }

  const token = user.monobank_token;

  try {
    const response = await fetch(
      "https://api.monobank.ua/personal/client-info",
      {
        headers: {
          "X-Token": token,
        },
      }
    );

    if (!response.ok) {
      return ctx.reply("❌ Не вдалося отримати дані клієнта.");
    }

    const data: any = await response.json();

    console.log(data);

    const name = data.name || user.monobank_name || "Клієнт";
    const info = data.accounts
      .map((acc: any) => {
        const balance = (acc.balance / 100).toFixed(2);
        const currency = acc.currencyCode;
        return `• Баланс: ${balance} (валюта ${currency})`;
      })
      .join("\n");

    return ctx.reply(`👤 Ім’я: ${name}\n${info}`);
  } catch (err) {
    console.error(err);
    return ctx.reply("❌ Сталася помилка при отриманні інформації.");
  }
});

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

    const data: any = await response.json();
    const name = data.name || "Клієнт";

    await ctx.reply(`✅ Вітаю, ${name}! Токен дійсний.`);

    // 📦 Сохраняем пользователя в Supabase
    const { error } = await supabase.from("users").upsert(
      [
        {
          telegram_id: ctx.from.id,
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          language_code: ctx.from.language_code,
          is_premium: ctx.from.is_premium ?? false,
          monobank_token: token,
          monobank_name: name,
          updated_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "telegram_id", // обновляет, если уже есть
      }
    );

    if (error) {
      console.error("❌ Помилка при збереженні користувача:", error);
    }
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Помилка! Токен неправильний або сервер недоступний.");
  }
});

const app = express();
app.use(bodyParser.json());

app.get("/", (_, res) => res.send("✅ Сервер працює!"));

const PORT = process.env["PORT"] || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Express сервер працює на http://localhost:${PORT}`);
});

// 🤖 Затем запускаем Telegram бота
bot
  .launch()
  .then(() => {
    console.log("🤖 Бот запущений!");
  })
  .catch((err) => {
    console.error("❌ Помилка запуску бота:", err);
  });

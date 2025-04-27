import dotenv from "dotenv";
import express from "express";
import { Telegraf } from "telegraf";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { xataClient } from "./xataClient.js";
import { MonobankClientInfo } from "./types.js";
import { commands } from "./commands.js";

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

// 📩 Обработка текстовых сообщений (токен или выбор аккаунта)
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const client = xataClient();
  const user = await client.getUserByTelegramId(userId);

  // Check if user is in account selection mode
  if (user && user.awaiting_account_selection === true) {
    // Handle account selection logic
    try {
      const userInput = ctx.message.text.trim();
      console.log(`User selected account: "${userInput}"`);

      // Parse the input as a number (1-based index)
      const selectedNumber = parseInt(userInput, 10);

      if (isNaN(selectedNumber)) {
        await ctx.reply("❌ Будь ласка, введіть число для вибору рахунку.");
        return;
      }

      // Convert to 0-based index for array
      const selectedIndex = selectedNumber - 1;
      console.log(`Parsed index: ${selectedIndex}`);

      // Get accounts info again to validate the selection
      const response = await fetch(
        "https://api.monobank.ua/personal/client-info",
        {
          headers: { "X-Token": user.monobank_token || "" },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get accounts");
      }

      const data = (await response.json()) as MonobankClientInfo;
      console.log(`Total accounts available: ${data.accounts.length}`);

      // Validate selection is within range
      if (selectedIndex < 0 || selectedIndex >= data.accounts.length) {
        await ctx.reply(
          `❌ Невірний номер рахунку. Оберіть номер від 1 до ${data.accounts.length}.`
        );
        return;
      }

      const selectedAccount = data.accounts[selectedIndex];

      if (!selectedAccount) {
        await ctx.reply(`❌ Неправильно обраний рахунок.`);
        return;
      }

      console.log(`Selected account ID: ${selectedAccount.id}`);
      console.log(`Selected account currency: ${selectedAccount.currencyCode}`);
      console.log(`Selected account balance: ${selectedAccount.balance}`);

      // TypeScript safety - make sure selectedAccount exists
      if (!selectedAccount) {
        await ctx.reply("❌ Помилка при виборі рахунку. Спробуйте знову.");
        return;
      }

      // Update the user's main account ID
      await client.updateUserAccountSelection({
        telegramId: userId,
        mainAccountId: selectedAccount.id,
        awaitingSelection: false,
      });

      // Confirm selection
      const balance = (selectedAccount.balance / 100).toFixed(2);
      const currency =
        selectedAccount.currencyCode === 980
          ? "грн"
          : `код валюти ${selectedAccount.currencyCode}`;
      const cardInfo =
        selectedAccount.maskedPan && selectedAccount.maskedPan.length > 0
          ? ` (${selectedAccount.maskedPan[0]})`
          : "";

      await ctx.reply(
        `✅ Рахунок #${selectedNumber} успішно обрано як основний!\n` +
          `💳 Баланс: ${balance} ${currency}${cardInfo}\n\n` +
          `Тепер ви можете керувати своїм бюджетом за допомогою команд:\n` +
          `/me - переглянути інформацію про рахунки`
      );
    } catch (error) {
      console.error("Account selection error:", error);
      await ctx.reply(
        "❌ Помилка при виборі рахунку. Спробуйте знову або введіть /connect для перепідключення."
      );
    }
    return;
  }

  // Original token processing code
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
    await client.saveOrUpdateUser({
      telegramId: ctx.from.id,
      username: ctx.from.username || "",
      firstName: ctx.from.first_name || "",
      lastName: ctx.from.last_name || "",
      languageCode: ctx.from.language_code || "",
      isPremium: ctx.from.is_premium === true,
      monobankToken: token,
      monobankName: name,
      awaitingAccountSelection: true, // Set flag for account selection mode
    });

    // Show accounts for selection
    if (data.accounts && data.accounts.length > 0) {
      const accountsList = data.accounts
        .map((acc, index) => {
          const balance = (acc.balance / 100).toFixed(2);
          const currency =
            acc.currencyCode === 980 ? "грн" : `код валюти ${acc.currencyCode}`;
          const cardInfo =
            acc.maskedPan && acc.maskedPan.length > 0
              ? ` (${acc.maskedPan[0]})`
              : "";
          return `${index + 1}. Баланс: ${balance} ${currency}${cardInfo}`;
        })
        .join("\n");

      await ctx.reply(
        `Оберіть, будь ласка, основний рахунок, відправивши його номер:\n\n${accountsList}\n\n` +
          `Для вибору надішліть номер рахунку (1-${data.accounts.length})`
      );
    } else {
      await ctx.reply("❌ Не знайдено жодного рахунку у вашому Monobank.");
    }
  } catch (error) {
    console.error(error);
    await ctx.reply("❌ Помилка! Токен неправильний або сервер недоступний.");
  }
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

    // Check if the user has a main account selected
    let mainAccountInfo = "";
    if (user.main_account_id) {
      const mainAccount = data.accounts.find(
        (acc) => acc.id === user.main_account_id
      );
      if (mainAccount) {
        const balance = (mainAccount.balance / 100).toFixed(2);
        const currency =
          mainAccount.currencyCode === 980
            ? "грн"
            : `код валюти ${mainAccount.currencyCode}`;
        mainAccountInfo = `\n💰 Основний рахунок: ${balance} ${currency}`;

        if (mainAccount.maskedPan && mainAccount.maskedPan.length > 0) {
          mainAccountInfo += ` (${mainAccount.maskedPan[0]})`;
        }
      }
    }

    const info = data.accounts
      .map((acc, index) => {
        const balance = (acc.balance / 100).toFixed(2);
        const currency =
          acc.currencyCode === 980 ? "грн" : `код валюти ${acc.currencyCode}`;
        const isMain = acc.id === user.main_account_id ? " [ОСНОВНИЙ]" : "";
        const cardNumber =
          acc.maskedPan && acc.maskedPan.length > 0
            ? ` (${acc.maskedPan[0]})`
            : "";
        return `${
          index + 1
        }. Баланс: ${balance} ${currency}${cardNumber}${isMain}`;
      })
      .join("\n");

    return ctx.reply(`👤 Ім'я: ${name}${mainAccountInfo}\n\nРахунки:\n${info}`);
  } catch (err) {
    console.error(err);
    return ctx.reply("❌ Сталася помилка при отриманні інформації.");
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

bot.telegram.setMyCommands(commands);

bot
  .launch()
  .then(() => {
    console.log("🤖 Бот запущений!");
  })
  .catch((err) => {
    console.error("❌ Помилка запуску бота:", err);
  });

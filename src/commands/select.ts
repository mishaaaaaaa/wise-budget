// src/commands/select.ts
import { Telegraf } from "telegraf";
import fetch from "node-fetch";
import { xataClient } from "../xataClient.js";
import { MonobankClientInfo } from "../types.js";

export const select = (bot: Telegraf) => {
  bot.command("select", async (ctx) => {
    const userId = ctx.from.id;
    const client = xataClient();
    const user = await client.getUserByTelegramId(userId);

    if (!user) {
      return ctx.reply("❗ Спершу підключи токен через /connect");
    }

    if (!user.monobank_token) {
      return ctx.reply(
        "❗ Токен Monobank не знайдено. Використайте /connect для підключення."
      );
    }

    try {
      // Get accounts from Monobank
      const response = await fetch(
        "https://api.monobank.ua/personal/client-info",
        {
          headers: { "X-Token": user.monobank_token },
        }
      );

      if (!response.ok) {
        return ctx.reply(
          "❌ Не вдалося отримати дані клієнта. Можливо, токен недійсний."
        );
      }

      const data = (await response.json()) as MonobankClientInfo;

      // Show accounts for selection
      if (data.accounts && data.accounts.length > 0) {
        // Update user to awaiting account selection mode
        await client.updateUserAccountSelection({
          telegramId: userId,
          mainAccountId: user.main_account_id || "",
          awaitingSelection: true,
        });

        const accountsList = data.accounts
          .map((acc, index) => {
            const balance = (acc.balance / 100).toFixed(2);
            const currency =
              acc.currencyCode === 980
                ? "грн"
                : `код валюти ${acc.currencyCode}`;
            const isMain = acc.id === user.main_account_id ? " [ПОТОЧНИЙ]" : "";
            const cardInfo =
              acc.maskedPan && acc.maskedPan.length > 0
                ? ` (${acc.maskedPan[0]})`
                : "";
            return `${
              index + 1
            }. Баланс: ${balance} ${currency}${cardInfo}${isMain}`;
          })
          .join("\n");

        await ctx.reply(
          `Оберіть, будь ласка, основний рахунок, відправивши його номер:\n\n${accountsList}\n\n` +
            `Для вибору надішліть номер рахунку (1-${data.accounts.length})`
        );
      } else {
        await ctx.reply("❌ Не знайдено жодного рахунку у вашому Monobank.");
        return;
      }
      return;
    } catch (error) {
      console.error("Error in /select command:", error);
      await ctx.reply(
        "❌ Помилка при отриманні списку рахунків. Спробуйте знову пізніше."
      );
      return;
    }
  });
};

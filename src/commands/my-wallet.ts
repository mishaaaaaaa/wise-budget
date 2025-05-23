// src/commands/myWallet.ts
import { Telegraf } from "telegraf";
import fetch from "node-fetch";
import { getUserClient } from "../user-instance.js";
import { MonobankClientInfo } from "../types.js";
import { transformUserBalanceInfo } from "../utils.js";

export const myWallet = (bot: Telegraf) => {
  bot.command("me", async (ctx) => {
    const userId = ctx.from.id;
    const client = getUserClient(userId);
    const user = await client.getCurrentUser();

    if (!user) {
      return ctx.reply("❗ Спершу підключи токен через /connect");
    }

    const token = user.monobank_token;

    try {
      const response = await fetch("https://api.monobank.ua/personal/client-info", {
        headers: { "X-Token": token },
      });

      console.log(response);

      if (!response.ok) {
        return ctx.reply("❌ Не вдалося отримати дані клієнта.");
      }

      const data = (await response.json()) as MonobankClientInfo;
      const name = data.name || user.monobank_name || "Клієнт";

      // Check if the user has a main account selected
      let mainAccountInfo = "";
      if (user.main_account_id) {
        const mainAccount = data.accounts.find((acc) => acc.id === user.main_account_id);
        if (mainAccount) {
          const balance = (mainAccount.balance / 100).toFixed(2);
          const currency = mainAccount.currencyCode === 980 ? "грн" : `код валюти ${mainAccount.currencyCode}`;
          mainAccountInfo = `\n💰 Основний рахунок: ${balance} ${currency}`;

          if (mainAccount.maskedPan && mainAccount.maskedPan.length > 0) {
            mainAccountInfo += ` (${mainAccount.maskedPan[0]})`;
          }
        }
      }

      const info = transformUserBalanceInfo(data.accounts, user);

      return ctx.reply(`👤 Ім'я: ${name}${mainAccountInfo}\n\nРахунки:\n${info}`);
    } catch (err) {
      console.error(err);
      return ctx.reply("❌ Сталася помилка при отриманні інформації.");
    }
  });
};

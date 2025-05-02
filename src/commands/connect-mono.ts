// src/commands/connectMono.ts
import { Telegraf } from "telegraf";

export const connectMono = (bot: Telegraf) => {
  bot.command("connect", async (ctx) => {
    await ctx.reply(
      "Введи, будь ласка, свій токен Monobank: https://api.monobank.ua/"
    );
  });
};

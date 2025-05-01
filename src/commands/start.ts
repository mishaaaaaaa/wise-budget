// src/commands/start.ts
import { Telegraf } from "telegraf";

export const start = (bot: Telegraf) => {
  bot.start((ctx) => {
    ctx.reply(
      "Привіт! Я бот для контролю бюджету Monobank. Введи /connect, щоб розпочати."
    );
  });
};

// src/commands/debug.ts
import { Telegraf } from "telegraf";
import { debugUserInstances } from "../user-instance.js";

export const debug = (bot: Telegraf) => {
  bot.command("debug", async (ctx) => {
    // Only allow for admin user(s)
    // const adminIds = [123456789]; // Replace with your actual Telegram ID
    // if (!adminIds.includes(ctx.from.id)) {
    //   return ctx.reply("❌ This command is only available to administrators.");
    // }

    const instancesInfo = debugUserInstances();
    await ctx.reply(`🔍 User Instances Debug Info:\n\n${instancesInfo}`);
    return;
  });
};

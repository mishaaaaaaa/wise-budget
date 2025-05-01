// src/initCommands.ts
import { Telegraf } from "telegraf";
import { start } from "./commands/start.js";
import { connectMono } from "./commands/connectMono.js";
import { select } from "./commands/select.js";
import { myWallet } from "./commands/myWallet.js";
import { inputHandler } from "./commands/inputHandler.js";

export const initCommands = (bot: Telegraf) => {
  // Register all command handlers
  start(bot);
  connectMono(bot);
  select(bot);
  myWallet(bot);
  inputHandler(bot);

  console.log("🔄 All commands registered successfully!");
};

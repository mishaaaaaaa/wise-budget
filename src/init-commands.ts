// src/initCommands.ts
import { Telegraf } from "telegraf";
import { start } from "./commands/start.js";
import { connectMono } from "./commands/connect-mono.js";
import { select } from "./commands/reselect-account.js";
import { myWallet } from "./commands/my-wallet.js";
import { inputHandler } from "./commands/input-handler.js";
import { debug } from "./commands/debug.js";

export const initCommands = (bot: Telegraf) => {
  // Register all command handlers
  start(bot);
  connectMono(bot);
  select(bot);
  myWallet(bot);
  debug(bot); // Added the debug command
  inputHandler(bot);

  console.log("🔄 All commands registered successfully!");
};

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { User as TelegramUser } from "telegraf/types";

dotenv.config();

const supabase = createClient(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_KEY"]!
);

export { supabase };

export const createUser = async (
  tgUser: TelegramUser,
  monobankToken: string,
  monobankName: string
) => {
  const { error } = await supabase.from("users").upsert(
    [
      {
        telegram_id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        language_code: tgUser.language_code,
        is_premium: tgUser.is_premium ?? false,
        monobank_token: monobankToken,
        monobank_name: monobankName,
        updated_at: new Date().toISOString(),
      },
    ],
    {
      onConflict: "telegram_id", // чтобы обновляло по этому полю
    }
  );

  if (error) {
    console.error("❌ Помилка при збереженні користувача:", error);
  }
};

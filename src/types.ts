export interface User {
  id: string; // UUID
  telegram_id: number;
  first_name: string | null;
  monobank_token: string;
  monobank_name: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

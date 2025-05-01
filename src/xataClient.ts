import dotenv from "dotenv";
dotenv.config();

import { getXataClient, UsersRecord } from "./xata.js";

/**
 * Wrapper for XataClient to provide centralized database operations
 * and error handling for the budget bot application
 */
export class XataClientWrapper {
  private client = getXataClient();

  /**
   * Get a user by their Telegram ID
   */
  async getUserByTelegramId(telegramId: number): Promise<UsersRecord | null> {
    try {
      const result = await this.client.db.users
        .filter({ telegram_id: telegramId })
        .getFirst();
      return result as UsersRecord | null;
    } catch (error) {
      console.error(`Error fetching user by Telegram ID ${telegramId}:`, error);
      return null;
    }
  }

  /**
   * Create a new user or update an existing one
   */
  async saveOrUpdateUser(userData: {
    telegramId: number;
    username: string | undefined;
    firstName: string | undefined;
    lastName: string | undefined;
    languageCode: string | undefined;
    isPremium: boolean | undefined;
    monobankToken: string | undefined;
    monobankName: string | undefined;
    awaitingAccountSelection?: boolean;
  }): Promise<UsersRecord | null> {
    try {
      const existingUser = await this.getUserByTelegramId(userData.telegramId);

      if (existingUser) {
        // Update existing user
        const result = await this.client.db.users.update(existingUser.xata_id, {
          username: userData.username || undefined,
          user_name:
            userData.firstName && userData.lastName
              ? `${userData.firstName} ${userData.lastName}`
              : userData.firstName ||
                userData.lastName ||
                existingUser.user_name,
          language_code: userData.languageCode || existingUser.language_code,
          is_premium: userData.isPremium ?? existingUser.is_premium,
          monobank_token: userData.monobankToken || existingUser.monobank_token,
          monobank_name: userData.monobankName || existingUser.monobank_name,
          awaiting_account_selection:
            userData.awaitingAccountSelection !== undefined
              ? userData.awaitingAccountSelection
              : existingUser.awaiting_account_selection,
        });
        return result as UsersRecord | null;
      } else {
        // Create new user
        const result = await this.client.db.users.create({
          telegram_id: userData.telegramId,
          username: userData.username || "",
          user_name:
            userData.firstName && userData.lastName
              ? `${userData.firstName} ${userData.lastName}`
              : userData.firstName || userData.lastName || "",
          language_code: userData.languageCode || "",
          is_premium: userData.isPremium ?? false,
          monobank_token: userData.monobankToken || "",
          monobank_name: userData.monobankName || "",
          main_account_id: "", // Default empty until selected
          awaiting_account_selection:
            userData.awaitingAccountSelection ?? false,
        });
        return result as UsersRecord | null;
      }
    } catch (error) {
      console.error(
        `Error saving user data for Telegram ID ${userData.telegramId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Update user's Monobank token and name
   */
  async updateMonobankInfo(
    telegramId: number,
    token: string,
    name: string
  ): Promise<UsersRecord | null> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return null;
      }

      const result = await this.client.db.users.update(user.xata_id, {
        monobank_token: token,
        monobank_name: name,
      });
      return result as UsersRecord | null;
    } catch (error) {
      console.error(
        `Error updating Monobank info for user ${telegramId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Update user's main account ID and selection status
   */
  async updateUserAccountSelection(data: {
    telegramId: number;
    mainAccountId: string;
    awaitingSelection: boolean;
  }): Promise<UsersRecord | null> {
    try {
      const user = await this.getUserByTelegramId(data.telegramId);
      if (!user) {
        return null;
      }

      const result = await this.client.db.users.update(user.xata_id, {
        main_account_id: data.mainAccountId,
        awaiting_account_selection: data.awaitingSelection,
      });
      return result as UsersRecord | null;
    } catch (error) {
      console.error(
        `Error updating account selection for user ${data.telegramId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Update user's main account ID
   */
  async updateMainAccountId(
    telegramId: number,
    accountId: string
  ): Promise<UsersRecord | null> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return null;
      }

      const result = await this.client.db.users.update(user.xata_id, {
        main_account_id: accountId,
      });
      return result as UsersRecord | null;
    } catch (error) {
      console.error(
        `Error updating main account ID for user ${telegramId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Check if user exists and has valid Monobank token
   */
  async hasValidMonobankToken(telegramId: number): Promise<boolean> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      return !!user && !!user.monobank_token && user.monobank_token.length > 0;
    } catch (error) {
      console.error(
        `Error checking Monobank token for user ${telegramId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get all users with Monobank tokens
   */
  async getUsersWithMonobankTokens(): Promise<UsersRecord[]> {
    try {
      // Using a different approach that works with Xata's API
      const results = await this.client.db.users
        .filter({ monobank_token: { $contains: "." } }) // Any token will contain a dot
        .getAll();
      return results as unknown as UsersRecord[];
    } catch (error) {
      console.error("Error fetching users with Monobank tokens:", error);
      return [];
    }
  }

  async getUpdateUserState() {
    try {
    } catch (error) {}
  }
}

// Singleton pattern for XataClientWrapper
let instance: XataClientWrapper | undefined = undefined;

export const xataClient = (): XataClientWrapper => {
  if (!instance) {
    instance = new XataClientWrapper();
  }
  return instance;
};

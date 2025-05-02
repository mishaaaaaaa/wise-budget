import dotenv from "dotenv";
dotenv.config();

import { getXataClient, UsersRecord } from "./xata.js";

type UserData = {
  telegramId: number;
  username: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  languageCode: string | undefined;
  isPremium: boolean | undefined;
  monobankToken: string | undefined;
  monobankName: string | undefined;
  awaitingAccountSelection?: boolean;
};

export class UserInstance {
  private client = getXataClient();

  private readonly telegramId: number | null;
  private cachedUser: UsersRecord | null = null;

  constructor(telegramId?: number) {
    this.telegramId = telegramId ?? null;
  }

  async getCurrentUser(): Promise<UsersRecord | null> {
    if (this.telegramId === null) {
      return null;
    }

    if (this.cachedUser) {
      return this.cachedUser;
    }

    this.cachedUser = await this.getUserByTelegramId(this.telegramId);
    return this.cachedUser;
  }

  invalidateCache(): void {
    this.cachedUser = null;
  }

  async getUserByTelegramId(telegramId: number): Promise<UsersRecord | null> {
    console.log("User request to db");
    try {
      const result = await this.client.db.users.filter({ telegram_id: telegramId }).getFirst();
      return result as UsersRecord | null;
    } catch (error) {
      console.error(`Error fetching user by Telegram ID ${telegramId}:`, error);
      return null;
    }
  }

  async saveOrUpdateUser(userData: UserData): Promise<UsersRecord | null> {
    try {
      // If this is for the current user, try to use the cached record
      const existingUser = this.telegramId === userData.telegramId && this.cachedUser ? this.cachedUser : await this.getUserByTelegramId(userData.telegramId);

      if (existingUser) {
        // Update existing user
        const result = await this.client.db.users.update(existingUser.xata_id, {
          username: userData.username || undefined,
          user_name:
            userData.firstName && userData.lastName
              ? `${userData.firstName} ${userData.lastName}`
              : userData.firstName || userData.lastName || existingUser.user_name,
          language_code: userData.languageCode || existingUser.language_code,
          is_premium: userData.isPremium ?? existingUser.is_premium,
          monobank_token: userData.monobankToken || existingUser.monobank_token,
          monobank_name: userData.monobankName || existingUser.monobank_name,
          awaiting_account_selection:
            userData.awaitingAccountSelection !== undefined ? userData.awaitingAccountSelection : existingUser.awaiting_account_selection,
        });

        // Update cache if this is the current user
        if (this.telegramId === userData.telegramId) {
          this.cachedUser = result as UsersRecord;
        }

        return result as UsersRecord | null;
      } else {
        // Create new user - generate a new user_id
        const lastUser = await this.client.db.users.select(["user_id"]).sort("user_id", "desc").getFirst();
        const nextUserId = (lastUser?.user_id || 0) + 1;

        // Create new user with the generated user_id
        const result = await this.client.db.users.create({
          user_id: nextUserId,
          telegram_id: userData.telegramId,
          username: userData.username || "",
          user_name: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.firstName || userData.lastName || "",
          language_code: userData.languageCode || "",
          is_premium: userData.isPremium ?? false,
          monobank_token: userData.monobankToken || "",
          monobank_name: userData.monobankName || "",
          main_account_id: "", // Default empty until selected
          awaiting_account_selection: userData.awaitingAccountSelection ?? false,
        });

        // Update cache if this is the current user
        if (this.telegramId === userData.telegramId) {
          this.cachedUser = result as UsersRecord;
        }

        return result as UsersRecord | null;
      }
    } catch (error) {
      console.error(`Error saving user data for Telegram ID ${userData.telegramId}:`, error);
      return null;
    }
  }

  async updateMonobankInfo(token: string, name: string): Promise<UsersRecord | null> {
    try {
      if (!this.cachedUser) {
        this.cachedUser = await this.getCurrentUser();
      }

      if (!this.cachedUser) {
        return null;
      }

      const result = await this.client.db.users.update(this.cachedUser.xata_id, {
        monobank_token: token,
        monobank_name: name,
      });

      // Update cache
      this.cachedUser = result as UsersRecord;

      return result as UsersRecord | null;
    } catch (error) {
      console.error(`Error updating Monobank info for user:`, error);
      return null;
    }
  }

  async updateUserAccountSelection(data: { mainAccountId: string; awaitingSelection: boolean }): Promise<UsersRecord | null> {
    try {
      if (!this.cachedUser) {
        this.cachedUser = await this.getCurrentUser();
      }

      if (!this.cachedUser) {
        return null;
      }

      const result = await this.client.db.users.update(this.cachedUser.xata_id, {
        main_account_id: data.mainAccountId,
        awaiting_account_selection: data.awaitingSelection,
      });

      // Update cache
      this.cachedUser = result as UsersRecord;

      return result as UsersRecord | null;
    } catch (error) {
      console.error(`Error updating account selection for user:`, error);
      return null;
    }
  }

  async updateMainAccountId(accountId: string): Promise<UsersRecord | null> {
    try {
      if (!this.cachedUser) {
        this.cachedUser = await this.getCurrentUser();
      }

      if (!this.cachedUser) {
        return null;
      }

      const result = await this.client.db.users.update(this.cachedUser.xata_id, {
        main_account_id: accountId,
      });

      // Update cache
      this.cachedUser = result as UsersRecord;

      return result as UsersRecord | null;
    } catch (error) {
      console.error(`Error updating main account ID:`, error);
      return null;
    }
  }

  async hasValidMonobankToken(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return !!user && !!user.monobank_token && user.monobank_token.length > 0;
    } catch (error) {
      console.error(`Error checking Monobank token:`, error);
      return false;
    }
  }

  async getUpdateUserState() {
    try {
    } catch (error) {}
  }
}

const userInstances = new Map<number, UserInstance>();

export const getUserClient = (telegramId: number): UserInstance => {
  if (!userInstances.has(telegramId)) {
    userInstances.set(telegramId, new UserInstance(telegramId));
  }
  return userInstances.get(telegramId)!;
};

// Debug function to inspect userInstances
export const debugUserInstances = (): string => {
  const info = [];
  info.push(`Total user instances: ${userInstances.size}`);

  userInstances.forEach((client, telegramId) => {
    // Using any here to access the private property for debugging
    const wrapper = client as any;
    info.push(`- Telegram ID: ${telegramId}, Has cached user: ${wrapper.cachedUser !== null}; Cached user: ${wrapper.cachedUser}`);
  });

  return info.join("\n");
};

// Admin client (for user-independent operations)
let adminInstance: UserInstance | undefined = undefined;

export const getAdminClient = (): UserInstance => {
  if (!adminInstance) {
    adminInstance = new UserInstance();
  }
  return adminInstance;
};

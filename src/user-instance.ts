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

  //=============================================================================
  // Cache Management Methods
  //=============================================================================

  /**
   * Get the current user from cache or database
   */
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

  async getUserState() {
    try {
    } catch (error) {}
  }

  async updateUserState(newActionState: string) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) return null;

      // The correct way to call update according to Xata types
      const result = await this.client.db.users.update(currentUser.xata_id, {
        state: newActionState,
      });

      // Update the cache with the new state
      if (result) {
        this.cachedUser = result as UsersRecord;
      }

      return result as UsersRecord | null;
    } catch (error) {
      console.error(`Error updating user state:`, error);
      return null;
    }
  }

  /**
   * Clear the user cache
   */
  invalidateCache(): void {
    this.cachedUser = null;
  }

  //=============================================================================
  // User Retrieval Methods
  //=============================================================================

  /**
   * Get a user by their Telegram ID
   */
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

  //=============================================================================
  // User Creation & Update Methods
  //=============================================================================

  /**
   * Create a new user or update an existing one
   */
  async saveOrUpdateUser(userData: UserData): Promise<UsersRecord | null> {
    try {
      // Check if user exists
      const existingUser = this.telegramId === userData.telegramId && this.cachedUser ? this.cachedUser : await this.getUserByTelegramId(userData.telegramId);

      if (existingUser) {
        return this.updateExistingUser(existingUser, userData);
      } else {
        return this.createNewUser(userData);
      }
    } catch (error) {
      console.error(`Error saving user data for Telegram ID ${userData.telegramId}:`, error);
      return null;
    }
  }

  /**
   * Update an existing user in the database
   */
  private async updateExistingUser(existingUser: UsersRecord, userData: UserData): Promise<UsersRecord | null> {
    const result = await this.client.db.users.update(existingUser.xata_id, {
      username: userData.username || undefined,
      user_name: this.formatUserName(userData, existingUser.user_name || ""),
      language_code: userData.languageCode || existingUser.language_code,
      is_premium: userData.isPremium ?? existingUser.is_premium,
      monobank_token: userData.monobankToken || existingUser.monobank_token,
      monobank_name: userData.monobankName || existingUser.monobank_name,
      awaiting_account_selection: userData.awaitingAccountSelection !== undefined ? userData.awaitingAccountSelection : existingUser.awaiting_account_selection,
    });

    // Update cache if this is the current user
    if (this.telegramId === userData.telegramId) {
      this.cachedUser = result as UsersRecord;
    }

    console.log(result);

    return result as UsersRecord | null;
  }

  /**
   * Create a new user in the database
   */
  private async createNewUser(userData: UserData): Promise<UsersRecord | null> {
    // Get next user_id
    const nextUserId = await this.getNextUserId();

    // Create new user with the generated user_id
    const result = await this.client.db.users.create({
      user_id: nextUserId,
      telegram_id: userData.telegramId,
      username: userData.username || "",
      user_name: this.formatUserName(userData),
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

  //=============================================================================
  // Monobank-Related Methods
  //=============================================================================

  /**
   * Update user's Monobank token and name
   */
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

  /**
   * Check if user has a valid Monobank token
   */
  async hasValidMonobankToken(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return !!user && !!user.monobank_token && user.monobank_token.length > 0;
    } catch (error) {
      console.error(`Error checking Monobank token:`, error);
      return false;
    }
  }

  //=============================================================================
  // Account Management Methods
  //=============================================================================

  /**
   * Update user's account selection status
   */
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

  /**
   * Update user's main account ID
   */
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

  //=============================================================================
  // Helper Methods
  //=============================================================================

  /**
   * Format user's name based on first name and last name
   */
  private formatUserName(userData: UserData, defaultName: string = ""): string {
    if (userData.firstName && userData.lastName) {
      return `${userData.firstName || ""} ${userData.lastName || ""}`;
    }
    return userData.firstName || userData.lastName || defaultName;
  }

  /**
   * Get the next available user ID
   */
  private async getNextUserId(): Promise<number> {
    const lastUser = await this.client.db.users.select(["user_id"]).sort("user_id", "desc").getFirst();
    return (lastUser?.user_id || 0) + 1;
  }
}

//=============================================================================
// Instance Management
//=============================================================================

const userInstances = new Map<number, UserInstance>();

/**
 * Get or create a user instance for the specified Telegram ID
 */
export const getUserClient = (telegramId: number): UserInstance => {
  if (!userInstances.has(telegramId)) {
    userInstances.set(telegramId, new UserInstance(telegramId));
  }
  return userInstances.get(telegramId)!;
};

/**
 * Debug function to inspect all user instances
 */
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

// Admin instance for user-independent operations
let adminInstance: UserInstance | undefined = undefined;

/**
 * Get or create the admin instance
 */
export const getAdminClient = (): UserInstance => {
  if (!adminInstance) {
    adminInstance = new UserInstance();
  }
  return adminInstance;
};

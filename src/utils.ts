import { MonobankAccount } from "./types";
import { UsersRecord } from "./xata";

export const transformUserBalanceInfo = (accounts: MonobankAccount[], user: UsersRecord) => {
  return accounts
    .map((acc, index) => {
      const balance = (acc.balance / 100).toFixed(2);
      const currency = acc.currencyCode === 980 ? "грн" : `код валюти ${acc.currencyCode}`;
      const isMain = acc.id === user.main_account_id ? " [ОСНОВНИЙ]" : "";
      const cardNumber = acc.maskedPan && acc.maskedPan.length > 0 ? ` (${acc.maskedPan[0]})` : "";
      return `${index + 1}. Баланс: ${balance} ${currency}${cardNumber}${isMain}`;
    })
    .join("\n");
};

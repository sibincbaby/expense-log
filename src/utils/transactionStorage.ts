
import { TransactionAnalysis } from "./geminiApi";

export interface Transaction extends TransactionAnalysis {
  id: string;
  timestamp: number;
  amount: number; // We ensure amount is always set for stored transactions
}

const STORAGE_KEY = "transactions";

export const saveTransaction = (transaction: Transaction): void => {
  const transactions = getTransactions();
  transactions.push(transaction);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

export const getTransactions = (): Transaction[] => {
  const storedTransactions = localStorage.getItem(STORAGE_KEY);
  return storedTransactions ? JSON.parse(storedTransactions) : [];
};

export const deleteTransaction = (id: string): void => {
  const transactions = getTransactions();
  const updatedTransactions = transactions.filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTransactions));
};

export const clearTransactions = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

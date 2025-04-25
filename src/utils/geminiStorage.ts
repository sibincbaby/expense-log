// Store common transaction patterns and their analysis in local storage
const COMMON_TRANSACTIONS_KEY = "commonTransactions";
const TRANSACTION_FREQUENCY_KEY = "transactionFrequency";
const CATEGORIES_KEY = "transactionCategories";
const CATEGORY_ID_MAP_KEY = "transactionCategoryIdMap";
const CATEGORY_ICONS_KEY = "categoryIcons"; // New key for storing category icons

// Available emoji icons for categories
export const AVAILABLE_ICONS = [
  "🏠", "🔌", "🛒", "🍔", "🍽️", "🚗", "🚌", "🏥", "💊", 
  "💄", "👕", "🛍️", "🎬", "🎮", "👨‍👩‍👧", "👶", "🏫", "📚", 
  "💼", "💰", "💳", "🏦", "📈", "🛡️", "🎁", "💝", "📦", "🔧"
];

// Default category icon mappings
const DEFAULT_CATEGORY_ICONS: Record<number, string> = {
  1: "🏠", // Housing & Utilities
  2: "🛒", // Groceries
  3: "🍽️", // Food
  4: "🚗", // Transportation
  5: "🏥", // Health & Wellness
  6: "💄", // Personal Care
  7: "🛍️", // Shopping & Lifestyle
  8: "🎮", // Entertainment & Leisure
  9: "👨‍👩‍👧", // Family & Dependents
  10: "📚", // Work & Education
  11: "💰", // Finance & Fees
  12: "📈", // Savings & Investments
  13: "🛡️", // Insurance
  14: "🎁", // Gifts & Donations
  15: "📦"  // Miscellaneous
};

// Default categories with IDs
const DEFAULT_CATEGORIES = [
  { id: 1, name: "Housing & Utilities" },
  { id: 2, name: "Groceries" },
  { id: 3, name: "Food" },
  { id: 4, name: "Transportation" },
  { id: 5, name: "Health & Wellness" },
  { id: 6, name: "Personal Care" },
  { id: 7, name: "Shopping & Lifestyle" },
  { id: 8, name: "Entertainment & Leisure" },
  { id: 9, name: "Family & Dependents" },
  { id: 10, name: "Work & Education" },
  { id: 11, name: "Finance & Fees" },
  { id: 12, name: "Savings & Investments" },
  { id: 13, name: "Insurance" },
  { id: 14, name: "Gifts & Donations" },
  { id: 15, name: "Miscellaneous" }
];

export interface CategoryItem {
  id: number;
  name: string;
}

export interface CommonTransactionMap {
  [description: string]: {
    amount?: number; // Make amount optional
    description: string;
    type: "debit" | "credit";
    categoryId: number; // Changed from category string to categoryId number
  }
}

interface TransactionFrequencyMap {
  [description: string]: number;
}

export const getCommonTransactions = (): CommonTransactionMap => {
  const stored = localStorage.getItem(COMMON_TRANSACTIONS_KEY);
  
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Return empty object instead of default transactions
  return {};
};

// Calculate string similarity score using Levenshtein distance
const getStringSimilarity = (str1: string, str2: string): number => {
  // Simple implementation of Levenshtein distance algorithm
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Create a matrix of size (s1.length+1) x (s2.length+1)
  const matrix: number[][] = [];
  
  // Initialize the matrix
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= s2.length; j++) {
      if (i === 0) {
        matrix[0][j] = j;
      } else {
        matrix[i][j] = 0;
      }
    }
  }
  
  // Fill the matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // Calculate normalized similarity (0-1 range)
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1; // Both strings are empty
  
  const distance = matrix[s1.length][s2.length];
  return 1 - (distance / maxLength);
};

// Find best matching common transaction
export const findBestMatchingTransaction = (input: string): { transaction: CommonTransactionMap[string]; key: string; score: number } | null => {
  const commonTransactions = getCommonTransactions();
  const threshold = 0.8; // Minimum similarity score to consider a match
  
  let bestMatch: { transaction: CommonTransactionMap[string]; key: string; score: number } | null = null;
  
  // Check each common transaction for similarity
  Object.entries(commonTransactions).forEach(([key, transaction]) => {
    // Calculate similarity between input and the stored description
    const score = getStringSimilarity(input.toLowerCase(), key.toLowerCase());
    
    if (score > threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { 
        transaction, 
        key, 
        score 
      };
    }
  });
  
  return bestMatch;
};

// Track frequency of transaction descriptions to auto-learn common patterns
export const trackTransactionKeyword = (description: string): void => {
  if (!description || description.length < 3) return;
  
  const storedFrequency = localStorage.getItem(TRANSACTION_FREQUENCY_KEY);
  let frequencyMap: TransactionFrequencyMap = storedFrequency ? JSON.parse(storedFrequency) : {};
  
  description = description.toLowerCase().trim();
  frequencyMap[description] = (frequencyMap[description] || 0) + 1;
  
  localStorage.setItem(TRANSACTION_FREQUENCY_KEY, JSON.stringify(frequencyMap));
  
  // If a description appears frequently (3+ times), suggest adding it as a common transaction
  if (frequencyMap[description] === 3) {
    // This could trigger a suggestion to add this as a common transaction
    console.log(`Frequent transaction detected: ${description} (${frequencyMap[description]} times)`);
  }
};

export const saveCommonTransaction = (
  transaction: {
    description: string;
    amount?: number; // Make amount optional
    type: "debit" | "credit";
    categoryId: number; // Changed from category string to categoryId number
  }
): void => {
  const commonTransactions = getCommonTransactions();
  commonTransactions[transaction.description.toLowerCase().trim()] = transaction;
  localStorage.setItem(COMMON_TRANSACTIONS_KEY, JSON.stringify(commonTransactions));
};

export const removeCommonTransaction = (description: string): void => {
  const commonTransactions = getCommonTransactions();
  delete commonTransactions[description.toLowerCase().trim()];
  localStorage.setItem(COMMON_TRANSACTIONS_KEY, JSON.stringify(commonTransactions));
};

// Get suggested descriptions based on frequency
export const getSuggestedKeywords = (): string[] => {
  const storedFrequency = localStorage.getItem(TRANSACTION_FREQUENCY_KEY);
  if (!storedFrequency) return [];
  
  const frequencyMap: TransactionFrequencyMap = JSON.parse(storedFrequency);
  const commonTransactions = getCommonTransactions();
  
  return Object.entries(frequencyMap)
    .filter(([description, count]) => count >= 2) // Lowered threshold to 2 for more suggestions
    .sort((a, b) => b[1] - a[1])
    .map(([description]) => description)
    .slice(0, 10);  // Return top 10 suggestions
};

// Get all categories
export const getCategories = (): CategoryItem[] => {
  const stored = localStorage.getItem(CATEGORIES_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return DEFAULT_CATEGORIES;
};

// Get category by ID
export const getCategoryById = (id: number): CategoryItem | undefined => {
  const categories = getCategories();
  return categories.find(c => c.id === id);
};

// Get category name by ID
export const getCategoryNameById = (id: number): string => {
  const category = getCategoryById(id);
  return category ? category.name : "Unknown";
};

// Get category ID by name
export const getCategoryIdByName = (name: string): number => {
  const categories = getCategories();
  const category = categories.find(c => c.name === name);
  // Return Miscellaneous (15) if not found
  return category ? category.id : 15;
};

// Generate next available category ID
export const getNextCategoryId = (): number => {
  const categories = getCategories();
  return Math.max(...categories.map(c => c.id), 0) + 1;
};

// Add a new category with auto ID
export const addCategory = (categoryName: string): void => {
  const categories = getCategories();
  const normalizedCategory = categoryName.trim();
  
  // Don't add if already exists
  if (categories.some(c => c.name === normalizedCategory)) {
    return;
  }
  
  // Create new category with next available ID
  const newCategory: CategoryItem = {
    id: getNextCategoryId(),
    name: normalizedCategory
  };
  
  categories.push(newCategory);
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
};

// Remove a category
export const removeCategory = (categoryId: number): void => {
  const categories = getCategories();
  const updatedCategories = categories.filter(c => c.id !== categoryId);
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(updatedCategories));
};

// Update a category name while preserving its ID
export const updateCategory = (categoryId: number, newName: string): boolean => {
  const categories = getCategories();
  const normalizedNewName = newName.trim();
  
  // Don't allow empty names
  if (!normalizedNewName) {
    return false;
  }
  
  // Check if name already exists in another category
  if (categories.some(c => c.name === normalizedNewName && c.id !== categoryId)) {
    return false;
  }
  
  const updatedCategories = categories.map(c => 
    c.id === categoryId ? { ...c, name: normalizedNewName } : c
  );
  
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(updatedCategories));
  return true;
};

// Get icon for a category
export const getCategoryIcon = (categoryId: number): string => {
  // Try to get from localStorage first
  const stored = localStorage.getItem(CATEGORY_ICONS_KEY);
  const iconMap: Record<number, string> = stored ? JSON.parse(stored) : {};
  
  // If we have a custom icon stored, return it
  if (iconMap[categoryId]) {
    return iconMap[categoryId];
  }
  
  // Otherwise fall back to default icon if available
  if (DEFAULT_CATEGORY_ICONS[categoryId]) {
    return DEFAULT_CATEGORY_ICONS[categoryId];
  }
  
  // Last resort - return package emoji as fallback
  return "📦";
};

// Set icon for a category
export const setCategoryIcon = (categoryId: number, icon: string): void => {
  const stored = localStorage.getItem(CATEGORY_ICONS_KEY);
  const iconMap: Record<number, string> = stored ? JSON.parse(stored) : {};
  
  iconMap[categoryId] = icon;
  localStorage.setItem(CATEGORY_ICONS_KEY, JSON.stringify(iconMap));
};

// Initialize category icons on first run
export const initializeCategoryIcons = (): void => {
  const stored = localStorage.getItem(CATEGORY_ICONS_KEY);
  
  // If we already have icons stored, don't overwrite them
  if (stored) return;
  
  // Otherwise initialize with default icons
  localStorage.setItem(CATEGORY_ICONS_KEY, JSON.stringify(DEFAULT_CATEGORY_ICONS));
};

// Call this during app initialization
initializeCategoryIcons();


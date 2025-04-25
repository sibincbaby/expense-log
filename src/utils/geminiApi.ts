import { getCommonTransactions, findBestMatchingTransaction, getCategoryIdByName, getCategories } from "./geminiStorage";
import Anthropic from '@anthropic-ai/sdk';

export interface TransactionAnalysis {
  amount?: number; // Optional amount
  description: string;
  type: "debit" | "credit";
  category?: string; // Keep for backward compatibility
  categoryId: number; // Using numerical ID for category
}

// Enhanced cache with adaptive TTL (Time To Live)
interface CacheEntry {
  data: TransactionAnalysis;
  timestamp: number;
  usageCount?: number;  // Track how many times this entry was used
}

// Shorter cache time for rarely used items, longer for frequently used ones
const BASE_CACHE_TTL = 1000 * 60 * 15;  // 15 minutes base TTL
const MAX_CACHE_TTL = 1000 * 60 * 60 * 24;  // 24 hour maximum TTL
const analysisCache: Record<string, CacheEntry> = {};

// Maintain connection state for each API
let isGeminiConnectionWarmedUp = false;
let isClaudeConnectionWarmedUp = false;

// Function to reset API connections - call this when switching between models
export const resetApiConnections = () => {
  preloadedAnthropicClient = null;
  preloadedGeminiEndpoint = null;
  isGeminiConnectionWarmedUp = false;
  isClaudeConnectionWarmedUp = false;
  console.log('Reset API connections');
};

// Function to warm up connection to Gemini API
export async function warmUpConnection(apiKey: string, useClaudeApi: boolean = false, claudeApiKey: string = "") {
  if (useClaudeApi && isClaudeConnectionWarmedUp) return;
  if (!useClaudeApi && isGeminiConnectionWarmedUp) return;
  
  try {
    console.log(`Warming up ${useClaudeApi ? "Claude" : "Gemini"} API connection...`);
    const startTime = performance.now();
    
    // Make a minimal request to warm up the connection
    if (useClaudeApi) {
      if (!claudeApiKey) return;
      
      // Use the Anthropic client SDK instead of direct fetch to avoid CORS issues
      // Initialize the Anthropic client (similar to how it's used elsewhere)
      const anthropic = new Anthropic({
        apiKey: claudeApiKey,
        dangerouslyAllowBrowser: true
      });
      
      // Make a minimal request to warm up the connection
      await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hello" }]
      });
      isClaudeConnectionWarmedUp = true;
    } else {
      if (!apiKey) return;
      
      await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello" }] }],
          generationConfig: {
            maxOutputTokens: 10,
          }
        })
      });
      isGeminiConnectionWarmedUp = true;
    }
    
    const endTime = performance.now();
    console.log(`${useClaudeApi ? "Claude" : "Gemini"} API warm-up complete: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`Error warming up ${useClaudeApi ? "Claude" : "Gemini"} API connection:`, error);
  }
}

// Function to warm up the specific API when switching models
export const warmUpNewlySelectedApi = (useClaudeApi: boolean) => {
  // Get API keys from localStorage
  const geminiApiKey = localStorage.getItem("geminiApiKey") || "";
  const claudeApiKey = localStorage.getItem("claudeApiKey") || "";
  
  // Only warm up the API that was just selected
  if (useClaudeApi) {
    // User switched to Claude
    if (!isClaudeConnectionWarmedUp && claudeApiKey) {
      console.log("Warming up Claude API after switch...");
      warmUpConnection(geminiApiKey, true, claudeApiKey);
    }
  } else {
    // User switched to Gemini
    if (!isGeminiConnectionWarmedUp && geminiApiKey) {
      console.log("Warming up Gemini API after switch...");
      warmUpConnection(geminiApiKey, false);
    }
  }
};

// Create dynamic prompt with available categories and their IDs
function createTransactionPrompt() {
  // Get all available categories with their IDs
  const categories = getCategories();
  const categoryOptions = categories.map(cat => `${cat.name} (ID: ${cat.id})`).join(", ");
  
  return `You are a Finance Transaction Analyzer. Categorize this transaction and determine if it's a credit or debit. 
Return ONLY JSON in this format: {"description": "string", "type": "debit/credit", "categoryId": number}.

Available categories with their IDs:
${categoryOptions}

Choose the most appropriate category ID for the transaction. Return ONLY valid JSON with the exact schema specified.`;
}

// Common system prompt for all AI services - now dynamically generated
const TRANSACTION_PROMPT = createTransactionPrompt();

// Preloaded API connections for faster response times
let preloadedAnthropicClient: Anthropic | null = null;
let preloadedGeminiEndpoint: string | null = null;

// Helper function to preload API connections
export const preloadApiConnections = (geminiApiKey: string | null, claudeApiKey: string | null) => {
  // Preload Anthropic client if we have a key
  if (claudeApiKey) {
    preloadedAnthropicClient = new Anthropic({
      apiKey: claudeApiKey,
      dangerouslyAllowBrowser: true
    });
    console.log('Preloaded Anthropic client');
  }
  
  // Prepare Gemini endpoint URL if we have a key
  if (geminiApiKey) {
    preloadedGeminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`;
    
    // Make a tiny request to warm up the connection
    fetch(preloadedGeminiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "init" }] }],
        generationConfig: { temperature: 0.0, topP: 0.1, maxOutputTokens: 1 }
      })
    }).then(() => {
      console.log('Preloaded Gemini connection');
    }).catch(() => {
      preloadedGeminiEndpoint = null;
    });
  }
};

// Unified function to call AI services (Gemini or Claude)
async function callAiService(
  apiKey: string,
  transactionDescription: string,
  service: "gemini" | "claude"
): Promise<TransactionAnalysis> {
  try {
    console.log(`Starting ${service} API request for:`, transactionDescription);
    
    // Start timing
    const startTime = performance.now();
    
    let responseText = "";
    
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // Reduced from 5000ms to 3500ms for faster response
    
    try {
      if (service === "claude") {
        // Use preloaded Anthropic client if available
        const anthropic = preloadedAnthropicClient || new Anthropic({
          apiKey: apiKey,
          dangerouslyAllowBrowser: true // Enable browser usage
        });
        
        // Call the Anthropic API using the SDK
        const message = await anthropic.messages.create(
          {
            model: "claude-3-haiku-20240307",
            max_tokens: 64,       // Reduced from 128 since we only need a small JSON response
            temperature: 0,
            system: TRANSACTION_PROMPT,
            messages: [{ role: "user", content: transactionDescription }]
          },
          { signal: controller.signal }
        );
        
        if (!message.content || message.content.length === 0) {
          throw new Error("Invalid API response format from Claude");
        }
        
        responseText = message.content[0].text;
        console.log(`${service} API response:`, message);
        
      } else { // gemini
        // Use preloaded Gemini endpoint if available
        const geminiApiUrl = preloadedGeminiEndpoint || `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
        
        const response = await fetch(geminiApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: TRANSACTION_PROMPT + "\n\n" + transactionDescription }]
            }],
            generationConfig: {
              temperature: 0.0,
              topP: 0.1,           // Reduced from 0.3 for faster responses
              maxOutputTokens: 50,  // Reduced from 100 since we only need a small JSON output
            }
          }),
          signal: controller.signal
        });
        
        const data = await response.json();
        console.log(`${service} API response:`, data);
        
        if (!data.candidates || !data.candidates[0]?.content?.parts || !data.candidates[0]?.content?.parts[0]?.text) {
          throw new Error(`Invalid API response format from ${service}`);
        }
        
        responseText = data.candidates[0].content.parts[0].text;
      }
    } finally {
      clearTimeout(timeoutId);
      
      // Calculate and log time taken
      const endTime = performance.now();
      console.log(`${service} API response time: ${(endTime - startTime).toFixed(2)}ms`);
    }
    
    console.log(`${service} response text:`, responseText);
    
    // Extract and parse JSON response (common for both services)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error(`Could not parse JSON from ${service} response`);
    }
    
    // Parse JSON and handle potential errors robustly
    const parsedData = JSON.parse(jsonMatch[0]);
    console.log(`Parsed JSON from gemini:`, parsedData);
    
    // Determine the category ID - prefer direct categoryId from AI, fall back to lookup by name
    let categoryId: number;
    if (typeof parsedData.categoryId === 'number') {
      // AI returned a categoryId directly (preferred)
      categoryId = parsedData.categoryId;
      console.log(`AI provided categoryId directly: ${categoryId}`);
    } else if (parsedData.category) {
      // AI returned a category name, need to look up the ID
      categoryId = getCategoryIdByName(parsedData.category);
      console.log(`AI provided category name: ${parsedData.category}, mapped to ID: ${categoryId}`);
    } else {
      // No category information provided, use default
      categoryId = getCategoryIdByName("Miscellaneous");
      console.log(`No category information provided, using default ID: ${categoryId}`);
    }
    
    // Make sure it matches our TransactionAnalysis interface
    const result: TransactionAnalysis = {
      description: parsedData.description || transactionDescription,
      type: (parsedData.type || "debit").toLowerCase() as "debit" | "credit",
      // Keep category name for backward compatibility if provided
      ...(parsedData.category && { category: parsedData.category }),
      categoryId: categoryId,
      // No amount from LLM - we'll handle that separately
    };
    
    console.log(`Processed ${service} result:`, result);
    return result;
    
  } catch (error) {
    console.error(`Error with ${service} API:`, error);
    
    // Graceful error handling - extract useful transaction data from the error
    const words = transactionDescription.trim().split(/\s+/);
    let extractedAmount = null;
    let extractedDescription = transactionDescription;
    
    // Look for a number in the description
    for (const word of words) {
      const parsedNumber = parseFloat(word);
      if (!isNaN(parsedNumber)) {
        extractedAmount = parsedNumber;
        extractedDescription = words.filter(w => w !== word).join(" ") || transactionDescription;
        break;
      }
    }
    
    // Provide graceful fallback with data extracted from description
    return {
      description: extractedDescription,
      type: "debit", // Default to debit
      category: "Miscellaneous",
      categoryId: getCategoryIdByName("Miscellaneous"),
      amount: extractedAmount !== null ? extractedAmount : 0
    };
  }
}

// More robust amount extraction function
function extractAmountFromText(text: string): { extractedAmount: number | null, cleanDescription: string } {
  // First check for currency patterns like ₹100, $50, etc.
  const currencyMatch = text.match(/[₹$€£¥](\d+(?:\.\d+)?)/);
  if (currencyMatch) {
    const amount = parseFloat(currencyMatch[1]);
    // Remove the currency amount from the description
    const cleanDesc = text.replace(currencyMatch[0], '').trim();
    return { extractedAmount: amount, cleanDescription: cleanDesc };
  }
  
  // Next check for numbers followed by currency symbols
  const reverseCurrencyMatch = text.match(/(\d+(?:\.\d+)?)[₹$€£¥]/);
  if (reverseCurrencyMatch) {
    const amount = parseFloat(reverseCurrencyMatch[1]);
    // Remove the amount from the description
    const cleanDesc = text.replace(reverseCurrencyMatch[0], '').trim();
    return { extractedAmount: amount, cleanDescription: cleanDesc };
  }

  // Check for patterns where numbers are directly attached to text (like "tea20")
  const attachedNumberMatch = text.match(/([a-zA-Z]+)(\d+(?:\.\d+)?)/);
  if (attachedNumberMatch) {
    const textPart = attachedNumberMatch[1];
    const numberPart = attachedNumberMatch[2];
    const amount = parseFloat(numberPart);
    if (!isNaN(amount)) {
      // Replace the matched pattern with just the text part
      const cleanDesc = text.replace(attachedNumberMatch[0], textPart).trim();
      return { extractedAmount: amount, cleanDescription: cleanDesc };
    }
  }
  
  // Check for patterns where numbers are at the beginning (like "20tea")
  const numberFirstMatch = text.match(/(\d+(?:\.\d+)?)([a-zA-Z]+)/);
  if (numberFirstMatch) {
    const numberPart = numberFirstMatch[1];
    const textPart = numberFirstMatch[2];
    const amount = parseFloat(numberPart);
    if (!isNaN(amount)) {
      // Replace the matched pattern with just the text part
      const cleanDesc = text.replace(numberFirstMatch[0], textPart).trim();
      return { extractedAmount: amount, cleanDescription: cleanDesc };
    }
  }

  // Finally, look for standalone numbers
  const words = text.trim().split(/\s+/);
  for (const word of words) {
    // Skip words that are likely not amounts (e.g., dates, times)
    if (word.includes('/') || word.includes(':')) continue;
    
    const parsedNumber = parseFloat(word);
    if (!isNaN(parsedNumber)) {
      // Remove the amount from the description
      const cleanDesc = words.filter(w => w !== word).join(' ').trim();
      return { extractedAmount: parsedNumber, cleanDescription: cleanDesc };
    }
  }

  // No amount found
  return { extractedAmount: null, cleanDescription: text };
}

export const analyzeTransaction = async (
  apiKey: string,
  transactionDescription: string,
  useClaudeApi: boolean = false,
  claudeApiKey: string = ""
): Promise<TransactionAnalysis> => {
  // 1. Extract amount from transaction description first - do this before any caching or matching
  const { extractedAmount, cleanDescription } = extractAmountFromText(transactionDescription);
  console.log(`Extracted amount: ${extractedAmount}, Clean description: ${cleanDescription}`);
  
  // Now use clean description (without amount) for matching and caching
  const input = cleanDescription.trim().toLowerCase();
  
  // Check for common transactions first (instant response)
  const commonTransactions = getCommonTransactions();
  
  // Direct match with description
  if (commonTransactions[input]) {
    console.log("Using predefined transaction for:", input);
    // Use saved amount if available, otherwise use extracted amount
    const result = {...commonTransactions[input]};
    if (!result.amount && extractedAmount !== null) {
      result.amount = extractedAmount;
    }
    if (!result.categoryId) {
      result.categoryId = getCategoryIdByName(result.category || "Miscellaneous");
    }
    return result;
  }
  
  // Fuzzy match with common transactions
  const bestMatch = findBestMatchingTransaction(input);
  if (bestMatch) {
    console.log(`Using fuzzy matched transaction for: "${input}" matched with "${bestMatch.key}" (similarity: ${bestMatch.score.toFixed(2)})`);
    // Use saved amount if available, otherwise use extracted amount
    const result = {...bestMatch.transaction};
    if (!result.amount && extractedAmount !== null) {
      result.amount = extractedAmount;
    }
    if (!result.categoryId) {
      result.categoryId = getCategoryIdByName(result.category || "Miscellaneous");
    }
    return result;
  }
  
  // Check cache with adaptive TTL - now using clean description as key
  const cacheKey = input;
  const cachedResult = analysisCache[cacheKey];
  const now = Date.now();
  
  if (cachedResult) {
    const elapsedTime = now - cachedResult.timestamp;
    const adaptiveTTL = Math.min(BASE_CACHE_TTL + (cachedResult.usageCount || 0) * BASE_CACHE_TTL, MAX_CACHE_TTL);
    
    if (elapsedTime < adaptiveTTL) {
      console.log("Using cached result for:", cacheKey);
      cachedResult.usageCount = (cachedResult.usageCount || 0) + 1;
      
      // Clone the cached result and update with current amount if needed
      const result = {...cachedResult.data};
      if (extractedAmount !== null) {
        result.amount = extractedAmount;
      }
      
      return result;
    }
  }

  try {
    // 2. Get categorization from AI services (without amount)
    let aiResult: TransactionAnalysis;
    
    // Use Claude API if enabled and API key is available
    if (useClaudeApi && claudeApiKey) {
      try {
        aiResult = await callAiService(claudeApiKey, cleanDescription, "claude");
      } catch (claudeError) {
        console.error("Claude API failed:", claudeError);
        // Fallback to Gemini on Claude error if API key is available
        if (apiKey) {
          console.log("Falling back to Gemini API after Claude error");
          aiResult = await callAiService(apiKey, cleanDescription, "gemini");
        } else {
          // Create a basic result with our extracted data
          aiResult = {
            description: cleanDescription,
            type: "debit",
            category: "Miscellaneous",
            categoryId: getCategoryIdByName("Miscellaneous"),
          };
        }
      }
    } else if (apiKey) {
      // Use Gemini if Claude is not enabled
      aiResult = await callAiService(apiKey, cleanDescription, "gemini");
    } else {
      // No API keys available
      aiResult = {
        description: cleanDescription,
        type: "debit",
        category: "Miscellaneous",
        categoryId: getCategoryIdByName("Miscellaneous"),
      };
    }
    
    // 3. Combine AI categorization with extracted amount
    const result: TransactionAnalysis = {
      ...aiResult,
      amount: extractedAmount
    };
    
    // Save to cache with timestamp and usage count
    analysisCache[cacheKey] = {
      data: result,
      timestamp: now,
      usageCount: 1  // Initialize with 1 for first usage
    };
    
    return result;
    
  } catch (error) {
    console.error("Error analyzing transaction:", error);
    
    // Improved direct extraction fallback
    const { extractedAmount, cleanDescription } = extractAmountFromText(transactionDescription);
    
    // Fallback analysis for common transactions even if they weren't exact matches
    for (const [description, analysis] of Object.entries(commonTransactions)) {
      if (input.includes(description)) {
        console.log("Using fallback transaction for:", description);
        return {
          ...analysis,
          amount: extractedAmount || analysis.amount,
          categoryId: getCategoryIdByName(analysis.category || "Miscellaneous"),
        };
      }
    }
    
    // Last resort fallback using direct extraction
    return {
      amount: extractedAmount || 0,
      description: cleanDescription || "Unknown transaction",
      type: "debit",
      category: "Miscellaneous",
      categoryId: getCategoryIdByName("Miscellaneous"),
    };
  }
};


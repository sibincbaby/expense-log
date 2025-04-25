import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeTransaction, TransactionAnalysis } from "@/utils/geminiApi";
import { saveTransaction } from "@/utils/transactionStorage";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Send, X } from "lucide-react";
import debounce from 'lodash/debounce';
import { 
  trackTransactionKeyword, 
  findBestMatchingTransaction, 
  getCommonTransactions,
  getSuggestedKeywords,
  getCategories,
  getCategoryIcon
} from "@/utils/geminiStorage";

interface TransactionFormProps {
  apiKey: string;
  claudeApiKey?: string;
  useClaudeApi?: boolean;
  onTransactionAdded: () => void;
  showTitle?: boolean;
}

const TransactionForm = ({ 
  apiKey, 
  claudeApiKey = "", 
  useClaudeApi = false, 
  onTransactionAdded,
  showTitle = true
}: TransactionFormProps) => {
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [recentTransactions, setRecentTransactions] = useState<string[]>([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Focus input field on component mount for faster entry
  useEffect(() => {
    if (!isMobile && inputRef.current) {
      inputRef.current.focus();
    }
    if (isMobile && textareaRef.current) {
      textareaRef.current.focus();
    }
    
    // Load recent transaction keywords
    const suggestedKeywords = getSuggestedKeywords();
    setRecentTransactions(suggestedKeywords);
  }, [isMobile]);
  
  // Keyboard detection for mobile
  useEffect(() => {
    // Set up keyboard detection for mobile
    if (isMobile) {
      const handleVisibilityChange = () => {
        // Use visual viewport for more accurate keyboard detection
        if (window.visualViewport) {
          const heightRatio = window.visualViewport.height / window.innerHeight;
          setIsKeyboardVisible(heightRatio < 0.7); // Assume keyboard is open if viewport height is less than 70%
        }
      };
      
      // Use visualViewport API if available (more accurate for keyboard detection)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleVisibilityChange);
        return () => window.visualViewport?.removeEventListener('resize', handleVisibilityChange);
      } else {
        // Fallback to window resize
        window.addEventListener('resize', handleVisibilityChange);
        return () => window.removeEventListener('resize', handleVisibilityChange);
      }
    }
  }, [isMobile]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle Enter key press to submit form
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && description.trim()) {
      e.preventDefault(); // Prevent default to avoid new line in textarea
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // Generate suggestions based on input - enhanced to include multiple sources
  const generateSuggestions = useCallback((input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }

    const commonTransactions = getCommonTransactions();
    const matches: string[] = [];

    // 1. Priority: Add suggestions from common transactions first
    Object.keys(commonTransactions).forEach(keyword => {
      if (keyword.toLowerCase().includes(input.toLowerCase()) && !matches.includes(keyword)) {
        matches.push(keyword);
      }
    });

    // 2. Add suggestions from recent/frequent transactions
    recentTransactions.forEach(keyword => {
      if (
        keyword.toLowerCase().includes(input.toLowerCase()) && 
        !matches.includes(keyword) &&
        matches.length < 5 // Limit to avoid too many suggestions
      ) {
        matches.push(keyword);
      }
    });

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [recentTransactions]);

  const debouncedHandleChange = useCallback(
    debounce((value: string) => {
      generateSuggestions(value);
      setIsDebouncing(false);
    }, 200),
    [generateSuggestions]
  );

  const applySuggestion = (suggestion: string) => {
    setDescription(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    
    // Focus back on the input after selecting
    if (isMobile && textareaRef.current) {
      textareaRef.current.focus();
    } else if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      toast.error("Please enter a transaction description");
      return;
    }
    
    setIsLoading(true);
    
    try {
      let result: TransactionAnalysis;
      
      try {
        // First try to analyze with API
        result = await analyzeTransaction(apiKey, description, useClaudeApi, claudeApiKey);
      } catch (error) {
        console.error("Error in API analysis:", error);
        
        // Fallback to direct extraction
        result = {
          description: description,
          type: "debit", // Default to debit
          categoryId: 0, // Default category ID
        };
      }
      
      // Save transaction
      const transaction = {
        id: Date.now().toString(), // Unique ID based on timestamp
        description: result.description || description,
        amount: result.amount || 0,
        type: result.type || "debit",
        timestamp: Date.now(),
        categoryId: result.categoryId,
      };
      
      saveTransaction(transaction);
      
      // Track this keyword for future suggestions
      trackTransactionKeyword(description.toLowerCase());
      
      // Clear form
      setDescription("");
      setSuggestions([]);
      setShowSuggestions(false);
      
      // Notify parent component
      onTransactionAdded();
      
      // Show success message
      toast.success(`${transaction.type === "debit" ? "Expense" : "Income"} added successfully`);
    } catch (error) {
      console.error("Error processing transaction:", error);
      toast.error("Failed to process transaction");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDescription(value);
    setIsDebouncing(true);
    debouncedHandleChange(value);
  };

  const handleClearInput = () => {
    setDescription("");
    setSuggestions([]);
    setShowSuggestions(false);
    
    if (isMobile && textareaRef.current) {
      textareaRef.current.focus();
    } else if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <Card className={`w-full shadow-elevation-1 transition-all duration-300 hover:shadow-elevation-2 ${isKeyboardVisible ? "pb-1" : ""} ${isFocused ? "border-primary/30" : ""}`}>
      {showTitle && (
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <span className="animate-fade-in">New Transaction</span>
          </CardTitle>
        </CardHeader>
      )}
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {isMobile ? (
              <div className="relative animate-slide-up">
                <Textarea
                  placeholder="What's your transaction (e.g. 'Tea 15')"
                  value={description}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  onFocus={() => {
                    setIsKeyboardVisible(true);
                    setIsFocused(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsKeyboardVisible(false), 100);
                    setIsFocused(false);
                  }}
                  disabled={isLoading}
                  rows={2}
                  className="resize-none transition-all duration-200 focus:border-primary/50"
                  ref={textareaRef}
                />
                {description && (
                  <button 
                    type="button" 
                    className="absolute top-2 right-2 p-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    onClick={handleClearInput}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div 
                    ref={suggestionsRef} 
                    className="absolute z-10 mt-1 w-full bg-card border rounded-md shadow-elevation-2 max-h-60 overflow-auto animate-slide-up"
                  >
                    <ul className="py-1">
                      {suggestions.map((suggestion, index) => (
                        <li 
                          key={index} 
                          className="px-3 py-2.5 hover:bg-muted cursor-pointer text-sm flex items-center transition-colors duration-150"
                          onClick={() => applySuggestion(suggestion)}
                        >
                          {/* Display the icon based on the transaction if it exists in commonTransactions */}
                          {(() => {
                            const commonTxns = getCommonTransactions();
                            const matchedTxn = commonTxns[suggestion];
                            return matchedTxn ? 
                              <span className="mr-2 transition-transform duration-200 hover:scale-110">{getCategoryIcon(matchedTxn.categoryId)}</span> : 
                              null;
                          })()}
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative animate-slide-up">
                <Input
                  placeholder="What's your transaction (e.g. 'Tea 15')"
                  value={description}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  disabled={isLoading}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="transition-all duration-200 focus:border-primary/50"
                  ref={inputRef}
                />
                {description && (
                  <button 
                    type="button" 
                    className="absolute top-2 right-2 p-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    onClick={handleClearInput}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div 
                    ref={suggestionsRef} 
                    className="absolute z-10 mt-1 w-full bg-card border rounded-md shadow-elevation-2 max-h-60 overflow-auto animate-slide-up"
                  >
                    <ul className="py-1">
                      {suggestions.map((suggestion, index) => (
                        <li 
                          key={index} 
                          className="px-3 py-2.5 hover:bg-muted cursor-pointer text-sm flex items-center transition-colors duration-150"
                          onClick={() => applySuggestion(suggestion)}
                        >
                          {/* Display the icon based on the transaction if it exists in commonTransactions */}
                          {(() => {
                            const commonTxns = getCommonTransactions();
                            const matchedTxn = commonTxns[suggestion];
                            return matchedTxn ? 
                              <span className="mr-2 transition-transform duration-200 hover:scale-110">{getCategoryIcon(matchedTxn.categoryId)}</span> : 
                              null;
                          })()}
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className={isKeyboardVisible ? "pb-safe" : ""}>
          <Button 
            type="submit" 
            disabled={isLoading} 
            className={`w-full transition-all duration-300 ${!description.trim() ? 'opacity-70' : 'hover:opacity-90 hover:shadow-md'}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className={`h-4 w-4 mr-2 transition-transform duration-200 ${isFocused ? 'translate-x-1' : ''}`} />
                Add Transaction
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default TransactionForm;

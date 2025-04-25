import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTransactions, Transaction, clearTransactions } from "@/utils/transactionStorage";
import TransactionItem from "./TransactionItem";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterX, SortAsc, SortDesc, Search, Filter } from "lucide-react";
import { getCategoryNameById } from "@/utils/geminiStorage";
import { motion, AnimatePresence } from "framer-motion";

// Time period type for filtering, matching the type in Index.tsx
type TimePeriod = "all" | "monthly" | "weekly" | "today";

// Helper functions for dates - duplicating from Index.tsx for component independence
const getStartOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getEndOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const getStartOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getEndOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() + (day === 0 ? 0 : 7 - day); // Adjust for Sunday
  result.setDate(diff);
  result.setHours(23, 59, 59, 999);
  return result;
};

const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
};

const getEndOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
};

interface TransactionListProps {
  onUpdate: () => void;
  refreshTrigger: number;
  timePeriod: TimePeriod;
  currentDate: Date;
  onSearchResults?: (debitTotal: number, creditTotal: number, transactions: Transaction[]) => void;
  searchQuery?: string; // New prop for search query from parent
  showControls?: boolean; // New prop to control whether to show filter controls
}

const TransactionList = ({ 
  refreshTrigger, 
  onUpdate, 
  timePeriod, 
  currentDate,
  onSearchResults,
  searchQuery = "", // Default to empty string
  showControls = true // Default to showing controls
}: TransactionListProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<"all" | "debit" | "credit">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>("");
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  
  // Initialize internal search with prop value when it changes
  useEffect(() => {
    setInternalSearchQuery(searchQuery);
  }, [searchQuery]);
  
  useEffect(() => {
    loadTransactions();
  }, [refreshTrigger, filter, sort, timePeriod, currentDate]); // Added timePeriod and currentDate dependencies
  
  // Apply search filter when transactions or search query changes
  useEffect(() => {
    // Use either internal search state or the prop that was passed
    const activeSearchQuery = searchQuery || internalSearchQuery;
    
    const filtered = activeSearchQuery.trim() 
      ? transactions.filter(t => 
          t.description.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
          getCategoryNameById(t.categoryId).toLowerCase().includes(activeSearchQuery.toLowerCase())
        )
      : transactions;
    
    setFilteredTransactions(filtered);
    
    // Calculate totals for search results and pass them up
    if (onSearchResults) {
      const debitTotal = filtered
        .filter(t => t.type === "debit")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const creditTotal = filtered
        .filter(t => t.type === "credit")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      onSearchResults(debitTotal, creditTotal, filtered);
    }
  }, [transactions, internalSearchQuery, searchQuery, onSearchResults]);

  const loadTransactions = () => {
    try {
      let txns = getTransactions();
      
      // Apply time period filter
      if (timePeriod !== "all") {
        const startDate =
          timePeriod === "today"
            ? getStartOfDay(currentDate)
            : timePeriod === "weekly"
            ? getStartOfWeek(currentDate)
            : getStartOfMonth(currentDate);
        const endDate =
          timePeriod === "today"
            ? getEndOfDay(currentDate)
            : timePeriod === "weekly"
            ? getEndOfWeek(currentDate)
            : getEndOfMonth(currentDate);
        txns = txns.filter((txn) => txn.timestamp >= startDate.getTime() && txn.timestamp <= endDate.getTime());
      }
      
      // Apply filters
      if (filter === "debit") {
        txns = txns.filter(t => t.type === "debit");
      } else if (filter === "credit") {
        txns = txns.filter(t => t.type === "credit");
      }
      
      // Apply sorting
      switch (sort) {
        case "newest":
          txns = txns.sort((a, b) => b.timestamp - a.timestamp);
          break;
        case "oldest":
          txns = txns.sort((a, b) => a.timestamp - b.timestamp);
          break;
        case "highest":
          txns = txns.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
          break;
        case "lowest":
          txns = txns.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
          break;
      }
      
      setTransactions(txns);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Could not load transactions");
    }
  };
  
  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to delete all transactions?")) {
      try {
        clearTransactions();
        setTransactions([]);
        setFilteredTransactions([]);
        toast.success("All transactions cleared");
        onUpdate();
      } catch (error) {
        toast.error("Failed to clear transactions");
      }
    }
  };

  // Handle transaction removal animation
  const handleRemoveTransaction = (id: string) => {
    setTransactionToDelete(id);
    // The actual deletion happens in the TransactionItem component
  };

  return (
    <div className="space-y-6">
      {showControls && (
        <>
          <div className="flex flex-col sm:flex-row justify-between gap-4 animate-fade-in">
            <h2 className="text-xl font-semibold text-foreground transition-colors duration-200">
              Transaction History
            </h2>
            
            <div className="flex flex-wrap gap-2">
              <Select 
                value={filter} 
                onValueChange={(value) => setFilter(value as any)}
              >
                <SelectTrigger className="w-[110px] transition-all duration-200 border-primary/20 hover:border-primary/50 focus:border-primary">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-primary/80" />
                    <SelectValue placeholder="Filter" />
                  </div>
                </SelectTrigger>
                <SelectContent className="animate-scale-in">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={sort} 
                onValueChange={(value) => setSort(value as any)}
              >
                <SelectTrigger className="w-[110px] transition-all duration-200 border-primary/20 hover:border-primary/50 focus:border-primary">
                  <div className="flex items-center gap-1.5">
                    {sort.includes("newest") || sort.includes("highest") ? (
                      <SortDesc className="h-3.5 w-3.5 text-primary/80" />
                    ) : (
                      <SortAsc className="h-3.5 w-3.5 text-primary/80" />
                    )}
                    <SelectValue placeholder="Sort" />
                  </div>
                </SelectTrigger>
                <SelectContent className="animate-scale-in">
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="highest">Highest</SelectItem>
                  <SelectItem value="lowest">Lowest</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => {
                  setFilter("all");
                  setSort("newest");
                }}
                title="Reset filters"
                className="transition-all duration-200 border-primary/20 hover:border-primary/50 focus:border-primary"
              >
                <FilterX className="h-4 w-4 text-primary/80" />
              </Button>
            </div>
          </div>

          {/* Only show the search input if we're not using the external search */}
          {!searchQuery && (
            <div className="flex items-center gap-4 animate-slide-up">
              <Input 
                value={internalSearchQuery} 
                onChange={(e) => setInternalSearchQuery(e.target.value)} 
                placeholder="Search transactions..." 
                className="transition-all duration-200 border-primary/20 hover:border-primary/30 focus:border-primary placeholder:text-muted-foreground/70"
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setInternalSearchQuery("")} 
                title="Clear search"
                className="transition-all duration-200 border-primary/20 hover:border-primary/50"
              >
                <Search className="h-4 w-4 text-primary/80" />
              </Button>
            </div>
          )}
        </>
      )}
      
      <AnimatePresence>
        {filteredTransactions.length > 0 ? (
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence>
              {filteredTransactions.map((transaction) => (
                <motion.div
                  key={transaction.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -300 }}
                  transition={{ duration: 0.2 }}
                >
                  <TransactionItem
                    transaction={transaction}
                    onDelete={() => {
                      handleRemoveTransaction(transaction.id);
                      loadTransactions();
                      onUpdate();
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {showControls && (
              <motion.div 
                className="flex justify-center mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Button 
                  variant="destructive" 
                  onClick={handleClearAll} 
                >
                  Clear All Transactions
                </Button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            className="text-center py-12 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-lg">No transactions found</p>
            <p className="text-sm mt-2">Add one to get started!</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionList;

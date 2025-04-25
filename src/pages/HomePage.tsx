import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTransactions } from "@/utils/transactionStorage";
import { Calendar as CalendarIcon, ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTransactions } from "@/context/TransactionContext";
import { getCategoryNameById, getCategoryIcon } from "@/utils/geminiStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Time period types for filtering
type TimePeriod = "monthly" | "weekly" | "today" | "selected";

// Helper functions for dates
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
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getEndOfWeek = (date: Date): Date => {
  const result = new Date(getStartOfWeek(date));
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
};

const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getEndOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
};

const formatMonthYear = (date: Date): string => {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// Get current month's start and end dates
const getCurrentMonth = (): { start: Date; end: Date } => {
  const today = new Date();
  return {
    start: getStartOfMonth(today),
    end: getEndOfMonth(today)
  };
};

// Check if a date is within the current month
const isDateInCurrentMonth = (date: Date): boolean => {
  const { start, end } = getCurrentMonth();
  return date >= start && date <= end;
};

const HomePage = () => {
  const { refreshTrigger, refreshTransactions } = useTransactions();
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("monthly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    return parseFloat(localStorage.getItem("monthlyBudget") || "0") || 0;
  });
  const [recentTransactionsLimit, setRecentTransactionsLimit] = useState(() => {
    return parseInt(localStorage.getItem("recentTransactionsLimit") || "5") || 5;
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Memoize currentMonthBounds to prevent recreation on every render
  const currentMonthBounds = React.useMemo(() => getCurrentMonth(), []);

  // Ensure date stays within current month on component mount
  useEffect(() => {
    // If current selected date is not in current month, reset to today
    if (!isDateInCurrentMonth(currentDate)) {
      setCurrentDate(new Date());
    }
  }, []);

  // Navigate to previous period (within current month)
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    
    if (timePeriod === "monthly") {
      // No change for monthly view - we only show current month
      return;
    } else if (timePeriod === "weekly") {
      newDate.setDate(newDate.getDate() - 7);
      // Ensure we don't go before the start of current month
      if (newDate < currentMonthBounds.start) {
        newDate.setTime(currentMonthBounds.start.getTime());
      }
    } else { // today
      newDate.setDate(newDate.getDate() - 1);
      // Ensure we don't go before the start of current month
      if (newDate < currentMonthBounds.start) {
        return;
      }
    }
    setCurrentDate(newDate);
  };

  // Navigate to next period (within current month)
  const goToNext = () => {
    const newDate = new Date(currentDate);
    
    if (timePeriod === "monthly") {
      // No change for monthly view - we only show current month
      return;
    } else if (timePeriod === "weekly") {
      newDate.setDate(newDate.getDate() + 7);
      // Ensure we don't go past the end of current month
      if (newDate > currentMonthBounds.end) {
        // Set to the last day of the month, adjusted for week view
        const endOfMonthWeekStart = getStartOfWeek(currentMonthBounds.end);
        newDate.setTime(endOfMonthWeekStart.getTime());
      }
    } else { // today
      newDate.setDate(newDate.getDate() + 1);
      // Ensure we don't go past the end of current month
      if (newDate > currentMonthBounds.end) {
        return;
      }
    }
    setCurrentDate(newDate);
  };

  // Handle date change from calendar
  const handleDateChange = (date: Date | undefined) => {
    if (date && isDateInCurrentMonth(date)) {
      setCurrentDate(date);
      setTimePeriod("selected"); // Use "selected" instead of "today" for custom date selections
      setIsDatePickerOpen(false);
    }
  };

  // Function to calculate totals based on time period and current date
  const calculateTotals = useCallback(() => {
    const transactions = getTransactions();
    
    // Filter transactions by current time period
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.timestamp);
      
      if (timePeriod === "monthly") {
        return transactionDate >= currentMonthBounds.start && 
               transactionDate <= currentMonthBounds.end;
      }
      if (timePeriod === "weekly") {
        return transactionDate >= getStartOfWeek(currentDate) && 
               transactionDate <= getEndOfWeek(currentDate);
      }
      if (timePeriod === "today" || timePeriod === "selected") {
        return transactionDate >= getStartOfDay(currentDate) &&
               transactionDate <= getEndOfDay(currentDate);
      }
      return false;
    });

    // Calculate totals
    const debits = filteredTransactions
      .filter(t => t.type === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const credits = filteredTransactions
      .filter(t => t.type === "credit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    setTotalDebit(debits);
    setTotalCredit(credits);
    
    // Sort filtered transactions by timestamp (newest first)
    const sortedFilteredTransactions = [...filteredTransactions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, recentTransactionsLimit);
    
    // Set filtered transactions based on the current time period
    setFilteredTransactions(sortedFilteredTransactions);
    
    // Set recent transactions (last N based on limit) for all transactions regardless of filter
    setRecentTransactions(
      transactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, recentTransactionsLimit)
    );
  }, [timePeriod, currentDate, recentTransactionsLimit]);
  
  useEffect(() => {
    calculateTotals();
  }, [refreshTrigger, calculateTotals]);

  // Function to format transaction date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("default", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Generate time period label 
  const getTimePeriodLabel = () => {
    if (timePeriod === "monthly") {
      return formatMonthYear(currentMonthBounds.start);
    } else if (timePeriod === "weekly") {
      const weekStart = getStartOfWeek(currentDate);
      const weekEnd = getEndOfWeek(currentDate);
      return `${weekStart.toLocaleDateString('default', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('default', { day: 'numeric', month: 'short' })}`;
    } else {
      return currentDate.toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  // Get the transactions section label based on time period
  const getTransactionsSectionLabel = () => {
    if (timePeriod === "monthly") {
      return "Recent Transactions";
    } else if (timePeriod === "weekly") {
      const weekStart = getStartOfWeek(currentDate);
      const weekEnd = getEndOfWeek(currentDate);
      return `Transactions: ${weekStart.toLocaleDateString('default', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('default', { day: 'numeric', month: 'short' })}`;
    } else {
      return `Transactions: ${currentDate.toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  };

  // Check if navigation buttons should be disabled
  const isPreviousDisabled = () => {
    if (timePeriod === "monthly") {
      return true; // Always disable for monthly view
    } else if (timePeriod === "weekly") {
      const prevWeekStart = new Date(currentDate);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      return prevWeekStart < currentMonthBounds.start;
    } else { // today
      const prevDay = new Date(currentDate);
      prevDay.setDate(prevDay.getDate() - 1);
      return prevDay < currentMonthBounds.start;
    }
  };

  const isNextDisabled = () => {
    if (timePeriod === "monthly") {
      return true; // Always disable for monthly view
    } else if (timePeriod === "weekly") {
      const nextWeekStart = new Date(currentDate);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      return nextWeekStart > currentMonthBounds.end;
    } else { // today
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return nextDay > currentMonthBounds.end;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[hsl(var(--primary))]">Pocket Gemini Log</h1>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={goToPrevious} 
                    disabled={isPreviousDisabled()}
                    className={isPreviousDisabled() ? "opacity-50 cursor-not-allowed" : ""}
                    aria-label="Previous period"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous period</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <h2 className="text-sm font-medium text-secondary">
              {getTimePeriodLabel()}
            </h2>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={goToNext} 
                    disabled={isNextDisabled()}
                    className={isNextDisabled() ? "opacity-50 cursor-not-allowed" : ""}
                    aria-label="Next period"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next period</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        {/* Time period filter buttons with calendar icon aligned */}
        <div className="flex space-x-2 mt-2">
          <Button 
            variant={timePeriod === "monthly" ? "default" : "outline"} 
            size="sm"
            className="text-sm font-medium h-10 px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setTimePeriod("monthly")}
          >
            Month
          </Button>
          <Button 
            variant={timePeriod === "weekly" ? "default" : "outline"} 
            size="sm"
            className="text-sm font-medium h-10 px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setTimePeriod("weekly")}
          >
            Week
          </Button>
          <Button 
            variant={timePeriod === "today" ? "default" : "outline"} 
            size="sm"
            className="text-sm font-medium h-10 px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => {
              setTimePeriod("today");
              setCurrentDate(new Date()); // Reset to actual current day
            }}
          >
            Today
          </Button>
          <Button 
            variant={timePeriod === "selected" ? "default" : "outline"} 
            size="sm"
            className="text-sm font-medium h-10 px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex items-center"
            onClick={() => {
              setTimePeriod("selected");
              setIsDatePickerOpen(true);
            }}
          >
            <CalendarIcon className="h-3 w-3 mr-1" /> Custom
          </Button>
        </div>
      </div>

      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Date</DialogTitle>
            <DialogDescription>Choose a date within the current month.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={handleDateChange}
              initialFocus
              disabled={(date) => !isDateInCurrentMonth(date)}
              fromDate={currentMonthBounds.start}
              toDate={currentMonthBounds.end}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-4">
        {/* Outgoing Card */}
        <Card className="col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-secondary">
              Outgoing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-expense whitespace-nowrap overflow-hidden text-ellipsis">
              -₹{totalDebit.toFixed(0)}
            </p>
            {monthlyBudget > 0 && timePeriod === "monthly" && (
              <>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      monthlyBudget - totalDebit >= 0 ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--expense))]'
                    }`}
                    style={{ width: `${Math.min((totalDebit / monthlyBudget) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={monthlyBudget - totalDebit >= 0 ? 'text-[hsl(var(--primary))]' : 'text-expense'}>
                    ₹{(monthlyBudget - totalDebit).toFixed(2)} left
                  </span>
                  <span className="text-secondary">
                    {((totalDebit / monthlyBudget) * 100).toFixed(0)}% used
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Incoming Card */}
        <Card className="col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-secondary">
              Incoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-income whitespace-nowrap overflow-hidden text-ellipsis">
              +₹{totalCredit.toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-standard">{getTransactionsSectionLabel()}</h2>
        </div>
        
        <div className="space-y-4">
          {(timePeriod === "monthly" ? recentTransactions : filteredTransactions).length > 0 ? (
            (timePeriod === "monthly" ? recentTransactions : filteredTransactions).map(transaction => (
              <Card key={transaction.id} className="overflow-hidden">
                <div className="p-4 flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="text-base font-medium text-standard">{transaction.description}</div>
                    <div className="text-sm text-secondary">
                      <div className="flex items-center gap-2">
                        <span className="inline-block">
                          {getCategoryIcon(transaction.categoryId)}
                        </span>
                        {getCategoryNameById(transaction.categoryId)}
                      </div>
                      <div className="mt-2">{formatDate(transaction.timestamp)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <span className={`text-base font-semibold ${transaction.type === "debit" ? "text-expense" : "text-income"}`}>
                      {transaction.type === "debit" ? "-" : "+"}₹{transaction.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-center py-6 text-secondary text-sm font-normal">No transactions yet</p>
          )}
          
          {/* See more button moved to bottom of list */}
          {(timePeriod === "monthly" ? recentTransactions : filteredTransactions).length > 0 && (
            <div className="flex justify-center mt-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to={`/transactions?period=${timePeriod}&date=${currentDate.toISOString()}`}>
                      <Button variant="ghost" size="sm" className="text-[hsl(var(--primary))]" aria-label="See all transactions">
                        See more
                        <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View all transactions</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
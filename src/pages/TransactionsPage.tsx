import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Calendar, FilterX, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "@/context/TransactionContext";
import { getTransactions } from "@/utils/transactionStorage";
import { useLocation } from "react-router-dom";

// Lazy load the transaction list to improve initial page load
const TransactionList = lazy(() => import("@/components/TransactionList"));

// Time period types for filtering
type TimePeriod = "all" | "monthly" | "weekly" | "today" | "selected";

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

const formatDate = (date: Date): string => {
  return date.toLocaleString('default', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatMonthYear = (date: Date): string => {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const formatWeekRange = (date: Date): string => {
  const start = getStartOfWeek(date);
  const end = getEndOfWeek(date);
  return `${start.getDate()} ${start.toLocaleString('default', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('default', { month: 'short' })}`;
};

const TransactionsPage = () => {
  const { refreshTrigger } = useTransactions();
  const location = useLocation();
  
  // Parse URL parameters
  const queryParams = new URLSearchParams(location.search);
  const urlPeriod = queryParams.get('period');
  const urlDate = queryParams.get('date');
  
  // Initialize state with URL parameters if available
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(
    urlPeriod === "monthly" || urlPeriod === "weekly" || urlPeriod === "today" || urlPeriod === "selected"
      ? urlPeriod
      : "monthly"
  );
  const [currentDate, setCurrentDate] = useState(
    urlDate ? new Date(urlDate) : new Date()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    debitTotal: number;
    creditTotal: number;
    isSearching: boolean;
  }>({ debitTotal: 0, creditTotal: 0, isSearching: false });

  // Calculate totals based on the current time period and date
  const calculateTotals = useCallback(() => {
    const transactions = getTransactions();
    
    // Filter transactions by current time period
    let filteredTransactions = transactions;
    
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
      
      filteredTransactions = transactions.filter((txn) => 
        txn.timestamp >= startDate.getTime() && txn.timestamp <= endDate.getTime()
      );
    }
    
    // Calculate totals
    const debit = filteredTransactions
      .filter(t => t.type === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const credit = filteredTransactions
      .filter(t => t.type === "credit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    setTotalDebit(debit);
    setTotalCredit(credit);
  }, [timePeriod, currentDate]);
  
  // Update totals when component mounts, refreshTrigger changes, or period/date changes
  useEffect(() => {
    calculateTotals();
  }, [refreshTrigger, timePeriod, currentDate, calculateTotals]);

  const handleDateChange = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (timePeriod === "monthly") {
      newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1));
    } else if (timePeriod === "weekly") {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7));
    } else if (timePeriod === "today") {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Transactions</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">
              {searchResults.isSearching ? "Filtered Outgoing" : "Total Outgoing"}
              {searchResults.isSearching && <span className="text-xs ml-1">(Search)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive whitespace-nowrap overflow-hidden text-ellipsis">
              -₹{(searchResults.isSearching ? searchResults.debitTotal : totalDebit).toFixed(0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">
              {searchResults.isSearching ? "Filtered Incoming" : "Total Incoming"}
              {searchResults.isSearching && <span className="text-xs ml-1">(Search)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary whitespace-nowrap overflow-hidden text-ellipsis">
              +₹{(searchResults.isSearching ? searchResults.creditTotal : totalCredit).toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-4">
        {timePeriod !== "all" && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={() => handleDateChange("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              {timePeriod === "monthly" && formatMonthYear(currentDate)}
              {timePeriod === "weekly" && formatWeekRange(currentDate)}
              {timePeriod === "today" && formatDate(currentDate)}
            </div>
            <Button variant="outline" size="icon" onClick={() => handleDateChange("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {timePeriod === "all" && <div />} {/* Empty div to maintain flex spacing */}
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="today">Today</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transactions..."
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSearchQuery("")}
          title="Clear search"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <Suspense fallback={
        <div className="space-y-4">
          <Skeleton className="h-[70px] w-full rounded-md" />
          <Skeleton className="h-[70px] w-full rounded-md" />
          <Skeleton className="h-[70px] w-full rounded-md" />
        </div>
      }>
        <TransactionList
          refreshTrigger={refreshTrigger}
          onUpdate={() => {}}
          timePeriod={timePeriod}
          currentDate={currentDate}
          onSearchResults={(debitTotal, creditTotal, transactions) => {
            setSearchResults({
              debitTotal,
              creditTotal,
              isSearching: searchQuery.trim() !== ""
            });
          }}
          searchQuery={searchQuery}
          showControls={false}
        />
      </Suspense>
    </div>
  );
};

export default TransactionsPage;
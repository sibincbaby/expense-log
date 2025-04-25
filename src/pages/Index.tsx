import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import TransactionForm from "@/components/TransactionForm";
import { getTransactions } from "@/utils/transactionStorage";
import { 
  HelpCircle, 
  Settings as SettingsIcon, 
  Plus as PlusIcon, 
  Trash2 as TrashIcon,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Edit as EditIcon
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  getCommonTransactions, 
  saveCommonTransaction, 
  removeCommonTransaction,
  getCategories,
  addCategory,
  removeCategory,
  getCategoryNameById,
  getCategoryIcon,
  setCategoryIcon,
  updateCategory
} from "@/utils/geminiStorage";
import { preloadApiConnections, resetApiConnections, warmUpNewlySelectedApi } from "@/utils/geminiApi";
import IconPicker from "@/components/IconPicker";

// Time period types for filtering
type TimePeriod = "all" | "monthly" | "weekly" | "today";

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
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
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

// Lazy load the transaction list to improve initial page load
const TransactionList = lazy(() => import("@/components/TransactionList"));

const Index = () => {
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem("geminiApiKey") || "AIzaSyDo5DOhvf50mKAEWEkyAGmD3VJlIyCKphk";
  });
  const [claudeApiKey, setClaudeApiKey] = useState(() => {
    return localStorage.getItem("claudeApiKey") || "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";
  });
  const [useClaudeApi, setUseClaudeApi] = useState(() => {
    return localStorage.getItem("useClaudeApi") === "true";
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [activeTab, setActiveTab] = useState("add");
  const [commonTransactions, setCommonTransactions] = useState(getCommonTransactions());
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"debit" | "credit">("debit");
  const [newCategory, setNewCategory] = useState("");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("monthly"); // Changed default to monthly
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchResults, setSearchResults] = useState<{
    debitTotal: number;
    creditTotal: number;
    isSearching: boolean;
  }>({ debitTotal: 0, creditTotal: 0, isSearching: false });
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    return parseFloat(localStorage.getItem("monthlyBudget") || "0") || 0;
  });
  const [categories, setCategories] = useState<CategoryItem[]>(() => getCategories());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newIcon, setNewIcon] = useState("📦");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState("");
  const [editedIcon, setEditedIcon] = useState("📦");
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const isMobile = useIsMobile();
  
  // Use memoized callback for better performance
  const calculateTotals = useCallback(() => {
    const transactions = getTransactions();
    const filteredTransactions = transactions.filter(t => {
      if (timePeriod === "all") return true;
      
      // Use timestamp property instead of date
      const transactionDate = new Date(t.timestamp);
      
      if (timePeriod === "monthly") {
        return transactionDate >= getStartOfMonth(currentDate) && 
               transactionDate <= getEndOfMonth(currentDate);
      }
      if (timePeriod === "weekly") {
        return transactionDate >= getStartOfWeek(currentDate) && 
               transactionDate <= getEndOfWeek(currentDate);
      }
      if (timePeriod === "today") {
        return transactionDate >= getStartOfDay(currentDate) &&
               transactionDate <= getEndOfDay(currentDate);
      }
      return false;
    });

    const debits = filteredTransactions
      .filter(t => t.type === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const credits = filteredTransactions
      .filter(t => t.type === "credit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    setTotalDebit(debits);
    setTotalCredit(credits);
  }, [timePeriod, currentDate]);
  
  useEffect(() => {
    localStorage.setItem("geminiApiKey", geminiApiKey);
  }, [geminiApiKey]);
  
  useEffect(() => {
    localStorage.setItem("claudeApiKey", claudeApiKey);
  }, [claudeApiKey]);
  
  useEffect(() => {
    localStorage.setItem("useClaudeApi", useClaudeApi.toString());
  }, [useClaudeApi]);
  
  useEffect(() => {
    localStorage.setItem("monthlyBudget", monthlyBudget.toString());
  }, [monthlyBudget]);

  useEffect(() => {
    // Use requestIdleCallback for non-critical calculations
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => calculateTotals());
    } else {
      // Fallback for browsers that don't support requestIdleCallback
      setTimeout(calculateTotals, 10);
    }
  }, [refreshTrigger, calculateTotals]);

  useEffect(() => {
    // Preload API connections when keys are available
    preloadApiConnections(geminiApiKey, claudeApiKey);
  }, [geminiApiKey, claudeApiKey]);
  
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const saveApiKey = () => {
    localStorage.setItem("geminiApiKey", geminiApiKey);
    localStorage.setItem("claudeApiKey", claudeApiKey);
    localStorage.setItem("useClaudeApi", useClaudeApi.toString());
    localStorage.setItem("monthlyBudget", monthlyBudget.toString());
    
    // Reset API connections to force immediate effect of model switching
    resetApiConnections();
    
    // Warm up only the newly selected API
    warmUpNewlySelectedApi(useClaudeApi);
    
    // Dispatch custom event to notify components about model change
    window.dispatchEvent(new Event("model-change"));
    
    toast.success(`Switched to ${useClaudeApi ? "Claude 3 Haiku" : "Gemini 2.0 Flash Lite"}`);
  };

  const updateCommonTransactions = () => {
    setCommonTransactions(getCommonTransactions());
  };

  const handleAddCommonTransaction = () => {
    if (!newDescription.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!newCategory.trim()) {
      toast.error("Category is required");
      return;
    }

    const transactionData = {
      description: newDescription,
      type: newType,
      category: newCategory
    };

    // Only add amount if provided
    if (newAmount.trim()) {
      const amount = parseFloat(newAmount);
      if (!isNaN(amount)) {
        saveCommonTransaction({
          ...transactionData,
          amount
        });
      } else {
        toast.error("Amount must be a valid number");
        return;
      }
    } else {
      saveCommonTransaction(transactionData);
    }

    setNewDescription("");
    setNewAmount("");
    setNewCategory("");
    updateCommonTransactions();
    toast.success(`Added '${newDescription}' to common transactions`);
  };

  const handleRemoveCommonTransaction = (description: string) => {
    removeCommonTransaction(description);
    updateCommonTransactions();
    toast.success(`Removed '${description}' from common transactions`);
  };

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
    <div className="container max-w-3xl mx-auto py-4 px-3 sm:py-6 sm:px-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-primary">Pocket Gemini Log</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">AI-powered transaction tracking</p>
        </div>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background p-4">
            <DrawerHeader className="p-0">
              <DrawerTitle>Settings</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-4 my-4">
              {/* Manage Common Transactions moved to top */}
              <div className="space-y-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button 
                      variant="default" 
                      className="w-full"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Manage Common Transactions
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md">
                    
                    <div className="my-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newDescription">Add New Common Transaction</Label>
                        <div className="grid gap-2">
                          <Input
                            id="newDescription"
                            placeholder="Description (e.g., coffee)"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                          />
                          
                          <Input
                            id="newAmount"
                            type="number"
                            placeholder="Amount (optional)"
                            value={newAmount}
                            onChange={(e) => setNewAmount(e.target.value)}
                          />
                          
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as "debit" | "credit")}
                          >
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                          
                          <div className="relative">
                            <input
                              id="newCategory"
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:ring-1 focus:ring-primary"
                              placeholder="Search or select a category"
                              value={newCategory}
                              onChange={(e) => setNewCategory(e.target.value)}
                              list="categoryOptions"
                            />
                            <datalist id="categoryOptions">
                              {getCategories().map((category) => (
                                <option key={category.id} value={category.name} />
                              ))}
                            </datalist>
                          </div>
                          
                          <Button 
                            onClick={handleAddCommonTransaction}
                            variant="default"
                            className="w-full"
                          >
                            <PlusIcon className="h-4 w-4 mr-2" /> Add Transaction
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Your Common Transactions</Label>
                        <div className="max-h-72 overflow-y-auto border rounded-md">
                          {Object.entries(commonTransactions).length > 0 ? (
                            <ul className="divide-y">
                              {Object.entries(commonTransactions).map(([desc, transaction]) => (
                                <li key={desc} className="p-3 text-sm flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">{transaction.description}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {getCategoryNameById(transaction.categoryId)} • 
                                      <span className={transaction.type === "debit" ? " text-destructive" : " text-primary"}>
                                        {transaction.type === "debit" ? " -" : " +"}
                                        {transaction.amount !== undefined ? `₹${transaction.amount}` : " No amount"}
                                      </span>
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleRemoveCommonTransaction(desc)}
                                  >
                                    <TrashIcon className="h-4 w-4 text-destructive" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="p-4 text-center text-muted-foreground">No common transactions added yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <SheetFooter className="mt-6 flex flex-col gap-2">
                      <SheetClose asChild>
                        <Button variant="default" className="w-full">Done</Button>
                      </SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Manage Categories Button */}
              <div className="space-y-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button 
                      variant="default" 
                      className="w-full"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Manage Categories
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>Manage Categories</SheetTitle>
                    </SheetHeader>
                    
                    <div className="my-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newCategoryName">Add New Category</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            id="newCategoryName"
                            placeholder="New category name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1"
                          />
                          <IconPicker
                            selectedIcon="📦"
                            onIconSelect={(icon) => setNewIcon(icon)}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (newCategoryName.trim()) {
                              // First add the category to get its ID
                              addCategory(newCategoryName.trim());
                              // Get all categories to find the new one
                              const updatedCategories = getCategories();
                              const newCategory = updatedCategories.find(c => c.name === newCategoryName.trim());
                              if (newCategory) {
                                // Set the selected icon for the new category
                                setCategoryIcon(newCategory.id, newIcon);
                              }
                              setCategories(updatedCategories);
                              setNewCategoryName("");
                              setNewIcon("📦"); // Reset to default
                              toast.success(`Category '${newCategoryName}' added`);
                            } else {
                              toast.error("Category name cannot be empty");
                            }
                          }}
                          variant="default"
                          className="w-full"
                        >
                          <PlusIcon className="h-4 w-4 mr-2" /> Add Category
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Your Categories</Label>
                        <div className="max-h-72 overflow-y-auto border rounded-md">
                          {categories.length > 0 ? (
                            <ul className="divide-y">
                              {categories.map((category) => (
                                <li key={category.id} className="p-3 text-sm flex items-center justify-between gap-2">
                                  {editingCategoryId === category.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <Input
                                        autoFocus
                                        value={editedCategoryName}
                                        onChange={(e) => setEditedCategoryName(e.target.value)}
                                        className="flex-1"
                                      />
                                      <IconPicker
                                        selectedIcon={editedIcon}
                                        onIconSelect={(icon) => setEditedIcon(icon)}
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-1">
                                      <span>{getCategoryIcon(category.id)}</span>
                                      <span>{category.name}</span>
                                    </div>
                                  )}
                                  <div className="flex space-x-2">
                                    {editingCategoryId === category.id ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (editedCategoryName.trim()) {
                                              if (updateCategory(category.id, editedCategoryName.trim())) {
                                                setCategoryIcon(category.id, editedIcon);
                                                toast.success(`Category updated to '${editedCategoryName.trim()}'`);
                                                setCategories(getCategories());
                                              } else {
                                                toast.error("Category name already exists");
                                              }
                                            } else {
                                              toast.error("Category name cannot be empty");
                                            }
                                            setEditingCategoryId(null);
                                            setEditedCategoryName("");
                                            setEditedIcon("📦");
                                          }}
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingCategoryId(null);
                                            setEditedCategoryName("");
                                            setEditedIcon("📦");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingCategoryId(category.id);
                                            setEditedCategoryName(category.name);
                                            setEditedIcon(getCategoryIcon(category.id));
                                          }}
                                          className="text-primary"
                                        >
                                          <EditIcon className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setDeletingCategoryId(category.id)}
                                          className="text-destructive"
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="p-4 text-center text-muted-foreground">No categories added yet</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Confirmation Dialog for Category Deletion */}
                      {deletingCategoryId !== null && (
                        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
                            <h3 className="text-lg font-medium mb-4">Confirm Deletion</h3>
                            <p className="mb-6 text-muted-foreground">
                              Are you sure you want to delete this category? This will affect all transactions using this category.
                            </p>
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                onClick={() => setDeletingCategoryId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  const categoryName = getCategoryNameById(deletingCategoryId);
                                  removeCategory(deletingCategoryId);
                                  setCategories(getCategories());
                                  toast.success(`Category '${categoryName}' removed`);
                                  setDeletingCategoryId(null);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <SheetFooter className="mt-6 flex flex-col gap-2">
                      <SheetClose asChild>
                        <Button variant="default" className="w-full">Done</Button>
                      </SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
              
              {/* AI Model Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="useClaudeApi">Use Claude 3 Haiku</Label>
                  <Switch 
                    id="useClaudeApi" 
                    checked={useClaudeApi} 
                    onCheckedChange={setUseClaudeApi}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Switch between Gemini and Claude AI for analyzing transactions</p>
              </div>
              
              {/* Gemini API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Enter your Gemini API key here. The default key may have usage limitations.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  disabled={useClaudeApi}
                  className={useClaudeApi ? "opacity-50" : ""}
                />
                <p className="text-xs text-muted-foreground">Used when Claude API is not selected</p>
              </div>
              
              {/* Claude API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="claudeApiKey">Claude API Key</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Enter your Anthropic Claude API key here.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="claudeApiKey"
                  type="password"
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  placeholder="Enter your Claude API key"
                  disabled={!useClaudeApi}
                  className={!useClaudeApi ? "opacity-50" : ""}
                />
                <p className="text-xs text-muted-foreground">Required when using Claude API</p>
              </div>
              
              {/* Monthly Budget Setting */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="monthlyBudget">Monthly Budget</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Set your monthly spending budget to track remaining funds</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="monthlyBudget"
                  type="number"
                  value={monthlyBudget === 0 ? "" : monthlyBudget.toString()}
                  onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
                  placeholder="Enter your monthly budget"
                />
                <p className="text-xs text-muted-foreground">Set to 0 to disable budget tracking</p>
              </div>
            </div>
            <DrawerFooter className="p-0 pt-2">
              <div className="space-y-2 w-full">
                <Button onClick={saveApiKey} className="w-full">Save Settings</Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">Cancel</Button>
                </DrawerClose>
              </div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground flex justify-between items-center">
              <span>
                {searchResults.isSearching ? "Filtered Outgoing" : "Total Outgoing"}
                {searchResults.isSearching && <span className="text-xs ml-1">(Search Results)</span>}
              </span>
              {monthlyBudget > 0 && timePeriod === "monthly" && !searchResults.isSearching && (
                <span className="text-xs font-normal">Budget: ₹{monthlyBudget.toFixed(2)}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-destructive">
              -₹{(searchResults.isSearching ? searchResults.debitTotal : totalDebit).toFixed(2)}
            </p>
            
            {/* Budget information, only shown when monthly budget is set and in monthly view and not searching */}
            {monthlyBudget > 0 && timePeriod === "monthly" && !searchResults.isSearching && (() => {
              const remaining = monthlyBudget - totalDebit;
              const percentSpent = (totalDebit / monthlyBudget) * 100;
              return (
                <>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${remaining >= 0 ? 'bg-primary' : 'bg-destructive'}`}
                      style={{ width: `${Math.min(percentSpent, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={remaining >= 0 ? 'text-primary' : 'text-destructive'}>
                      Remaining: ₹{remaining.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">{percentSpent.toFixed(0)}% used</span>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">
              {searchResults.isSearching ? "Filtered Incoming" : "Total Incoming"}
              {searchResults.isSearching && <span className="text-xs ml-1">(Search Results)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              +₹{(searchResults.isSearching ? searchResults.creditTotal : totalCredit).toFixed(2)}
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
      
      <Tabs 
        defaultValue="add" 
        className="mb-6"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="add">Add Transaction</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>
        <TabsContent value="add" className="mt-3">
          <TransactionForm 
            apiKey={geminiApiKey} 
            claudeApiKey={claudeApiKey}
            useClaudeApi={useClaudeApi}
            onTransactionAdded={handleRefresh} 
          />
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <Suspense fallback={
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-8 w-[150px]" />
                <Skeleton className="h-8 w-[120px]" />
              </div>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[70px] w-full rounded-md" />
              ))}
            </div>
          }>
            <TransactionList 
              refreshTrigger={refreshTrigger} 
              onUpdate={handleRefresh} 
              timePeriod={timePeriod}
              currentDate={currentDate}
              onSearchResults={(debitTotal, creditTotal, transactions) => {
                setSearchResults({
                  debitTotal,
                  creditTotal,
                  isSearching: transactions.length < getTransactions().length
                });
              }}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
      
      <div className="text-center text-muted-foreground text-xs mt-6">
        <p>
          Powered by {useClaudeApi ? "Claude 3 Haiku" : "Gemini 2.0 Flash Lite"} API
        </p>
        <p>All data is stored locally in your browser</p>
      </div>
    </div>
  );
};

export default Index;

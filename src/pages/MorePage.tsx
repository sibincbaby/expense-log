import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { PlusIcon, TrashIcon, Settings, HelpCircle, User, Key, Pencil, Tags, Clock } from "lucide-react";
import { toast } from "sonner";
import { 
  getCommonTransactions, 
  saveCommonTransaction, 
  removeCommonTransaction, 
  getCategories, 
  getCategoryNameById, 
  getCategoryIcon,
  CategoryItem,
  addCategory,
  removeCategory,
  updateCategory,
  setCategoryIcon,
  AVAILABLE_ICONS
} from "@/utils/geminiStorage";
import { resetApiConnections, warmUpNewlySelectedApi } from "@/utils/geminiApi";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import IconPicker from "@/components/IconPicker";
import { useTransactions } from "@/context/TransactionContext";
import { Slider } from "@/components/ui/slider";

const MorePage = () => {
  const { refreshTransactions } = useTransactions();
  
  // API Keys state - only keeping the toggle
  const [useClaudeApi, setUseClaudeApi] = useState(() => {
    return localStorage.getItem("useClaudeApi") === "true";
  });
  
  // Budget state
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    return parseFloat(localStorage.getItem("monthlyBudget") || "0") || 0;
  });
  
  // Recent transactions limit state
  const [recentTransactionsLimit, setRecentTransactionsLimit] = useState(() => {
    return parseInt(localStorage.getItem("recentTransactionsLimit") || "5") || 5;
  });
  
  // Common transactions states
  const [commonTransactions, setCommonTransactions] = useState(getCommonTransactions());
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"debit" | "credit">("debit");
  const [newCategory, setNewCategory] = useState("");

  // Categories states
  const [categories, setCategories] = useState<CategoryItem[]>(getCategories());
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryForIcon, setSelectedCategoryForIcon] = useState<CategoryItem | null>(null);
  const [newCategoryIcon, setNewCategoryIcon] = useState(AVAILABLE_ICONS[0]);
  const [showIconPickerForNew, setShowIconPickerForNew] = useState(false);

  // Load categories
  useEffect(() => {
    setCategories(getCategories());
  }, []);

  const saveSettings = () => {
    // Save settings to localStorage
    localStorage.setItem("useClaudeApi", useClaudeApi.toString());
    localStorage.setItem("monthlyBudget", monthlyBudget.toString());
    localStorage.setItem("recentTransactionsLimit", recentTransactionsLimit.toString());
    
    // Reset API connections for the previous model
    resetApiConnections();
    
    // Warm up only the newly selected API
    warmUpNewlySelectedApi(useClaudeApi);
    
    // Dispatch a custom event to notify components that the model has changed
    window.dispatchEvent(new Event("model-change"));
    
    toast.success(`Switched to ${useClaudeApi ? "Claude 3 Haiku" : "Gemini 2.0 Flash Lite"}`);
    refreshTransactions(); // Refresh transactions to apply new settings
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

  // Category management functions
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    const newCategoryId = addCategory(newCategoryName);
    if (newCategoryId !== null) {
      // Successfully added category, now set the icon
      setCategoryIcon(newCategoryId, newCategoryIcon);
      setCategories(getCategories());
      setNewCategoryName("");
      setNewCategoryIcon(AVAILABLE_ICONS[0]);
      toast.success(`Added '${newCategoryName}' category`);
      refreshTransactions();
    } else {
      toast.error("Failed to add category. The name might already be in use.");
    }
  };

  const handleEditCategory = (category: CategoryItem) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    const success = updateCategory(editingCategory.id, newCategoryName);
    
    if (success) {
      setCategories(getCategories());
      setEditingCategory(null);
      setNewCategoryName("");
      toast.success(`Updated category name to '${newCategoryName}'`);
      refreshTransactions();
    } else {
      toast.error("Failed to update category. The name might already be in use.");
    }
  };

  const handleRemoveCategory = (categoryId: number) => {
    if (categoryId <= 15) {
      toast.error("Cannot delete default categories");
      return;
    }

    // Confirm before deleting
    if (confirm(`Are you sure you want to delete this category? Transactions using this category will be set to "Miscellaneous".`)) {
      removeCategory(categoryId);
      setCategories(getCategories());
      toast.success("Category deleted");
      refreshTransactions();
    }
  };

  const handleSelectIconForCategory = (category: CategoryItem) => {
    setSelectedCategoryForIcon(category);
  };

  const handleSetCategoryIcon = (icon: string) => {
    if (!selectedCategoryForIcon) return;
    
    setCategoryIcon(selectedCategoryForIcon.id, icon);
    setSelectedCategoryForIcon(null);
    toast.success("Category icon updated");
    refreshTransactions();
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-xl font-semibold mb-4">Settings</h1>
      </div>

      {/* Quick Settings Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* AI Model Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Use Claude 3 Haiku</Label>
              <p className="text-xs text-muted-foreground">Switch between Gemini and Claude AI</p>
            </div>
            <Switch 
              checked={useClaudeApi} 
              onCheckedChange={setUseClaudeApi}
            />
          </div>
          
          {/* Monthly Budget */}
          <div className="space-y-2">
            <Label htmlFor="monthlyBudget" className="text-sm font-medium">Monthly Budget</Label>
            <Input
              id="monthlyBudget"
              type="number"
              value={monthlyBudget === 0 ? "" : monthlyBudget.toString()}
              onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
              placeholder="Enter your monthly budget"
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">Set to 0 to disable budget tracking</p>
          </div>

          {/* Recent Transactions Limit Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="recentTransactionsLimit" className="text-sm font-medium">Recent Transactions Limit</Label>
              <span className="text-sm font-medium bg-muted px-2 py-0.5 rounded-full">
                {recentTransactionsLimit}
              </span>
            </div>
            <Slider
              id="recentTransactionsLimit"
              defaultValue={[recentTransactionsLimit]}
              max={50}
              min={5}
              step={1}
              className="my-2"
              onValueChange={(values) => setRecentTransactionsLimit(values[0])}
            />
            <p className="text-xs text-muted-foreground">Set the number of recent transactions to display on the home page</p>
          </div>

          <Button onClick={saveSettings} className="w-full mt-2">Save Settings</Button>
        </CardContent>
      </Card>

      {/* Categories Management Section */}
      <div className="space-y-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center">
                <Tags className="h-4 w-4 mr-2" />
                <span>Manage Categories</span>
              </div>
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                {categories.length}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Categories</SheetTitle>
            </SheetHeader>
            
            <div className="my-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newCategoryName">Add New Category</Label>
                <div className="flex gap-2 items-center">
                  {/* Icon picker button for new category */}
                  <div className="flex-none">
                    <Button
                      variant="outline" 
                      size="icon" 
                      className="h-9 w-9 text-lg"
                      onClick={() => setShowIconPickerForNew(true)}
                    >
                      {newCategoryIcon}
                    </Button>
                  </div>
                  
                  {/* Category name input */}
                  <Input
                    id="newCategoryName"
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1"
                  />
                  
                  {/* Add category button */}
                  <Button 
                    onClick={handleAddCategory}
                    variant="default"
                    className="flex-none"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Your Categories</Label>
                <div className="max-h-72 overflow-y-auto border rounded-md">
                  {categories.length > 0 ? (
                    <ul className="divide-y">
                      {categories.map((category) => (
                        <li key={category.id} className="p-3 text-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Category Icon */}
                            <div 
                              className="w-8 h-8 flex items-center justify-center bg-accent rounded-md cursor-pointer"
                              onClick={() => handleSelectIconForCategory(category)}
                            >
                              {getCategoryIcon(category.id)}
                            </div>
                            
                            {/* Category Name */}
                            <span>{category.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {/* Edit Button */}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            
                            {/* Delete Button (only for non-default categories) */}
                            {category.id > 15 && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleRemoveCategory(category.id)}
                              >
                                <TrashIcon className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-4 text-center text-muted-foreground">No categories found</p>
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

      {/* Common Transactions Section */}
      <div className="space-y-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center">
                <PlusIcon className="h-4 w-4 mr-2" />
                <span>Manage Common Transactions</span>
              </div>
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                {Object.keys(commonTransactions).length}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Common Transactions</SheetTitle>
            </SheetHeader>
            
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
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as "debit" | "credit")}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                  
                  <div className="relative">
                    <select
                      id="newCategory"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      placeholder="Select a category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="" disabled>Select a category</option>
                      {getCategories().map((category) => (
                        <option key={category.id} value={category.name}>{category.name}</option>
                      ))}
                    </select>
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

      {/* Category Edit Dialog */}
      <Dialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCategoryName">Category Name</Label>
              <Input
                id="editCategoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateCategory}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Icon Selection Dialog */}
      <Dialog
        open={!!selectedCategoryForIcon}
        onOpenChange={(open) => !open && setSelectedCategoryForIcon(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Select Icon for {selectedCategoryForIcon?.name}
            </DialogTitle>
            <DialogDescription>
              Choose an icon that best represents this category.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedCategoryForIcon && (
              <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_ICONS.map((icon) => (
                  <Button
                    key={icon}
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 text-lg hover:bg-accent ${
                      getCategoryIcon(selectedCategoryForIcon.id) === icon ? "bg-accent/80 ring-2 ring-primary" : ""
                    }`}
                    onClick={() => {
                      handleSetCategoryIcon(icon);
                    }}
                  >
                    {icon}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New category icon selection dialog */}
      <Dialog
        open={showIconPickerForNew}
        onOpenChange={setShowIconPickerForNew}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Select Icon for New Category
            </DialogTitle>
            <DialogDescription>
              Choose an icon that best represents this category.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-6 gap-2">
              {AVAILABLE_ICONS.map((icon) => (
                <Button
                  key={icon}
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 text-lg hover:bg-accent ${
                    newCategoryIcon === icon ? "bg-accent/80 ring-2 ring-primary" : ""
                  }`}
                  onClick={() => {
                    setNewCategoryIcon(icon);
                    setShowIconPickerForNew(false);
                  }}
                >
                  {icon}
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="text-center text-muted-foreground text-xs mt-6">
        <p>Powered by {useClaudeApi ? "Claude 3 Haiku" : "Gemini 2.0 Flash Lite"} API</p>
        <p>All data is stored locally in your browser</p>
        <p className="mt-1">Version 1.0.0</p>
      </div>
    </div>
  );
};

export default MorePage;
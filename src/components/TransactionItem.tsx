import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Transaction, deleteTransaction } from "@/utils/transactionStorage";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 as TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { getCategoryNameById, getCategoryIcon } from "@/utils/geminiStorage";
import { useTransactions } from "@/context/TransactionContext";

interface TransactionItemProps {
  transaction: Transaction;
  onDelete: () => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onDelete }) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { refreshTransactions } = useTransactions(); // Get the global refresh function
  const [isHovered, setIsHovered] = useState(false);
  
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("default", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDelete = () => {
    try {
      deleteTransaction(transaction.id);
      toast.success("Transaction deleted");
      
      // Call both the local onDelete and global refreshTransactions
      onDelete();
      refreshTransactions(); // This will trigger updates across all components
    } catch (error) {
      toast.error("Could not delete transaction");
    }
    setIsAlertOpen(false);
  };

  // Get category icon for this transaction
  const categoryIcon = getCategoryIcon(transaction.categoryId);

  // Determine amount display styling using our new color variables
  const amountColorClass = transaction.type === "debit" 
    ? "text-expense" 
    : "text-income";

  return (
    <Card 
      className={`overflow-hidden transition-all duration-300 animate-scale-in hover:shadow-elevation-2 ${
        isHovered ? 'border-primary/30 bg-card/90' : 'border-border bg-card'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-4 flex justify-between items-start">
        <div className="space-y-2">
          <div className="font-medium text-standard transition-all duration-200">
            {transaction.description}
          </div>
          <div className="text-sm text-secondary flex flex-col gap-2">
            <div className="flex items-center gap-2 transition-all duration-200">
              <span className={`inline-block transition-transform ${isHovered ? 'scale-110' : ''}`}>
                {categoryIcon}
              </span>
              {getCategoryNameById(transaction.categoryId)}
            </div>
            <div className="text-xs">{formatDate(transaction.timestamp)}</div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <span className={`text-lg font-semibold transition-all duration-200 ${amountColorClass} ${isHovered ? 'scale-105' : ''}`}>
            {transaction.type === "debit" ? "-" : "+"}₹{transaction.amount.toFixed(2)}
          </span>
          
          <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                size="sm" 
                variant="ghost" 
                className={`h-8 w-8 p-0 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-70'}`} 
                title="Delete transaction"
              >
                <TrashIcon className={`h-4 w-4 transition-colors duration-300 ${isHovered ? 'text-destructive' : 'text-secondary'}`} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the transaction.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline" onClick={() => setIsAlertOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} className="transition-all duration-200 hover:brightness-110">
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
};

export default TransactionItem;

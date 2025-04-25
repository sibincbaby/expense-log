import React, { createContext, useContext, useState } from 'react';

interface TransactionContextType {
  refreshTrigger: number;
  refreshTransactions: () => void;
}

const TransactionContext = createContext<TransactionContextType>({
  refreshTrigger: 0,
  refreshTransactions: () => {}
});

export const useTransactions = () => useContext(TransactionContext);

export const TransactionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshTransactions = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <TransactionContext.Provider value={{ refreshTrigger, refreshTransactions }}>
      {children}
    </TransactionContext.Provider>
  );
};
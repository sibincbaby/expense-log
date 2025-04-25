import { Home, BarChart2, Settings, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface BottomNavProps {
  onAddClick?: () => void;
}

const BottomNav = ({ onAddClick }: BottomNavProps) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [showAddButtonEffect, setShowAddButtonEffect] = useState(false);
  const isMobile = useIsMobile();

  // Helper function to determine if a nav item is active
  const isActive = (path: string) => {
    if (path === '/' && currentPath === '/') return true;
    if (path !== '/' && currentPath.startsWith(path)) return true;
    return false;
  };

  // Add a pulsing animation to the Add button when first loaded
  useEffect(() => {
    setShowAddButtonEffect(true);
    const timer = setTimeout(() => {
      setShowAddButtonEffect(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={onAddClick}
        className={`fixed bottom-20 right-4 z-20
          rounded-full bg-primary text-white 
          py-3 px-5
          flex items-center space-x-2
          shadow-lg transition-all duration-300 
          hover:shadow-xl hover:scale-105 
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          showAddButtonEffect ? 'animate-bounce-soft' : ''
        }`}
      >
        <Plus className="icon-md" />
        <span className="text-sm font-medium">Add Transaction</span>
      </button>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 z-10 px-4 
        h-16
        pb-safe 
        transition-all duration-200">
        <div className="max-w-md mx-auto h-full flex items-center justify-around">
          {/* Home */}
          <Link 
            to="/" 
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/') 
                ? 'text-white' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className={`flex flex-col items-center p-1 ${isActive('/') ? 'bg-primary rounded-full px-4 py-1' : ''}`}>
              <Home className="icon-md" />
              <span className="text-xs mt-1 font-medium">Home</span>
            </div>
          </Link>
          
          {/* Spacer for visual balance */}
          <div className="w-12 md:w-14"></div>
          
          {/* Transactions */}
          <Link 
            to="/transactions" 
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/transactions') 
                ? 'text-white' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className={`flex flex-col items-center p-1 ${isActive('/transactions') ? 'bg-primary rounded-full px-4 py-1' : ''}`}>
              <BarChart2 className="icon-md" />
              <span className="text-xs mt-1 font-medium">Transactions</span>
            </div>
          </Link>
          
          {/* More (Settings) */}
          <Link 
            to="/more" 
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/more') 
                ? 'text-white' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className={`flex flex-col items-center p-1 ${isActive('/more') ? 'bg-primary rounded-full px-4 py-1' : ''}`}>
              <Settings className="icon-md" />
              <span className="text-xs mt-1 font-medium">More</span>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
};

export default BottomNav;
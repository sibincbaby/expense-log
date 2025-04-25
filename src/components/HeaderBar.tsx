import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';

interface HeaderBarProps {
  title?: string;
  showBackButton?: boolean;
  showProfileButton?: boolean;
  onProfileClick?: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ 
  title = "Pocket Gemini Log",
  showBackButton = true,
  showProfileButton = true,
  onProfileClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBackClick = () => {
    if (location.pathname !== '/') {
      navigate(-1);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 shadow-sm px-4">
      <div className="max-w-md mx-auto h-full flex items-center justify-between">
        {/* Back Button (Left) */}
        <div className="w-10 flex items-center justify-start">
          {showBackButton && location.pathname !== '/' && (
            <button
              onClick={handleBackClick}
              className="p-2 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {/* Title (Center) */}
        <h1 className="text-xl font-semibold text-gray-900 flex-1 text-center">
          {title}
        </h1>
        
        {/* Profile Button (Right) */}
        <div className="w-10 flex items-center justify-end">
          {showProfileButton && (
            <button
              onClick={onProfileClick}
              className="p-2 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Profile"
            >
              <User className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
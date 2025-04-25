import React, { useState } from 'react';
import { Button } from './ui/button';
import { AVAILABLE_ICONS } from '@/utils/geminiStorage';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface IconPickerProps {
  selectedIcon: string;
  onIconSelect: (icon: string) => void;
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onIconSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-9 w-9 text-lg flex items-center justify-center"
        >
          {selectedIcon}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-6 gap-2">
          {AVAILABLE_ICONS.map((icon) => (
            <Button
              key={icon}
              variant="ghost"
              size="icon"
              className={`h-9 w-9 text-lg flex items-center justify-center hover:bg-accent ${
                selectedIcon === icon ? "bg-accent/80 ring-2 ring-primary" : ""
              }`}
              onClick={() => {
                onIconSelect(icon);
                setIsOpen(false);
              }}
            >
              {icon}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default IconPicker;
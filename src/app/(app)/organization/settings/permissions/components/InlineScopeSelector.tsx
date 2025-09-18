'use client'

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Badge } from "@/src/components/ui/badge";
import { Globe, User, Users, Filter } from "lucide-react";

interface ScopeOption {
  value: 'all' | 'specific' | 'owned' | 'team';
  label: string;
}

interface InlineScopeSelectorProps {
  value: 'all' | 'specific' | 'owned' | 'team';
  options: ScopeOption[];
  onValueChange: (value: 'all' | 'specific' | 'owned' | 'team') => void;
  disabled?: boolean;
  className?: string;
}

export function InlineScopeSelector({
  value,
  options,
  onValueChange,
  disabled = false,
  className = ""
}: InlineScopeSelectorProps) {

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'all':
        return <Globe className="w-3 h-3" />;
      case 'owned':
        return <User className="w-3 h-3" />;
      case 'team':
        return <Users className="w-3 h-3" />;
      case 'specific':
        return <Filter className="w-3 h-3" />;
      default:
        return <Globe className="w-3 h-3" />;
    }
  };

  const getScopeBadgeVariant = (scope: string) => {
    switch (scope) {
      case 'all':
        return 'default';
      case 'owned':
        return 'secondary';
      case 'team':
        return 'outline';
      case 'specific':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getCurrentOption = () => {
    return options.find(opt => opt.value === value) || options[0];
  };

  const currentOption = getCurrentOption();

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={`w-auto min-w-[120px] h-7 text-xs ${className}`}>
        <SelectValue asChild>
          <Badge
            variant={getScopeBadgeVariant(value)}
            className="flex items-center gap-1 text-xs border-0 cursor-pointer hover:opacity-80"
          >
            {getScopeIcon(value)}
            {currentOption?.label || 'All'}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-xs"
          >
            <div className="flex items-center gap-2">
              {getScopeIcon(option.value)}
              <span>{option.label}</span>
              {option.value === 'specific' && (
                <Badge variant="outline" className="text-xs ml-1">
                  Advanced
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
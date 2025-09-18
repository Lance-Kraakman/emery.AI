'use client';

import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/src/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/components/ui/popover';
import { cn } from '@/src/lib/utils';
import { Badge } from '@/src/components/ui/badge';

interface User {
  id: string;
  name: string;
  email: string;
  systemRole?: string;
}

interface UserSelectProps {
  value?: string;
  onValueChange?: (userId: string) => void;
  users: User[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCurrentOwnerBadge?: boolean;
  currentOwnerId?: string;
}

export function UserSelect({
  value,
  onValueChange,
  users,
  placeholder = "Select user...",
  disabled = false,
  className,
  showCurrentOwnerBadge = false,
  currentOwnerId
}: UserSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedUser = users.find(user => user.id === value);

  const handleSelect = (userId: string) => {
    onValueChange?.(userId);
    setOpen(false);
  };

  const isCurrentOwner = (userId: string) => {
    return showCurrentOwnerBadge && currentOwnerId === userId;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {selectedUser ? (
              <div className="flex items-center gap-2">
                <span className="truncate">{selectedUser.name}</span>
                {isCurrentOwner(selectedUser.id) && (
                  <Badge variant="secondary" className="text-xs">
                    Current
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandEmpty>No users found.</CommandEmpty>
          <CommandGroup>
            {users.map((user) => (
              <CommandItem
                key={user.id}
                value={`${user.name} ${user.email}`}
                onSelect={() => handleSelect(user.id)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrentOwner(user.id) && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                  {user.systemRole && (
                    <Badge variant="outline" className="text-xs">
                      {user.systemRole}
                    </Badge>
                  )}
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
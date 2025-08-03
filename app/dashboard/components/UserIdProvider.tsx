'use client'

// AIDEV-NOTE: Client component for user ID management - must stay client due to localStorage usage

import { createContext, useContext, useEffect, useState } from 'react';

interface UserIdContextType {
  userId: string | null;
  isLoading: boolean;
}

const UserIdContext = createContext<UserIdContextType>({ 
  userId: null, 
  isLoading: true 
});

export function UserIdProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get or create a proper UUID
    let storedUserId = localStorage.getItem('userId');
    
    // Check if it's a valid UUID format (contains hyphens)
    if (!storedUserId || !storedUserId.includes('-')) {
      storedUserId = crypto.randomUUID();
      localStorage.setItem('userId', storedUserId);
    }
    
    setUserId(storedUserId);
    setIsLoading(false);
  }, []);

  return (
    <UserIdContext.Provider value={{ userId, isLoading }}>
      {children}
    </UserIdContext.Provider>
  );
}

export function useUserId() {
  const context = useContext(UserIdContext);
  if (!context) {
    throw new Error('useUserId must be used within a UserIdProvider');
  }
  return context;
}
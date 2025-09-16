'use client'

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings } from "lucide-react";
import { UsersTab } from "./UsersTab";
import { RolesTab } from "./RolesTab";
import { ErrorBoundary } from "./ErrorBoundary";

export function PermissionsManager() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="users" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Users
        </TabsTrigger>
        <TabsTrigger value="roles" className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Roles
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-6">
        <ErrorBoundary key="users-tab">
          <UsersTab key="users-component" />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="roles" className="space-y-6">
        <ErrorBoundary key="roles-tab">
          <RolesTab key="roles-component" />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}
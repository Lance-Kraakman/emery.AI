'use client'

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Bot, UsersIcon } from "lucide-react";
import { UsersTab } from "./UsersTab";
import { AgentsPermissionsTab } from "./AgentsPermissionsTab";
import { TeamsPermissionsTab } from "./TeamsPermissionsTab";

export function PermissionsManager() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="users" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Users
        </TabsTrigger>
        <TabsTrigger value="agents" className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Agents
        </TabsTrigger>
        <TabsTrigger value="teams" className="flex items-center gap-2">
          <UsersIcon className="w-4 h-4" />
          Teams
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-6">
        <UsersTab />
      </TabsContent>

      <TabsContent value="agents" className="space-y-6">
        <AgentsPermissionsTab />
      </TabsContent>

      <TabsContent value="teams" className="space-y-6">
        <TeamsPermissionsTab />
      </TabsContent>
    </Tabs>
  );
}
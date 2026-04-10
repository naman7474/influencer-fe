"use client";

import { ReactNode } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface TabContainerProps {
  overviewTab: ReactNode;
  contentTab: ReactNode;
  audienceTab: ReactNode;
  performanceTab: ReactNode;
  historyTab: ReactNode;
}

export function TabContainer({
  overviewTab,
  contentTab,
  audienceTab,
  performanceTab,
  historyTab,
}: TabContainerProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="w-full justify-start border-b border-border">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="audience">Audience</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="pt-6">
        {overviewTab}
      </TabsContent>

      <TabsContent value="content" className="pt-6">
        {contentTab}
      </TabsContent>

      <TabsContent value="audience" className="pt-6">
        {audienceTab}
      </TabsContent>

      <TabsContent value="performance" className="pt-6">
        {performanceTab}
      </TabsContent>

      <TabsContent value="history" className="pt-6">
        {historyTab}
      </TabsContent>
    </Tabs>
  );
}

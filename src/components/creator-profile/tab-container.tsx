"use client";

import { ReactNode } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface TabContainerProps {
  fitTab: ReactNode;
  credibilityTab: ReactNode;
  impactTab: ReactNode;
  commerceTab: ReactNode;
}

export function TabContainer({
  fitTab,
  credibilityTab,
  impactTab,
  commerceTab,
}: TabContainerProps) {
  return (
    <Tabs defaultValue="fit">
      <TabsList
        variant="line"
        className="w-full justify-start border-b border-border"
      >
        <TabsTrigger value="fit">Fit</TabsTrigger>
        <TabsTrigger value="credibility">Credibility</TabsTrigger>
        <TabsTrigger value="impact">Impact</TabsTrigger>
        <TabsTrigger value="commerce">Commerce</TabsTrigger>
      </TabsList>

      <TabsContent value="fit" className="pt-6">
        {fitTab}
      </TabsContent>

      <TabsContent value="credibility" className="pt-6">
        {credibilityTab}
      </TabsContent>

      <TabsContent value="impact" className="pt-6">
        {impactTab}
      </TabsContent>

      <TabsContent value="commerce" className="pt-6">
        {commerceTab}
      </TabsContent>
    </Tabs>
  );
}

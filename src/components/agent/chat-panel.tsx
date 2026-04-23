"use client";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatContent } from "./chat-content";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[400px] max-w-[90vw] p-0 flex flex-col"
      >
        <SheetTitle className="sr-only">AI Agent Chat</SheetTitle>
        <ChatContent isVisible={isOpen} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}

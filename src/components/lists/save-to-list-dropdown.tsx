"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, Plus, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getLists,
  addToList,
  removeFromList,
  getListsForCreator,
  createList,
} from "@/lib/queries/lists";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CreatorList } from "@/lib/types/database";

interface SaveToListDropdownProps {
  creatorId: string;
  brandId: string;
  /** Compact mode for card footers */
  compact?: boolean;
}

export function SaveToListDropdown({
  creatorId,
  brandId,
  compact = false,
}: SaveToListDropdownProps) {
  const supabase = createClient();

  const [lists, setLists] = useState<CreatorList[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allLists, creatorListIds] = await Promise.all([
        getLists(supabase, brandId),
        getListsForCreator(supabase, brandId, creatorId),
      ]);
      setLists(allLists);
      setMemberOf(new Set(creatorListIds));
    } catch (err) {
      console.error("SaveToListDropdown fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, brandId, creatorId]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  async function handleToggle(listId: string) {
    const inList = memberOf.has(listId);
    try {
      if (inList) {
        await removeFromList(supabase, listId, creatorId);
        setMemberOf((prev) => {
          const next = new Set(prev);
          next.delete(listId);
          return next;
        });
      } else {
        await addToList(supabase, listId, creatorId);
        setMemberOf((prev) => new Set(prev).add(listId));
      }
    } catch (err) {
      console.error("Toggle list error:", err);
    }
  }

  async function handleCreate() {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const newList = await createList(supabase, brandId, newListName.trim());
      await addToList(supabase, newList.id, creatorId);
      setLists((prev) => [newList, ...prev]);
      setMemberOf((prev) => new Set(prev).add(newList.id));
      setNewListName("");
      setShowNewInput(false);
    } catch (err) {
      console.error("Create list error:", err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          compact ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Save to list"
            />
          ) : (
            <Button variant="outline" size="sm" />
          )
        }
      >
        <Heart
          className={cn(
            "size-4",
            memberOf.size > 0 && "fill-primary text-primary",
          )}
        />
        {!compact && <span>Save</span>}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Save to list</p>
        </div>

        <div className="max-h-48 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : lists.length === 0 && !showNewInput ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No lists yet. Create one below.
            </p>
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => handleToggle(list.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    memberOf.has(list.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input",
                  )}
                >
                  {memberOf.has(list.id) && <Check className="size-3" />}
                </span>
                <span className="truncate">{list.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="border-t p-2">
          {showNewInput ? (
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="List name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setShowNewInput(false);
                    setNewListName("");
                  }
                }}
                autoFocus
                className="h-7 text-sm"
              />
              <Button
                size="xs"
                onClick={handleCreate}
                disabled={creating || !newListName.trim()}
              >
                {creating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewInput(true)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-4" />
              Create new list
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  FolderOpen,
  Trash2,
  ArrowLeft,
  Loader2,
  Users,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getLists,
  createList,
  deleteList,
  getListItems,
  getListItemCounts,
} from "@/lib/queries/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatFollowers } from "@/lib/format";
import type { CreatorList, CreatorListItem } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CreatorsPageClientProps {
  brandId: string;
  initialLists: CreatorList[];
  initialCounts: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CreatorsPageClient({
  brandId,
  initialLists,
  initialCounts,
}: CreatorsPageClientProps) {
  const supabase = createClient();

  const [lists, setLists] = useState<CreatorList[]>(initialLists);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [selectedList, setSelectedList] = useState<CreatorList | null>(null);
  const [listItems, setListItems] = useState<
    (CreatorListItem & { creator: Record<string, unknown> })[]
  >([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // New list dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CreatorList | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshLists = useCallback(async () => {
    const updated = await getLists(supabase, brandId);
    setLists(updated);
    const newCounts = await getListItemCounts(
      supabase,
      updated.map((l) => l.id),
    );
    setCounts(newCounts);
  }, [supabase, brandId]);

  const openList = useCallback(
    async (list: CreatorList) => {
      setSelectedList(list);
      setLoadingItems(true);
      try {
        const items = await getListItems(supabase, list.id);
        setListItems(items);
      } catch (err) {
        console.error("Error loading list items:", err);
      } finally {
        setLoadingItems(false);
      }
    },
    [supabase],
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createList(supabase, brandId, newName.trim(), newDesc.trim() || undefined);
      await refreshLists();
      setShowNewDialog(false);
      setNewName("");
      setNewDesc("");
    } catch (err) {
      console.error("Create error:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteList(supabase, deleteTarget.id);
      await refreshLists();
      if (selectedList?.id === deleteTarget.id) {
        setSelectedList(null);
        setListItems([]);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(false);
    }
  }

  /* ---- List detail view ---- */
  if (selectedList) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setSelectedList(null);
              setListItems([]);
              refreshLists();
            }}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-serif text-2xl tracking-tight text-foreground">
              {selectedList.name}
            </h1>
            {selectedList.description && (
              <p className="text-sm text-muted-foreground">
                {selectedList.description}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="ml-auto">
            {listItems.length} creators
          </Badge>
        </div>

        {loadingItems ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : listItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <Users className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              No creators in this list
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add creators from Discovery or creator profiles.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listItems.map((item) => {
              const c = item.creator as {
                id: string;
                handle: string;
                display_name: string | null;
                avatar_url: string | null;
                followers: number | null;
                tier: string | null;
                is_verified: boolean | null;
                city: string | null;
                country: string | null;
              };
              const location = [c.city, c.country].filter(Boolean).join(", ");
              const initials = c.display_name
                ? c.display_name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : c.handle.slice(0, 2).toUpperCase();

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "border-l-3 border-l-transparent transition-all duration-200",
                    "hover:border-l-primary hover:shadow-md",
                  )}
                >
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10">
                        {c.avatar_url && (
                          <AvatarImage src={c.avatar_url} alt={c.handle} />
                        )}
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/creator/${c.handle}`}
                          className="font-handle truncate text-foreground hover:text-primary"
                        >
                          @{c.handle}
                        </a>
                        {c.display_name && (
                          <p className="truncate text-sm text-muted-foreground">
                            {c.display_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {c.followers != null && (
                        <span>
                          <span className="font-semibold text-foreground">
                            {formatFollowers(c.followers)}
                          </span>{" "}
                          followers
                        </span>
                      )}
                      {c.tier && (
                        <Badge variant="secondary" className="capitalize">
                          {c.tier}
                        </Badge>
                      )}
                    </div>
                    {location && (
                      <p className="text-xs text-muted-foreground">{location}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs italic text-muted-foreground">
                        {item.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ---- Lists overview ---- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-foreground">
            My Creators
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your saved creator lists.
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="size-4" />
          New List
        </Button>
      </div>

      {/* Lists grid */}
      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <FolderOpen className="mb-4 size-12 text-muted-foreground/50" />
          <p className="text-base font-medium text-foreground">
            No saved lists yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Start by saving creators from Discovery. Use lists to organize
            creators for different campaigns or categories.
          </p>
          <Button className="mt-4" onClick={() => setShowNewDialog(true)}>
            <Plus className="size-4" />
            Create Your First List
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Card
              key={list.id}
              className={cn(
                "cursor-pointer border-l-3 border-l-transparent transition-all duration-200",
                "hover:border-l-primary hover:shadow-md",
              )}
              onClick={() => openList(list)}
            >
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {list.name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(list);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {list.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {list.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {counts[list.id] ?? 0} creators
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {relativeTime(list.updated_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* New List card */}
          <button
            onClick={() => setShowNewDialog(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-6" />
            <span className="text-sm font-medium">New List</span>
          </button>
        </div>
      )}

      {/* Create list dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>
              Organize creators into lists for easy access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                List Name
              </label>
              <Input
                placeholder="e.g., Summer Campaign Shortlist"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Description (optional)
              </label>
              <Input
                placeholder="Brief description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Create List"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/shared/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function InboundClient({
  initialRows,
}: {
  initialRows: Array<{
    id: string;
    sender_handle: string | null;
    sender_name: string | null;
    sender_avatar_url: string | null;
    message_preview: string | null;
    last_message_at: string | null;
    status: string;
    cpi_score: number | null;
    match_score: number | null;
  }>;
}) {
  const [rows, setRows] = useState(initialRows);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const visibleRows = useMemo(
    () =>
      statusFilter === "all"
        ? rows
        : rows.filter((row) => row.status === statusFilter),
    [rows, statusFilter]
  );

  const updateStatus = (id: string, status: "accepted" | "rejected") => {
    startTransition(async () => {
      setRowErrors((current) => ({ ...current, [id]: "" }));
      const response = await fetch(`/api/v1/inbound/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error?.message ?? `Unable to ${status} creator.`;
        setRowErrors((current) => ({ ...current, [id]: message }));
        toast.error(message);
        return;
      }
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, status } : row))
      );
      toast.success(`Creator ${status}.`);
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Inbound</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Instagram inbound creators
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review inbound DMs, score creators, and accept or reject them.
            </p>
          </div>
          <div className="flex gap-2">
            {["all", "new", "scored", "accepted", "rejected"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <div className="rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>CPI</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Last DM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={row.sender_avatar_url ?? undefined} />
                        <AvatarFallback>
                          {(row.sender_name ?? row.sender_handle ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {row.sender_handle ? (
                            <Link href={`/creators/${row.sender_handle}`} className="hover:underline">
                              {row.sender_name ?? row.sender_handle ?? "Unknown"}
                            </Link>
                          ) : (
                            row.sender_name ?? row.sender_handle ?? "Unknown"
                          )}
                        </p>
                        {row.sender_handle ? (
                          <p className="text-xs text-muted-foreground">@{row.sender_handle}</p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {row.message_preview ?? "No preview"}
                  </TableCell>
                  <TableCell>{row.cpi_score?.toFixed(1) ?? "N/A"}</TableCell>
                  <TableCell>{row.match_score?.toFixed(1) ?? "N/A"}</TableCell>
                  <TableCell>
                    {row.last_message_at
                      ? new Date(row.last_message_at).toLocaleString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(row.id, "accepted")}
                          disabled={isPending}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(row.id, "rejected")}
                          disabled={isPending}
                        >
                          Reject
                        </Button>
                      </div>
                      {rowErrors[row.id] ? (
                        <p className="text-xs text-rose-600">{rowErrors[row.id]}</p>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No inbound creators match this filter yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

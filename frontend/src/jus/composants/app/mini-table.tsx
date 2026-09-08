"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import { cn } from "@/lib/cn";
import { fetchList } from "@/jus/lib/api";
import type { Resource } from "@/jus/lib/types";

export function MiniTable<T extends { id: string | number }>({
  resource,
  href,
  limit = 5,
  columns,
}: {
  resource: Resource<T>;
  href: string;
  limit?: number;
  columns?: string[];
}) {
  const [rows, setRows] = useState<T[]>(resource.rows ?? []);
  const [loading, setLoading] = useState(Boolean(resource.endpoint));

  useEffect(() => {
    if (!resource.endpoint) return;
    let alive = true;
    fetchList<Record<string, unknown>>(resource.endpoint)
      .then((data) => {
        if (!alive) return;
        setRows(resource.fromApi ? data.map(resource.fromApi) : (data as unknown as T[]));
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [resource]);

  const cols = columns
    ? resource.columns.filter((c) => columns.includes(c.key))
    : resource.columns;
  const shown = rows.slice(0, limit);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{resource.title}</CardTitle>
          <CardDescription>{resource.description}</CardDescription>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Voir tout <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                {cols.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn("px-6", c.align === "right" && "text-right")}
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={cols.length} className="h-24 px-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                shown.map((row) => (
                  <TableRow key={row.id}>
                    {cols.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn("px-6", c.align === "right" && "text-right")}
                      >
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!loading && shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={cols.length} className="h-24 px-6 text-center text-muted-foreground">
                    Aucune donnée.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

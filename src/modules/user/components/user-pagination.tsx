import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

import { getPaginationItems, getUsersPageHref } from "../utils/user-admin.utils";
import type { UserListParams, UserListResult } from "../types/user.types";

export interface UserPaginationProps {
  result: UserListResult;
  params: UserListParams;
}

export function UserPagination({ result, params }: UserPaginationProps) {
  if (result.total === 0) return null;

  const from = (result.page - 1) * result.pageSize + 1;
  const to = from + result.users.length - 1;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {from}–{to} de {result.total} usuarios
      </p>
      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              {result.page === 1 ? (
                <span
                  aria-disabled="true"
                  aria-label="Pagina anterior"
                  className="flex size-8 items-center justify-center pointer-events-none opacity-50"
                >
                  <ChevronLeft aria-hidden className="size-4" />
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Pagina anterior"
                  render={<Link href={getUsersPageHref(params, result.page - 1)} />}
                  nativeButton={false}
                >
                  <ChevronLeft aria-hidden />
                </Button>
              )}
            </PaginationItem>
            {getPaginationItems(result.page, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-current={item === result.page ? "page" : undefined}
                    className={cn(item === result.page && "bg-primary text-primary-foreground")}
                    render={<Link href={getUsersPageHref(params, item)} />}
                    nativeButton={false}
                  >
                    {item}
                  </Button>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              {result.page === totalPages ? (
                <span
                  aria-disabled="true"
                  aria-label="Pagina siguiente"
                  className="flex size-8 items-center justify-center pointer-events-none opacity-50"
                >
                  <ChevronRight aria-hidden className="size-4" />
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Pagina siguiente"
                  render={<Link href={getUsersPageHref(params, result.page + 1)} />}
                  nativeButton={false}
                >
                  <ChevronRight aria-hidden />
                </Button>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

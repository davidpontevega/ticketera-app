"use client";

import { useState } from "react";
import { PlusCircle, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

import { UserDialog, type UserDialogState } from "./user-dialog";
import { UserFilters } from "./user-filters";
import { UserPagination } from "./user-pagination";
import { UserTable } from "./user-table";
import type { UserListParams, UserListResult } from "../types/user.types";

export interface UserAdminPanelProps {
  result: UserListResult;
  params: UserListParams;
}

export function UserAdminPanel({ result, params }: UserAdminPanelProps) {
  const [dialog, setDialog] = useState<UserDialogState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Invita administradores y organizadores, y gestiona sus roles.
          </p>
        </div>
        <Button type="button" onClick={() => setDialog({ mode: "invite" })}>
          <PlusCircle aria-hidden />
          Invitar usuario
        </Button>
      </div>

      <UserFilters params={params} />

      {notice !== null && (
        <p role="status" className="rounded-lg bg-success/10 px-4 py-2 text-sm text-success">
          {notice}
        </p>
      )}

      <div className="rounded-2xl border bg-background">
        {result.users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay usuarios"
            description="Prueba con otra busqueda o filtro."
            titleAs="h2"
          />
        ) : (
          <UserTable
            users={result.users}
            onEditRole={(user) => setDialog({ mode: "edit-role", user })}
            onDelete={(user) => setDialog({ mode: "delete", user })}
          />
        )}
        <UserPagination result={result} params={params} />
      </div>

      <UserDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onSuccess={(message) => {
          setDialog(null);
          setNotice(message);
        }}
      />
    </div>
  );
}

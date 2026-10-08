"use client";

import { Search } from "lucide-react";
import Form from "next/form";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import {
  ADMIN_USERS_PATH,
  USER_ROLE_LABELS,
  USER_SEARCH_MAX_LENGTH,
  USER_STATUS_LABELS,
} from "../constants/user.constants";
import type { UserListParams } from "../types/user.types";

export interface UserFiltersProps {
  params: UserListParams;
}

export function UserFilters({ params }: UserFiltersProps) {
  return (
    <Form
      action={ADMIN_USERS_PATH}
      key={`${params.q ?? ""}|${params.role ?? ""}|${params.status}`}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          name="q"
          maxLength={USER_SEARCH_MAX_LENGTH}
          placeholder="Buscar por nombre o email"
          defaultValue={params.q ?? ""}
          aria-label="Buscar usuarios"
          className="pl-8"
        />
      </div>
      <NativeSelect
        name="role"
        defaultValue={params.role ?? ""}
        aria-label="Filtrar por rol"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <NativeSelectOption value="">Todos los roles</NativeSelectOption>
        {Object.entries(USER_ROLE_LABELS).map(([role, label]) => (
          <NativeSelectOption key={role} value={role}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        name="status"
        defaultValue={params.status}
        aria-label="Filtrar por estado"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {Object.entries(USER_STATUS_LABELS).map(([status, label]) => (
          <NativeSelectOption key={status} value={status}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Form>
  );
}

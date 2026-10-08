"use client";

import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getInitials } from "@/modules/auth";

import { changeUserRoleAction, deleteUserAction, inviteUserAction } from "../actions/user-admin.actions";
import { ASSIGNABLE_ROLES, INVITABLE_ROLES, USER_ROLE_LABELS } from "../constants/user.constants";
import { useUserAdminAction } from "../hooks/use-user-admin-action";
import type { UserListItem } from "../types/user.types";

export type UserDialogState =
  | { mode: "invite" }
  | { mode: "edit-role"; user: UserListItem }
  | { mode: "delete"; user: UserListItem };

export interface UserDialogProps {
  state: UserDialogState | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function UserDialog({ state, onClose, onSuccess }: UserDialogProps) {
  // Guarda el ultimo state no nulo para que el contenido no se vacie durante la animacion de
  // cierre (cuando `state` ya es null pero el Dialog todavia esta animando su salida).
  const [content, setContent] = useState<UserDialogState>(state ?? { mode: "invite" });
  if (state && state !== content) {
    setContent(state);
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>{TITLES[content.mode]}</DialogTitle>
          <DialogClose aria-label="Cerrar" render={<Button variant="ghost" size="icon-sm" />}>
            <X />
          </DialogClose>
        </DialogHeader>
        {content.mode === "invite" && <InviteForm onSuccess={onSuccess} />}
        {content.mode === "edit-role" && <EditRoleForm user={content.user} onSuccess={onSuccess} />}
        {content.mode === "delete" && <DeleteForm user={content.user} onSuccess={onSuccess} />}
      </DialogContent>
    </Dialog>
  );
}

const TITLES: Record<UserDialogState["mode"], string> = {
  invite: "Invitar usuario",
  "edit-role": "Cambiar rol",
  delete: "Eliminar usuario",
};

function InviteForm({ onSuccess }: { onSuccess: (message: string) => void }) {
  const [state, formAction, pending] = useUserAdminAction(inviteUserAction, onSuccess);
  const emailError = state.status === "error" ? state.fieldErrors?.email : undefined;
  const roleError = state.status === "error" ? state.fieldErrors?.role : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Se enviara una invitacion por correo con el rol elegido preasignado.
      </p>
      <Field data-invalid={Boolean(emailError)}>
        <FieldLabel htmlFor="invite-email">Email</FieldLabel>
        <Input
          id="invite-email"
          name="email"
          type="email"
          aria-invalid={Boolean(emailError)}
          required
        />
        {emailError && <FieldError>{emailError}</FieldError>}
      </Field>
      <Field data-invalid={Boolean(roleError)}>
        <FieldLabel htmlFor="invite-role">Rol</FieldLabel>
        <NativeSelect id="invite-role" name="role" aria-invalid={Boolean(roleError)}>
          {INVITABLE_ROLES.map((role) => (
            <NativeSelectOption key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {roleError && <FieldError>{roleError}</FieldError>}
      </Field>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pending}>Enviar invitacion</Button>
      </DialogFooter>
    </form>
  );
}

function EditRoleForm({ user, onSuccess }: { user: UserListItem; onSuccess: (message: string) => void }) {
  const [state, formAction, pending] = useUserAdminAction(changeUserRoleAction, onSuccess);
  const roleError = state.status === "error" ? state.fieldErrors?.role : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">El nuevo rol se aplica de inmediato.</p>
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(user.fullName)}
          </AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{user.fullName}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
      </div>
      <input type="hidden" name="userId" value={user.id} />
      <Field data-invalid={Boolean(roleError)}>
        <FieldLabel htmlFor="edit-role-role">Rol</FieldLabel>
        <NativeSelect
          id="edit-role-role"
          name="role"
          defaultValue={user.role}
          aria-invalid={Boolean(roleError)}
        >
          {ASSIGNABLE_ROLES.map((role) => (
            <NativeSelectOption key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {roleError && <FieldError>{roleError}</FieldError>}
      </Field>
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pending}>Guardar</Button>
      </DialogFooter>
    </form>
  );
}

function DeleteForm({ user, onSuccess }: { user: UserListItem; onSuccess: (message: string) => void }) {
  const [state, formAction, pending] = useUserAdminAction(deleteUserAction, onSuccess);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Esta accion no se puede deshacer. El usuario pierde acceso de inmediato.
      </p>
      <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-3 text-destructive">
        <TriangleAlert className="shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{user.fullName}</span>
          <span className="truncate text-xs">{user.email}</span>
        </span>
      </div>
      <input type="hidden" name="userId" value={user.id} />
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" variant="destructive" disabled={pending}>Eliminar</Button>
      </DialogFooter>
    </form>
  );
}

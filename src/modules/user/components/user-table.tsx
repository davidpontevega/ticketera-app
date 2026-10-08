"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { USER_ROLE_LABELS } from "@/modules/user/constants/user.constants";

import type { UserListItem, UserRole } from "../types/user.types";

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  super_admin: "bg-primary/10 text-primary",
  admin: "bg-muted text-muted-foreground",
  organizer: "bg-success/10 text-success",
  customer: "bg-muted text-muted-foreground",
};

export interface UserTableProps {
  users: UserListItem[];
  onEditRole: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
}

export function UserTable({ users, onEditRole, onDelete }: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const canManage = user.role !== "super_admin" && user.deletedAt === null;

          return (
            <TableRow key={user.id}>
              <TableCell>{user.fullName}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                {user.deletedAt !== null ? (
                  <Badge variant="destructive">Eliminado</Badge>
                ) : (
                  <Badge className={ROLE_BADGE_CLASSES[user.role]}>{USER_ROLE_LABELS[user.role]}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {canManage ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Editar rol de ${user.fullName}`}
                      onClick={() => onEditRole(user)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-destructive/20 bg-destructive/10 text-destructive"
                      aria-label={`Eliminar a ${user.fullName}`}
                      onClick={() => onDelete(user)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : (
                  <span aria-label="Sin acciones">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

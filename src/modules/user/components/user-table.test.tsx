import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserListItem } from "../types/user.types";
import { UserTable } from "./user-table";

function buildUser(overrides: Partial<UserListItem>): UserListItem {
  return {
    id: "user-1",
    email: "user@example.com",
    fullName: "Ana Perez",
    role: "customer",
    createdAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("UserTable", () => {
  it("renders no action buttons and the dash for a super_admin row", () => {
    const superAdmin = buildUser({ id: "1", fullName: "Super Admin", role: "super_admin" });
    render(<UserTable users={[superAdmin]} onEditRole={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByRole("button", { name: `Editar rol de ${superAdmin.fullName}` })).toBeNull();
    expect(screen.queryByRole("button", { name: `Eliminar a ${superAdmin.fullName}` })).toBeNull();
    expect(screen.getByLabelText("Sin acciones")).toBeTruthy();
  });

  it("renders the 'Eliminado' badge and no action buttons for a deleted user", () => {
    const deletedUser = buildUser({
      id: "2",
      fullName: "Deleted User",
      role: "organizer",
      deletedAt: new Date(),
    });
    render(<UserTable users={[deletedUser]} onEditRole={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Eliminado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: `Editar rol de ${deletedUser.fullName}` })).toBeNull();
    expect(screen.queryByRole("button", { name: `Eliminar a ${deletedUser.fullName}` })).toBeNull();
  });

  it("renders both action buttons for an active organizer", () => {
    const organizer = buildUser({ id: "3", fullName: "Org Izer", role: "organizer" });
    render(<UserTable users={[organizer]} onEditRole={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("button", { name: `Editar rol de ${organizer.fullName}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Eliminar a ${organizer.fullName}` })).toBeTruthy();
  });

  it("calls onEditRole with the exact row user when clicking 'Editar rol'", () => {
    const rowOne = buildUser({ id: "4", fullName: "Row One", role: "organizer" });
    const rowTwo = buildUser({ id: "5", fullName: "Row Two", role: "admin" });
    const onEditRole = vi.fn();
    render(<UserTable users={[rowOne, rowTwo]} onEditRole={onEditRole} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: `Editar rol de ${rowTwo.fullName}` }));

    expect(onEditRole).toHaveBeenCalledTimes(1);
    expect(onEditRole).toHaveBeenCalledWith(rowTwo);
  });

  it("calls onDelete with the exact row user when clicking 'Eliminar'", () => {
    const rowOne = buildUser({ id: "6", fullName: "Row One", role: "organizer" });
    const rowTwo = buildUser({ id: "7", fullName: "Row Two", role: "admin" });
    const onDelete = vi.fn();
    render(<UserTable users={[rowOne, rowTwo]} onEditRole={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: `Eliminar a ${rowOne.fullName}` }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(rowOne);
  });
});

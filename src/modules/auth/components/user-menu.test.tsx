import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserMenu } from "./user-menu";

const useCurrentUser = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../hooks/use-current-user", () => ({ useCurrentUser: () => useCurrentUser() }));

describe("UserMenu favoritos", () => {
  beforeEach(() => {
    cleanup();
    useCurrentUser.mockReset();
  });

  it("muestra Mis favoritos -> /favorites con sesion", () => {
    useCurrentUser.mockReturnValue({
      user: { fullName: "Ana Perez", email: "a@b.co" },
      isLoaded: true,
      signOut: vi.fn(),
    });
    render(<UserMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Mis favoritos" }).getAttribute("href")).toBe(
      "/favorites",
    );
  });

  it("no lo muestra sin sesion", () => {
    useCurrentUser.mockReturnValue({ user: null, isLoaded: true, signOut: vi.fn() });
    render(<UserMenu layout="sheet" />);
    expect(screen.queryByText("Mis favoritos")).toBeNull();
  });
});

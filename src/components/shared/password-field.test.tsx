import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordField } from "./password-field";

afterEach(cleanup);

describe("PasswordField", () => {
  it("toggles the password visibility", () => {
    render(<PasswordField id="password" label="Contraseña" defaultValue="secreto123" />);
    const input = screen.getByLabelText("Contraseña");
    expect(input.getAttribute("type")).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(input.getAttribute("type")).toBe("text");
    expect(
      screen.getByRole("button", { name: "Ocultar contraseña" }).getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(input.getAttribute("type")).toBe("password");
  });

  it("shows the error and marks the input as invalid", () => {
    render(<PasswordField id="password" label="Contraseña" error="Ingresa tu contraseña" />);
    const input = screen.getByLabelText("Contraseña");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("password-error");
    expect(screen.getByText("Ingresa tu contraseña")).toBeTruthy();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const subscribeAction = vi.fn();
vi.mock("../actions/newsletter.actions", () => ({
  subscribeAction: (...args: unknown[]) => subscribeAction(...args),
}));

const { NewsletterSignup } = await import("./newsletter-signup");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const submit = () => {
  fireEvent.change(screen.getByLabelText("Correo electronico"), { target: { value: "ana@correo.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Suscribirme" }));
};

describe("NewsletterSignup", () => {
  it("muestra exito tras suscribir", async () => {
    subscribeAction.mockResolvedValue({ status: "success", message: "Listo, te avisaremos de novedades" });
    render(<NewsletterSignup />);
    submit();
    expect(await screen.findByText("Listo, te avisaremos de novedades")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Listo");
  });

  it("muestra el error de validacion", async () => {
    subscribeAction.mockResolvedValue({ status: "error", message: "Correo invalido" });
    render(<NewsletterSignup />);
    submit();
    expect(await screen.findByText("Correo invalido")).toBeTruthy();
  });

  it("deshabilita el boton mientras envia", async () => {
    let resolve!: (v: unknown) => void;
    subscribeAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<NewsletterSignup />);
    submit();
    const busy = await screen.findByRole("button", { name: "Enviando..." });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    resolve({ status: "success", message: "ok" });
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Suscribirme" }) as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("el honeypot esta oculto y fuera del orden de tabulacion", () => {
    render(<NewsletterSignup />);
    const honeypot = screen.getByTestId("newsletter-honeypot");
    expect(honeypot.getAttribute("aria-hidden")).toBe("true");
    expect(honeypot.querySelector("input")?.getAttribute("tabindex")).toBe("-1");
  });
});

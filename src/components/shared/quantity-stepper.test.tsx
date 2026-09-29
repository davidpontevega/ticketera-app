import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuantityStepper } from "./quantity-stepper";

afterEach(cleanup);

function getButtons() {
  return {
    decrement: screen.getByRole("button", { name: "Quitar una entrada de Campo General" }),
    increment: screen.getByRole("button", { name: "Agregar una entrada de Campo General" }),
  };
}

describe("QuantityStepper", () => {
  it("calls onChange with value - 1 and value + 1", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} max={6} label="Campo General" onChange={onChange} />);
    const { decrement, increment } = getButtons();

    fireEvent.click(decrement);
    fireEvent.click(increment);

    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("disables decrement at min", () => {
    render(<QuantityStepper value={0} max={6} label="Campo General" onChange={vi.fn()} />);
    const { decrement, increment } = getButtons();

    expect(decrement.hasAttribute("disabled")).toBe(true);
    expect(increment.hasAttribute("disabled")).toBe(false);
  });

  it("disables increment at max", () => {
    render(<QuantityStepper value={6} max={6} label="Campo General" onChange={vi.fn()} />);
    const { decrement, increment } = getButtons();

    expect(increment.hasAttribute("disabled")).toBe(true);
    expect(decrement.hasAttribute("disabled")).toBe(false);
  });
});

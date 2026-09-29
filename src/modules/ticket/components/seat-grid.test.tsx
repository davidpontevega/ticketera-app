import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Seat, VenueZone } from "../types/ticket.types";
import { SeatGrid } from "./seat-grid";

afterEach(cleanup);

const seats: Seat[] = [
  { id: "z-A-1", row: "A", number: 1, status: "available" },
  { id: "z-A-2", row: "A", number: 2, status: "occupied" },
  { id: "z-A-3", row: "A", number: 3, status: "available" },
];

const zone: VenueZone = {
  id: "z",
  name: "Platea",
  shortName: "Platea",
  price: 100,
  availability: "available",
  seating: "numbered",
  colorClassName: "",
  seatClassName: "fill-primary",
  area: { column: "1", row: "1" },
  seats,
};

function getSeat(number: number) {
  return screen.getByRole("checkbox", { name: new RegExp(`^Fila A, asiento ${number}\\b`) });
}

describe("SeatGrid", () => {
  it("toggles an available seat on click, Enter and Space", () => {
    const onToggleSeat = vi.fn();
    render(<SeatGrid zone={zone} selectedSeatIds={[]} maxReached={false} onToggleSeat={onToggleSeat} />);

    fireEvent.click(getSeat(1));
    fireEvent.keyDown(getSeat(1), { key: "Enter" });
    fireEvent.keyDown(getSeat(1), { key: " " });

    expect(onToggleSeat).toHaveBeenCalledTimes(3);
    expect(onToggleSeat).toHaveBeenCalledWith("z-A-1");
  });

  it("ignores occupied seats", () => {
    const onToggleSeat = vi.fn();
    render(<SeatGrid zone={zone} selectedSeatIds={[]} maxReached={false} onToggleSeat={onToggleSeat} />);

    fireEvent.click(getSeat(2));

    expect(onToggleSeat).not.toHaveBeenCalled();
    expect(getSeat(2).getAttribute("aria-disabled")).toBe("true");
  });

  it("reflects the selection with aria-checked", () => {
    render(<SeatGrid zone={zone} selectedSeatIds={["z-A-3"]} maxReached={false} onToggleSeat={vi.fn()} />);

    expect(getSeat(3).getAttribute("aria-checked")).toBe("true");
    expect(getSeat(1).getAttribute("aria-checked")).toBe("false");
  });

  it("disables unselected seats when the max is reached but keeps selected ones", () => {
    const onToggleSeat = vi.fn();
    render(<SeatGrid zone={zone} selectedSeatIds={["z-A-3"]} maxReached onToggleSeat={onToggleSeat} />);

    fireEvent.click(getSeat(1));
    fireEvent.click(getSeat(3));

    expect(getSeat(1).getAttribute("aria-disabled")).toBe("true");
    expect(onToggleSeat).toHaveBeenCalledTimes(1);
    expect(onToggleSeat).toHaveBeenCalledWith("z-A-3");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { installTapRipple } from "@/lib/tapRipple";

function Harness() {
  useEffect(() => installTapRipple(), []);
  return (
    <div>
      <button type="button">Guardar</button>
      <button type="button" disabled>
        No
      </button>
      <div role="button" tabIndex={0}>
        Etapa
      </div>
      <span>Texto</span>
    </div>
  );
}

describe("tap ripple", () => {
  it("draws a wave on press and skips disabled controls", () => {
    render(<Harness />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Guardar" }), { button: 0, clientX: 12, clientY: 8 });
    expect(screen.getByRole("button", { name: "Guardar" }).querySelector(".tap-ripple")).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole("button", { name: "No" }), { button: 0, clientX: 4, clientY: 4 });
    expect(screen.getByRole("button", { name: "No" }).querySelector(".tap-ripple")).toBeNull();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Etapa" }), { button: 0, clientX: 6, clientY: 6 });
    expect(screen.getByRole("button", { name: "Etapa" }).querySelector(".tap-ripple")).toBeTruthy();

    fireEvent.pointerDown(screen.getByText("Texto"), { button: 0, clientX: 1, clientY: 1 });
    expect(document.querySelectorAll(".tap-ripple")).toHaveLength(2);
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installTapRipple, spawnTapRipple } from "@/lib/tapRipple";

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it("GIVEN a press WHEN the target is an enabled control THEN a wave is drawn and disabled controls are skipped", () => {
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

  it("should clear the wave and restore the host so a focus ring is not stuck", () => {
    vi.useFakeTimers();
    const host = document.createElement("button");
    host.textContent = "Guardar";
    document.body.appendChild(host);
    spawnTapRipple(host, 8, 8, false);
    expect(host.style.overflow).toBe("hidden");
    expect(host.querySelector(".tap-ripple")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(560);
    });

    expect(host.querySelector(".tap-ripple")).toBeNull();
    expect(host.style.overflow).toBe("");
    expect(host.style.position).toBe("");
    expect(host.getAttribute("tabindex")).toBeNull();
    host.remove();
  });
});

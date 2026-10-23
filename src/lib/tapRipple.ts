const RIPPLE_MS = 560;
const REDUCED_MS = 160;

type HostState = { count: number; position: string; overflow: string };

const hosts = new WeakMap<HTMLElement, HostState>();

function isTapTarget(node: Element | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  if (node.closest("[data-tap-ripple='off']")) return false;
  const host = node.closest("button, [role='button']");
  return host instanceof HTMLElement && host === node;
}

export function tapRippleHost(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const host = target.closest("button, [role='button']");
  if (!isTapTarget(host)) return null;
  if (host.hasAttribute("disabled") || host.getAttribute("aria-disabled") === "true") return null;
  return host;
}

/** Material ink ripple at the press point. One node, removed when the wave ends. */
export function spawnTapRipple(host: HTMLElement, clientX: number, clientY: number, reduceMotion: boolean): void {
  const rect = host.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.2;
  let state = hosts.get(host);
  if (!state) {
    state = { count: 0, position: host.style.position, overflow: host.style.overflow };
    hosts.set(host, state);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.overflow = "hidden";
  }
  state.count += 1;

  const wave = document.createElement("span");
  wave.className = reduceMotion ? "tap-ripple tap-ripple--reduced" : "tap-ripple";
  wave.setAttribute("aria-hidden", "true");
  wave.style.width = `${size}px`;
  wave.style.height = `${size}px`;
  wave.style.left = `${clientX - rect.left - size / 2}px`;
  wave.style.top = `${clientY - rect.top - size / 2}px`;
  host.insertBefore(wave, host.firstChild);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    wave.remove();
    const current = hosts.get(host);
    if (!current) return;
    current.count -= 1;
    if (current.count > 0) return;
    host.style.position = current.position;
    host.style.overflow = current.overflow;
    hosts.delete(host);
  };

  wave.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, reduceMotion ? REDUCED_MS : RIPPLE_MS);
}

export function installTapRipple(doc: Document = document): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (event.button != null && event.button !== 0) return;
    const host = tapRippleHost(event.target);
    if (!host) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    spawnTapRipple(host, event.clientX, event.clientY, reduceMotion);
  };
  doc.addEventListener("pointerdown", onPointerDown, true);
  return () => doc.removeEventListener("pointerdown", onPointerDown);
}

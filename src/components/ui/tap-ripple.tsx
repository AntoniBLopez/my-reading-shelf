import { useEffect } from "react";
import { installTapRipple } from "@/lib/tapRipple";

/** One document listener so every button, including ones outside `Button`, gets the tap wave. */
export function TapRipple() {
  useEffect(() => installTapRipple(), []);
  return null;
}

// Reusable control widgets for the richer 5–8 "sandbox" games — labelled
// sliders with a live value readout, and a simple stat readout row. Pure DOM,
// zero dependencies (keeps the static GitHub Pages + Firebase build untouched).

import { el } from "./dom";

export interface SliderOpts {
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  unit?: string;
  color?: string;
  onInput?: (v: number) => void;
}

export interface SliderHandle {
  el: HTMLElement;
  get(): number;
  set(v: number): void;
  setEnabled(enabled: boolean): void;
}

const fmt = (v: number, unit?: string) =>
  `${Number.isInteger(v) ? v : v.toFixed(1)}${unit ? ` ${unit}` : ""}`;

export function slider(opts: SliderOpts): SliderHandle {
  const valEl = el("span", { class: "ctrl-val" }, fmt(opts.value, opts.unit));
  const input = el("input", {
    type: "range",
    min: String(opts.min),
    max: String(opts.max),
    step: String(opts.step ?? 1),
    value: String(opts.value),
    class: "ctrl-range",
    style: opts.color ? { accentColor: opts.color } : {},
    oninput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      valEl.textContent = fmt(v, opts.unit);
      opts.onInput?.(v);
    },
  });

  const wrap = el(
    "div",
    { class: "ctrl" },
    el("div", { class: "ctrl-head" }, el("span", { class: "ctrl-label" }, opts.label), valEl),
    input
  );

  return {
    el: wrap,
    get: () => Number(input.value),
    set: (v: number) => {
      input.value = String(v);
      valEl.textContent = fmt(v, opts.unit);
    },
    setEnabled: (enabled: boolean) => input.toggleAttribute("disabled", !enabled),
  };
}

/** A compact label→value readout row (e.g. live "Acceleration  4.0 m/s²"). */
export function readout(label: string): { el: HTMLElement; set(v: string): void } {
  const valEl = el("span", { class: "ro-val" }, "—");
  return {
    el: el("div", { class: "readout" }, el("span", { class: "ro-label" }, label), valEl),
    set: (v: string) => {
      valEl.textContent = v;
    },
  };
}

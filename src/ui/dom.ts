// Tiny DOM helper so screens can be written without a framework.

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; onclick?: (e: MouseEvent) => void };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** A screen is a function that renders into the app and returns its cleanup. */
export type Screen = (root: HTMLElement) => () => void;

let cleanup: (() => void) | null = null;

export function show(screen: Screen): void {
  cleanup?.();
  const root = document.getElementById('app')!;
  root.replaceChildren();
  cleanup = screen(root);
}

export function toast(parent: HTMLElement, text: string, ms = 2600): void {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  parent.append(t);
  setTimeout(() => t.remove(), ms);
}

export function floatWord(parent: HTMLElement, text: string, x: number, y: number): void {
  const el = h('div', { class: 'float-word', style: { left: `${x}px`, top: `${y}px` } }, text);
  parent.append(el);
  setTimeout(() => el.remove(), 1000);
}

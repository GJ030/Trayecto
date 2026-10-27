/**
 * Registro de acciones de la interfaz.
 *
 * Las vistas escriben `data-action="nombre"` (clic), `data-change="nombre"` (cambio), `id` de
 * formulario (envío), etc. Cada funcionalidad registra aquí lo suyo; `installDelegation` conecta
 * un solo juego de manejadores al contenedor de contenido. Así ninguna funcionalidad importa a otra.
 */
type ClickFn = (el: HTMLButtonElement, e: MouseEvent) => void | Promise<void>;
type ChangeFn = (el: HTMLInputElement, e: Event) => void;
type SubmitFn = (form: HTMLFormElement, e: SubmitEvent) => void;
type KeyFn = (e: KeyboardEvent, el: HTMLElement) => boolean;
type InputFn = (el: HTMLInputElement, e: Event) => void;

const clicks = new Map<string, ClickFn>();
const changesByName = new Map<string, ChangeFn>();
const changesById = new Map<string, ChangeFn>();
const submits = new Map<string, SubmitFn>();
const inputs: { selector: string; fn: InputFn }[] = [];
const keys: KeyFn[] = [];

function put<T>(map: Map<string, T>, kind: string, entries: Record<string, T>) {
  for (const [name, fn] of Object.entries(entries)) {
    if (map.has(name)) throw new Error(`${kind} duplicada: ${name}`);
    map.set(name, fn);
  }
}
/** Acciones de clic, por el valor de `data-action`. */
export const registerClick = (entries: Record<string, ClickFn>) => put(clicks, 'Acción', entries);
/** Acciones de cambio, por el valor de `data-change`. */
export const registerChange = (entries: Record<string, ChangeFn>) =>
  put(changesByName, 'Cambio', entries);
/** Acciones de cambio, por el `id` del elemento. */
export const registerChangeById = (entries: Record<string, ChangeFn>) =>
  put(changesById, 'Cambio por id', entries);
/** Envío de formularios, por el `id` del formulario. */
export const registerSubmit = (entries: Record<string, SubmitFn>) => put(submits, 'Envío', entries);
/** Eventos `input` de los elementos que cumplan el selector. */
export const registerInput = (selector: string, fn: InputFn) => inputs.push({ selector, fn });
/** Teclado dentro del contenido: devuelve true si ya lo atendió (se detiene la cadena). */
export const registerKeydown = (fn: KeyFn) => keys.push(fn);

/** Conecta los manejadores registrados al contenedor. */
export function installDelegation(root: HTMLElement) {
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!el || !root.contains(el) || el.disabled) return;
    void clicks.get(el.dataset.action!)?.(el, e);
  });
  root.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    const byId = el.id ? changesById.get(el.id) : undefined;
    if (byId) {
      byId(el, e);
      return;
    }
    const a = el.dataset.change;
    if (a) changesByName.get(a)?.(el, e);
  });
  root.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.matches) return;
    for (const h of inputs) if (el.matches(h.selector)) h.fn(el, e);
  });
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    submits.get(f.id)?.(f, e as SubmitEvent);
  });
  root.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    for (const fn of keys) if (fn(e, el)) return;
    if (
      (e.key === 'Enter' || e.key === ' ') &&
      el.matches('[data-action]:not(button):not(input):not(select)')
    ) {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
}

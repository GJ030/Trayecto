/** Selectores del DOM y raíces de la aplicación. */
export const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) =>
  el.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => [
  ...el.querySelectorAll<T>(s),
];
/** Como `$`, pero para elementos que deben existir: falla con un mensaje claro si no están. */
export const req = <T extends Element = HTMLElement>(s: string, el: ParentNode = document): T => {
  const found = el.querySelector<T>(s);
  if (!found) throw new Error(`No se encontró el elemento ${s}`);
  return found;
};
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const app = req('#app'),
  contentEl = req('#content'),
  qEl = req<HTMLInputElement>('#q');

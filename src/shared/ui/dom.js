/** Selectores del DOM y raíces de la aplicación. */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const app = $('#app'),
  contentEl = $('#content'),
  qEl = $('#q');

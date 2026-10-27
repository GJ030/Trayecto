/**
 * Reacciona a los eventos de cambio del store: guarda, actualiza el menú si hace falta y
 * vuelve a pintar la pantalla. Es el único lugar que conecta el estado con la interfaz.
 */
import { applyChromeState } from './shell';
import { render } from './nav';
import { onChange, save } from '@/data/store';

onChange((e) => {
  if (e.persist) save();
  if (e.scope.includes('chrome')) applyChromeState();
  if (e.render) render();
});

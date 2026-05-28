import { addCollection } from '@iconify/vue/offline';
import antDesignIcons from '@iconify/json/json/ant-design.json';
import lineMdIcons from '@iconify/json/json/line-md.json';
import materialSymbolsIcons from '@iconify/json/json/material-symbols.json';
import mdiIcons from '@iconify/json/json/mdi.json';
import phIcons from '@iconify/json/json/ph.json';

/**
 * Register bundled icon sets so Iconify icons work in isolated intranet environments.
 *
 * Current runtime prefixes used in the app:
 * - mdi
 * - ph
 * - ant-design
 * - material-symbols
 * - line-md
 */
export function setupIconifyOffline() {
  addCollection(mdiIcons);
  addCollection(phIcons);
  addCollection(antDesignIcons);
  addCollection(materialSymbolsIcons);
  addCollection(lineMdIcons);
}

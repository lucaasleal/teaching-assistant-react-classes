import { t as index } from "./bundled-domino-dfr0A1-w.js";
// node_modules/@angular/platform-server/fesm2022/init.mjs
/**
* @license Angular v22.2.3
* (c) 2010-2026 Google LLC. https://angular.dev/
* License: MIT
*/
function applyShims() {
	Object.assign(globalThis, index.impl);
	globalThis["KeyboardEvent"] = index.impl.Event;
}
applyShims();
var ɵɵmoduleMarker = true;
export { ɵɵmoduleMarker };

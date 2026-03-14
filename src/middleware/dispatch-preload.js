// dispatch-preload.js — Usage: node -r ./dispatch-preload.js app.js
// Monkeypatches Express to auto-inject Dispatch log middleware

const Module = require('module');
const path = require('path');
const originalResolveFilename = Module._resolveFilename;

let patched = false;

Module._resolveFilename = function (request, parent, isMain, options) {
  const result = originalResolveFilename.call(this, request, parent, isMain, options);

  if (request === 'express' && !patched) {
    patched = true;
    const origRequire = Module.prototype.require;
    Module.prototype.require = function (id) {
      const exports = origRequire.apply(this, arguments);
      if (id === 'express' && typeof exports === 'function') {
        const originalExpress = exports;
        const patchedExpress = function () {
          const app = originalExpress();
          // Auto-inject dispatch middleware
          try {
            const { dispatchLogMiddleware } = require(
              path.resolve(__dirname, 'dispatch-log-middleware')
            );
            app.use(dispatchLogMiddleware());
            console.log('[Dispatch] Log middleware injected');
          } catch (e) {
            console.warn('[Dispatch] Could not inject log middleware:', e.message);
          }
          return app;
        };
        Object.assign(patchedExpress, originalExpress);
        Module.prototype.require = origRequire;
        return patchedExpress;
      }
      return exports;
    };
  }

  return result;
};

// dispatch-preload.js — Usage: node -r ./dispatch-preload.js app.js
// Monkeypatches Express to auto-inject Dispatch log middleware

// Init dd-trace for APM when DD_AGENT_HOST is set (must run before other imports)
if (process.env.DD_AGENT_HOST) {
  try {
    require('dd-trace').init({
      service: process.env.DD_SERVICE || 'dispatch-scanner',
      env: process.env.DD_ENV || 'dispatch',
      hostname: process.env.DD_AGENT_HOST,
    });
  } catch (e) {
    console.warn('[Dispatch] dd-trace init failed:', e.message);
  }
}

// Register tsx so we can require .ts files (middleware is TypeScript)
try {
  require('tsx/cjs').register();
} catch (e) {
  // tsx may not be available in target's node_modules; middleware require may fail
}

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

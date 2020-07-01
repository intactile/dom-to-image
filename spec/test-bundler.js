import chai from 'chai';

global.assert = chai.assert;

// Reports unhandled rejection
// ------------------------------------
window.addEventListener('unhandledrejection', (evt) => {
  window.__karma__.error(`unhandled rejection: ${evt.reason.stack}`);
});

// Test Importer
// ------------------------------------
// We use a Webpack global here as it is replaced with a string during compile.
// Using a regular JS variable is not statically analyzable so webpack will throw warnings.
const testsContext = require.context('./', true, /\.(spec|test)\.(js|ts|tsx)$/);
testsContext.keys().forEach(testsContext);

// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Disable Service Worker registration during Cypress tests.
Cypress.on('window:before:load', (win) => {
  if (win.navigator && win.navigator.serviceWorker) {
    win.navigator.serviceWorker.register = () => Promise.resolve({ scope: '/' });
    win.navigator.serviceWorker.getRegistration = () => Promise.resolve(undefined);
    win.navigator.serviceWorker.getRegistrations = () => Promise.resolve([]);
  }
});

// Prevent the page from executing the Service Worker file during tests.
beforeEach(() => {
  cy.intercept('GET', '/serviceWorker.js', {
    statusCode: 200,
    body: '',
    headers: { 'content-type': 'application/javascript' },
  });
});

// Ignore the known Service Worker claim error during tests.
Cypress.on('uncaught:exception', (err) => {
  const message = err && err.message ? err.message : '';
  const stack = err && err.stack ? err.stack : '';

  if (message.includes('claim') && stack.includes('serviceWorker.js')) {
    return false;
  }

  return true;
});

/* global cy, describe, it */
describe('Admin Happy Path', () => {
  const now = Date.now();
  
  const hostEmail = `host${now}@test.com`;
  const guestEmail = `guest${now}@test.com`;
  const password = 'Password123!';
  const name = 'cat';
  
  const title = `Test Listing ${now}`;
  const updatedTitle = `Updated Test Listing ${now}`;
  
  const today = new Date();
  const startDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const endDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  const formatDate = (d) => d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  
  it('Host creates & publishes, guest books, booking visible after re-login', () => {
    // ================== Host: register + create + edit + public ==================
    cy.visit('http://localhost:3000');
  
    // -------- Register as Host --------
    cy.get('[data-cy=nav-register]').click();
    cy.get('[data-cy=register-email]').type(hostEmail);
    cy.get('[data-cy=register-password]').type(password);
    cy.get('[data-cy=register-confirm-password]').type(password);
    cy.get('[data-cy=register-name]').type(name);
    cy.get('[data-cy=register-submit]').click();
  
    cy.contains('My Listings').should('exist');
  
    // -------- Create Listing --------
    cy.visit('http://localhost:3000/my-listings');
    cy.get('[data-cy=create-listing]').click();
  
    cy.get('[data-cy=create-title]').type(title);
    cy.get('[data-cy=create-price]').type('200');
  
    cy.get('[data-cy=create-street]').type('Test Street');
    cy.get('[data-cy=create-city]').type('Sydney');
    cy.get('[data-cy=create-state]').type('NSW');
    cy.get('[data-cy=create-postcode]').type('2000');
  
    cy.get('[data-cy=create-type]').type('Apartment');
    cy.get('[data-cy=create-bedrooms]').type('2');
    cy.get('[data-cy=create-bathrooms]').type('1');
    cy.get('[data-cy=create-amenities]').type('Wifi, TV');
    cy.get('[data-cy=create-youtube]').type('https://www.youtube.com/embed/test');
  
    cy.get('[data-cy=create-submit]').click();
  
    cy.url().should('include', '/my-listings');
    cy.contains(title).should('exist');
  
    // -------- Edit Listing --------
    cy.contains(title)
      .parents('[data-cy=listing-card]')
      .within(() => {
        cy.get('[data-cy=listing-edit]').click();
      });
  
    cy.get('[data-cy=edit-title]').clear().type(updatedTitle);
    cy.get('[data-cy=edit-submit]').click();
      
    cy.url().should('include', '/my-listings');
    cy.get('[data-cy=listing-card]', { timeout: 10000 }).should('exist');
    cy.get('[data-cy=listing-card]')
      .contains(updatedTitle)
      .should('exist');
  
    // -------- Publish Listing --------
    cy.contains(updatedTitle)
      .parents('[data-cy=listing-card]')
      .within(() => {
        cy.get('[data-cy=listing-publish]').click();
      });
  
    cy.get('[data-cy=publish-start]').clear().type(formatDate(startDate));
    cy.get('[data-cy=publish-end]').clear().type(formatDate(endDate));
    cy.get('[data-cy=publish-confirm]').click();
  
    cy.contains('Unpublish').should('exist');
  
    // -------- Host Logout --------
    cy.get('[data-cy=nav-logout]').click();
    cy.contains('Login').should('exist');
  
    // ================== Guest: register + booking ==================
  
    // -------- Register as Guest --------
    cy.get('[data-cy=nav-register]').click();
    cy.get('[data-cy=register-email]').type(guestEmail);
    cy.get('[data-cy=register-password]').type(password);
    cy.get('[data-cy=register-confirm-password]').type(password);
    cy.get('[data-cy=register-name]').type('guest');
    cy.get('[data-cy=register-submit]').click();
  
    // -------- Go to public listings & book --------
    cy.visit('http://localhost:3000');
  
    cy.contains(updatedTitle).click();
  
    cy.get('[data-cy=booking-start-date]')
      .clear()
      .type(formatDate(startDate), { force: true });
  
    cy.get('[data-cy=booking-end-date]')
      .clear()
      .type(formatDate(endDate), { force: true });
  
    cy.get('[data-cy=booking-submit]').click();
  
    cy.contains('Book confirmed.').should('exist');
  
    // -------- Guest Logout --------
    cy.get('[data-cy=nav-logout]').click();
    cy.contains('Login').should('exist');
  
    // ================== Host: login + check booking ==================
  
    cy.get('[data-cy=nav-login]').click();
    cy.get('[data-cy=login-email]').type(hostEmail);
    cy.get('[data-cy=login-password]').type(password);
    cy.get('[data-cy=login-submit]').click();
  
    cy.visit('http://localhost:3000/my-listings');
    cy.contains(updatedTitle)
      .parents('[data-cy=listing-card]')
      .within(() => {
        cy.get('[data-cy=listing-manage]').click();  
      });

    // ------------------- Accept booking -------------------
    cy.get('[data-cy=booking-row]', { timeout: 10000 }).should('exist');

    cy.get('[data-cy=booking-row]')
      .contains('[data-cy=booking-guest]', guestEmail)
      .parents('[data-cy=booking-row]')
      .within(() => {
        cy.get('[data-cy=booking-accept]').click();
      });

    cy.contains(/history/i).click();
    cy.contains(guestEmail).should('exist');
  });
});
  
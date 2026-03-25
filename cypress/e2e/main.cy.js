describe('main.js', () => {
  beforeEach(() => {
    cy.visit('http://localhost:80')
    cy.wait(10000) // Wait for the map to load
  })

  it('data markers are displayed on the map', () => {
    cy.get('.leaflet-marker-icon').should('have.length.greaterThan', 0)
  })

  it('clicking on a marker displays a popup with data', () => {
    cy.get('.leaflet-marker-icon').first().click()
    cy.get('.leaflet-popup-content').should('be.visible')
  })
})
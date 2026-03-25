describe('main.js', () => {
  beforeEach(() => {
    cy.visit('http://localhost:80')
    cy.get('#map', { timeout: 20000 }).should('be.visible')
    cy.get('.leaflet-pane', { timeout: 20000 }).should('exist')
  })

  it('should display data markers on the map', () => {
    cy.get('.leaflet-marker-icon', { timeout: 20000 }).should('have.length.greaterThan', 0)
  })

  it('should display a popup with data when clicking on a marker', () => {
    cy.get('.leaflet-marker-pane .leaflet-marker-icon.leaflet-interactive', { timeout: 20000 })
      .should('have.length.greaterThan', 0)
      .last()
      .click({ force: true })

    cy.get('.leaflet-popup-content', { timeout: 10000 }).should('be.visible')
  })

  it('should display camera markers on the map when the camera toggle is enabled', () => {
    cy.get('#map .leaflet-control-select-cam', { timeout: 20000 })
    .should('be.visible')
    .click()

    cy.get('#map .leaflet-control-select-cam').should('have.class', 'active')

    cy.window({ timeout: 30000 }).should((win) => {
    expect(win.saa.Tuulikartta.map.hasLayer(win.saa.camera.markers)).to.equal(true)
    expect(win.saa.camera.markers.getLayers().length).to.be.greaterThan(0)
  })
  })

  it('should open a new window with the camera feed when clicking on a camera marker', () => {
    cy.window().then((win) => {
      const fakeWindow = {
        onload: null,
        document: {
          getElementById: () => ({ textContent: '' }),
          title: ''
        }
      }

      cy.stub(win, 'open').callsFake(() => fakeWindow).as('windowOpen')
    })

  cy.get('#map .leaflet-control-select-cam', { timeout: 20000 })
    .should('be.visible')
    .click()

  cy.window({ timeout: 30000 }).should((win) => {
    expect(win.saa.camera.markers.getLayers().length).to.be.greaterThan(0)
  })

  cy.window().then((win) => {
    const firstCameraMarker = win.saa.camera.markers.getLayers()[0]
    firstCameraMarker.fire('click')
  })

  cy.get('@windowOpen').should('have.been.called')
  cy.get('@windowOpen')
    .its('firstCall.args.0')
    .should('include', '/html/camera.html?station=')
})
})
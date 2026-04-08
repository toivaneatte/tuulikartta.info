const stubObservationData = () => {
  cy.intercept('GET', '**/php/dataparser.php*', {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: {
      name: 'suomi_dbz_eureffin',
      dimension: '2026-04-01T10:00:00.000Z/2026-04-01T11:00:00.000Z/PT5M'
    }
  }).as('radarParser')

  cy.intercept('GET', '**/list.php', {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: []
  }).as('listFiles')

  cy.intercept('GET', '**/php/getdata.php*', { fixture: 'observations.json' }).as('getData')
}

const stubCameraData = () => {
  const nowIso = new Date().toISOString()

  cy.fixture('camera-stations.json').then((stationsBody) => {
    stationsBody.features.forEach((feature) => {
      feature.properties.dataUpdatedTime = nowIso
      feature.properties.presets.forEach((preset) => {
        preset.measuredTime = nowIso
      })
    })

    cy.intercept('GET', /\/api\/road\/cameras(?:\?.*)?$/, stationsBody).as('cameraStations')
  })

  cy.fixture('camera-station-detail.json').then((stationDetailBody) => {
    stationDetailBody.properties.dataUpdatedTime = nowIso
    stationDetailBody.properties.presets.forEach((preset) => {
      preset.measuredTime = nowIso
    })

    cy.intercept('GET', /\/api\/road\/cameras\/[^/]+(?:\?.*)?$/, stationDetailBody).as('cameraStation')
  })

  cy.fixture('camera-station-detail-data.json').then((stationDetailDataBody) => {
    stationDetailDataBody.dataUpdatedTime = nowIso
    stationDetailDataBody.presets.forEach((preset) => {
      preset.measuredTime = nowIso
    })

    cy.intercept('GET', /\/api\/road\/cameras\/[^/]+\/history(?:\?.*)?$/, stationDetailDataBody).as('cameraStationData')
  })
}

describe('main.js (stubbed)', () => {
  beforeEach(() => {
    stubObservationData()
    stubCameraData()

    cy.visit('/')
    cy.wait('@radarParser', { timeout: 20000 })
    cy.wait('@listFiles', { timeout: 20000 })
    cy.wait('@getData', { timeout: 20000 })

    cy.get('#map', { timeout: 20000 }).should('be.visible')
    cy.get('.leaflet-pane', { timeout: 20000 }).should('exist')
  })

  it('should display markers with stubbed data', () => {
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
          title: '',
          getElementById: () => ({
            textContent: '',
            innerHTML: '',
            style: { display: '' }
          })
        }
      }

      cy.stub(win, 'open').callsFake(() => fakeWindow).as('windowOpen')
    })

    cy.get('#map .leaflet-control-select-cam', { timeout: 20000 })
      .should('be.visible')
      .click()

    cy.wait('@cameraStations')

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

  it('should go 1 hour back in time when the time picker button is clicked', () => {
    // set a specific data and time to avoid flaky default values
    const seededDate = '01-04-2026'
    const seededTime = '12:30'

    cy.get('#datepicker-button', { timeout: 20000 })
      .clear({ force: true })
      .type(seededDate, { force: true })

    cy.get('#clockpicker-button', { timeout: 20000 })
      .clear({ force: true })
      .type(seededTime, { force: true })

    cy.get('#timepicker-regress-time', { timeout: 20000 }).should('be.visible').click()

    cy.get('#datepicker-button', { timeout: 20000 }).should('have.value', '01.04.2026')
    cy.get('#clockpicker-button', { timeout: 20000 }).should('have.value', '11:30')
  })

  it('should remove camera markers when the camera toggle is disabled', () => {
    cy.get('#map .leaflet-control-select-cam', { timeout: 20000 })
      .should('be.visible')
      .click()

    cy.wait('@cameraStations')

    cy.window({ timeout: 30000 }).should((win) => {
      expect(win.saa.Tuulikartta.map.hasLayer(win.saa.camera.markers)).to.equal(true)
    })

    cy.get('#map .leaflet-control-select-cam').click()

    cy.get('#map .leaflet-control-select-cam').should('not.have.class', 'active')

    cy.window({ timeout: 30000 }).should((win) => {
      expect(win.saa.Tuulikartta.map.hasLayer(win.saa.camera.markers)).to.equal(false)
    })
  })
})

describe('performance (stubbed)', () => {
  it('should render the map within the time budget', () => {
    const budgetMs = 8000

    stubObservationData()
    stubCameraData()

    cy.visit('/', {
      onBeforeLoad(win) {
        win.__mapStart = win.performance ? win.performance.now() : Date.now()
      }
    })

    cy.get('#map', { timeout: budgetMs }).should('be.visible')

    cy.window().then((win) => {
      const start = win.__mapStart || 0
      const now = win.performance ? win.performance.now() : Date.now()
      const elapsed = now - start
      expect(elapsed, 'map render time').to.be.lessThan(budgetMs)
    })
  })
})

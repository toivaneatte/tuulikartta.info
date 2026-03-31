const stubObservationData = () => {
  cy.intercept('GET', '**/list.php', {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: []
  }).as('listFiles')

  cy.intercept('GET', '**/php/getdata.php*', { fixture: 'observations.json' }).as('getData')
}

const stubCameraData = () => {
  cy.intercept('GET', '**/api/weathercam/v1/stations', { fixture: 'camera-stations.json' }).as('cameraStations')
  cy.intercept('GET', '**/api/weathercam/v1/stations/data', { fixture: 'camera-stations-data.json' }).as('cameraStationsData')
  cy.intercept('GET', '**/api/weathercam/v1/stations/*/data', { fixture: 'camera-station-detail-data.json' }).as('cameraStationData')
  cy.intercept('GET', '**/api/weathercam/v1/stations/*', { fixture: 'camera-station-detail.json' }).as('cameraStation')
}

describe('main.js (stubbed)', () => {
  beforeEach(() => {
    stubObservationData()
    stubCameraData()

    cy.visit('http://localhost:80')
    cy.wait('@listFiles')
    cy.wait('@getData')

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
    const parsePickerTime = (dateStr, timeStr) => {
      const [day, month, year] = dateStr.split('.').map((val) => Number(val))
      const [hour, minute] = timeStr.split(':').map((val) => Number(val))
      return new Date(year, month - 1, day, hour, minute, 0, 0)
    }

    const toTwoDigits = (value) => String(value).padStart(2, '0')

    const formatDate = (date) => {
      const day = toTwoDigits(date.getDate())
      const month = toTwoDigits(date.getMonth() + 1)
      const year = date.getFullYear()
      return `${day}.${month}.${year}`
    }

    const formatTime = (date) => {
      const hour = toTwoDigits(date.getHours())
      const minute = toTwoDigits(date.getMinutes())
      return `${hour}:${minute}`
    }

    cy.get('#datepicker-button', { timeout: 20000 })
      .should('not.have.value', '')
      .invoke('val')
      .then((dateBefore) => {
        cy.get('#clockpicker-button', { timeout: 20000 })
          .should('not.have.value', '')
          .invoke('val')
          .then((timeBefore) => {
            const beforeDate = parsePickerTime(dateBefore, timeBefore)
            expect(Number.isNaN(beforeDate.getTime()), 'before time parses').to.equal(false)

            const expectedDate = new Date(beforeDate.getTime() - 60 * 60 * 1000)
            const expectedDateStr = formatDate(expectedDate)
            const expectedTimeStr = formatTime(expectedDate)

            cy.get('#timepicker-regress-time', { timeout: 20000 }).should('be.visible').click()

            cy.get('#datepicker-button', { timeout: 20000 })
              .should('not.have.value', '')
              .invoke('val')
              .then((dateAfter) => {
                cy.get('#clockpicker-button', { timeout: 20000 })
                  .should('not.have.value', '')
                  .invoke('val')
                  .then((timeAfter) => {
                    expect(dateAfter).to.equal(expectedDateStr)
                    expect(timeAfter).to.equal(expectedTimeStr)
                  })
              })
          })
      })
  })

  it('should remove camera markers when the camera toggle is disabled', () => {
    cy.get('#map .leaflet-control-select-cam', { timeout: 20000 })
      .should('be.visible')
      .click()

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

    cy.visit('http://localhost:80', {
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

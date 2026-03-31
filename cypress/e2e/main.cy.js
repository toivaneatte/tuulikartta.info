describe('main.js', () => {
  beforeEach(() => {
    cy.visit('http://localhost:80')
    cy.get('#map', { timeout: 20000 }).should('be.visible')
    cy.get('.leaflet-pane', { timeout: 20000 }).should('exist')
  })

/*   it('should display data markers on the map', () => {
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
  }) */

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

            cy.get('#datepicker-button', { timeout: 20000 }).should('not.have.value', '').invoke('val').then((dateAfter) => {
              cy.get('#clockpicker-button', { timeout: 20000 }).should('not.have.value', '').invoke('val').then((timeAfter) => {
                expect(dateAfter).to.equal(expectedDateStr)
                expect(timeAfter).to.equal(expectedTimeStr)
              })
            })
          })
        })
      })
  })
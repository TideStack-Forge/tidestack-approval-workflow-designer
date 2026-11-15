const { test, expect } = require('@playwright/test')

test('loads the approval workflow harness shell', async ({ page }) => {
  await page.goto('playwright-harness.html?scenario=new-flow')
  await expect(page.getByTestId('workflow-harness-root')).toBeVisible()
})

test('keeps the editor mounted when node palette capability becomes unavailable', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.goto('playwright-harness.html?scenario=v2-editable')
  await page.waitForFunction(() => Boolean(window.__APPROVAL_WORKFLOW_HARNESS__))
  await expect(page.getByTestId('workflow-panel-left')).toBeVisible()

  await page.evaluate(() => {
    return window.__APPROVAL_WORKFLOW_HARNESS__.updateCoreCapabilities({
      allowPaletteInsert: false,
    })
  })

  await expect(page.getByTestId('workflow-panel-center')).toBeVisible()
  await expect(page.getByTestId('workflow-panel-left')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

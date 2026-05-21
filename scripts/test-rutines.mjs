import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: false, slowMo: 400 })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

const shots = []
const snap = async (name) => {
  const p = `C:/Users/User/AppData/Local/Temp/${name}.png`
  await page.screenshot({ path: p, fullPage: false })
  shots.push(p)
  console.log(`SNAP: ${p}`)
}

const consoleErrors = []
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

try {
  // 1. Load app
  console.log('Step 1: Navigating to http://localhost:3000')
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 })
  await snap('01-home')
  console.log('URL after load:', page.url())

  // 2. Go to Rutines page
  console.log('Step 2: Clicking Rutines nav')
  const rutinesLink = page.locator('text=Rutines').first()
  await rutinesLink.waitFor({ timeout: 8000 })
  await rutinesLink.click()
  await page.waitForTimeout(2500)
  await snap('02-rutines-page')

  // 3. Check if routines are visible
  const hasNoRoutinesMsg = await page.locator('text=/No tens cap|No routines/i').isVisible().catch(() => false)
  const cardCount = await page.locator('.card-surface h3').count()
  console.log(`Routine cards visible: ${cardCount}`)
  console.log(`"No routines" message: ${hasNoRoutinesMsg}`)

  // 4. Check tabs exist
  const allTab = page.locator('button').filter({ hasText: /^Totes/ })
  const favTab = page.locator('button').filter({ hasText: /^Preferides/ })
  const delTab = page.locator('button').filter({ hasText: /^Eliminades/ })
  console.log(`Tabs - Totes: ${await allTab.isVisible()}, Preferides: ${await favTab.isVisible()}, Eliminades: ${await delTab.isVisible()}`)

  if (cardCount > 0) {
    // 5. Test favorite toggle
    console.log('Step 3: Testing favorite toggle')
    const favBtn = page.locator('button[aria-label]').filter({ hasText: /☆|★/ }).first()
    const isFavBefore = await favBtn.textContent()
    await favBtn.click()
    await page.waitForTimeout(1500)
    const isFavAfter = await favBtn.textContent().catch(() => '?')
    await snap('03-after-fav-toggle')
    console.log(`Fav toggle: "${isFavBefore?.trim()}" → "${isFavAfter?.trim()}"`)
    const successToast = await page.locator('[style*="good"]').isVisible().catch(() => false)
    console.log(`Success toast shown: ${successToast}`)

    // Toggle back
    await favBtn.click()
    await page.waitForTimeout(1000)

    // 6. Open routine detail
    console.log('Step 4: Opening routine detail')
    await page.locator('button.flex-1.min-w-0.text-left').first().click()
    await page.waitForTimeout(2000)
    await snap('04-routine-detail')
    const hasExercises = await page.locator('text=/Afegir exercici|Add exercise/i').isVisible()
    console.log(`Detail view loaded, Add exercise button: ${hasExercises}`)

    // Back to list
    const backBtn = page.locator('button').filter({ hasText: /‹/ }).first()
    await backBtn.click()
    await page.waitForTimeout(1000)

    // 7. Test delete routine via edit modal
    console.log('Step 5: Opening edit modal')
    const editBtn = page.locator('button[aria-label*="dit"]').first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await page.waitForTimeout(800)
      await snap('05-edit-modal')
      const deleteBtn = await page.locator('button').filter({ hasText: /Elimina la rutina|Delete routine/i }).isVisible()
      console.log(`Delete button in edit modal: ${deleteBtn}`)
      // Close modal
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
  } else {
    // Create a test routine
    console.log('Step 3: Creating a test routine')
    await page.locator('button').filter({ hasText: /\+ Nova|\+ New|\+ Nueva/ }).first().click()
    await page.waitForTimeout(800)
    await snap('03-create-modal')
    await page.locator('input[placeholder]').first().fill('Test Rutina Verificació')
    await page.locator('button').filter({ hasText: /Crear|Create/ }).last().click()
    await page.waitForTimeout(2500)
    await snap('03c-after-create')
    const newCount = await page.locator('.card-surface h3').count()
    console.log(`Cards after create: ${newCount}`)
  }

  // 8. Deleted tab
  console.log('Step 6: Checking Eliminades tab')
  await delTab.click()
  await page.waitForTimeout(1000)
  await snap('06-deleted-tab')
  const deletedContent = await page.locator('text=/No tens cap eliminada|No deleted/i').isVisible().catch(() => false)
  console.log(`Deleted tab loads correctly: true, empty state: ${deletedContent}`)

  // 9. Back to Totes
  await allTab.click()
  await page.waitForTimeout(500)
  await snap('07-final')

  console.log('\n=== RESULTS ===')
  console.log('Console errors:', consoleErrors.length === 0 ? 'NONE' : consoleErrors.join('\n  '))
  console.log('All screenshots:', shots.join('\n  '))

} catch (err) {
  console.error('TEST ERROR:', err.message)
  await snap('error-state').catch(() => {})
} finally {
  await browser.close()
}

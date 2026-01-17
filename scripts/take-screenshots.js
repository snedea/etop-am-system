const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function takeScreenshots() {
  console.log('🚀 Launching browser...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set viewport to desktop size
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📱 Navigating to dashboard...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for content to load
    console.log('⏳ Waiting for charts to render...');
    await page.waitForSelector('.chart-container', { timeout: 10000 });

    // Give charts extra time to fully render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Take full page screenshot
    console.log('📸 Taking full page screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-full.png'),
      fullPage: true
    });

    // Take viewport screenshot (above the fold)
    console.log('📸 Taking viewport screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-hero.png'),
      fullPage: false
    });

    // Take screenshot of scores section
    console.log('📸 Taking scores section screenshot...');
    const scoresCard = await page.$('.scores-grid');
    if (scoresCard) {
      await scoresCard.screenshot({
        path: path.join(screenshotsDir, 'dashboard-scores.png')
      });
    }

    // Take screenshot of charts section
    console.log('📸 Taking charts section screenshot...');
    const chartsSection = await page.$('.charts-grid');
    if (chartsSection) {
      await chartsSection.screenshot({
        path: path.join(screenshotsDir, 'dashboard-charts.png')
      });
    }

    console.log('\n✅ Screenshots taken successfully!');
    console.log(`📁 Location: ${screenshotsDir}`);
    console.log('\n📸 Screenshots:');
    console.log('   ✓ dashboard-full.png (full page)');
    console.log('   ✓ dashboard-hero.png (above the fold)');
    console.log('   ✓ dashboard-scores.png (scores section)');
    console.log('   ✓ dashboard-charts.png (charts section)');

  } catch (error) {
    console.error('❌ Error taking screenshots:', error);
    throw error;
  } finally {
    await browser.close();
    console.log('🔒 Browser closed');
  }
}

takeScreenshots()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

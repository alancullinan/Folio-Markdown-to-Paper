const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
  await page.waitForFunction(()=>document.querySelector('#renderState').textContent.includes('Ready'),{timeout:60000});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(await page.locator('#theme').getAttribute('aria-pressed'),'true');
  const colors=await page.evaluate(()=>({editor:getComputedStyle(document.querySelector('.editor-panel')).backgroundColor,paper:getComputedStyle(document.querySelector('.pagedjs_page')).backgroundColor,ink:getComputedStyle(document.querySelector('.document')).color}));
  assert.equal(colors.editor,'rgb(32, 42, 36)');assert.equal(colors.paper,'rgb(255, 254, 250)');
  fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../test-results/dark-mode.png')});
  await page.locator('#theme').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.locator('#theme').click();await page.emulateMedia({colorScheme:'light'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.waitForFunction(()=>document.querySelector('#renderState').textContent.includes('Ready'));
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('#theme').isVisible(),false);assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');assert.equal(await page.locator('.document').first().evaluate(e=>getComputedStyle(e).color),colors.ink);
  await page.emulateMedia({media:'screen'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS: system dark theme, saved preference, toggle, paper colors, print isolation, mobile layout.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

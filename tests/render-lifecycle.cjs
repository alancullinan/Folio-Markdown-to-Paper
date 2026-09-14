const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await (process.env.FOLIO_TEST_BROWSER==='firefox'?firefox:chromium).launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.FOLIO_TEST_URL||pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
  const ready=()=>page.waitForFunction(()=>document.querySelector('#renderState').textContent.includes('Ready'),{timeout:60000});
  await ready();
  // Printing an already current preview used to leave a completed promise in the render queue.
  await page.evaluate(()=>window.print=()=>{});
  await page.locator('#print').click();
  const text=Array.from({length:35},(_,i)=>`## Section ${i+1}\n\n${'Text for checking repeated edits and linked scrolling. '.repeat(5)}\n\n`).join('');
  await page.locator('#editor').fill(text);
  await ready();
  assert.equal(await page.locator('#pages h2').count(),35);
  for (let i=1;i<=3;i++) {
    await page.locator('#editor').focus();await page.keyboard.press('Control+Home');
    await page.keyboard.type(`Edit${i} `);await ready();
    assert((await page.locator('#pages').innerText()).includes(`Edit${i}`));
  }
  // Type again while Paged.js is still rendering, leaving a redundant debounce callback.
  await page.locator('#editor').fill(text+'First queued edit.');
  await page.waitForFunction(()=>document.querySelector('#renderState').textContent.includes('Typesetting'));
  await page.locator('#editor').evaluate(e=>{e.value+=' Second queued edit.';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await ready();await page.waitForTimeout(900);
  await page.locator('#editor').evaluate(e=>{e.value+=' Final queued edit.';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await ready();
  assert((await page.locator('#pages').innerText()).includes('First queued edit. Second queued edit. Final queued edit.'));
  const line=text.slice(0,text.indexOf('## Section 16')).split('\n').length-1;
  // A scroll during the debounce period must be replayed after the new preview is ready.
  await page.locator('#editor').evaluate(e=>{e.value+=' Another edit.';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.evaluate(line=>{const e=document.querySelector('#editor'),m=document.querySelector('.source-measure');e.dispatchEvent(new Event('wheel'));e.scrollTop=m.children[line].getBoundingClientRect().top-m.getBoundingClientRect().top-72},line);
  await ready();await page.waitForTimeout(250);
  const offset=await page.evaluate(line=>document.querySelector(`#pages h2[data-source-line="${line}"]`).getBoundingClientRect().top-document.querySelector('#previewScroll').getBoundingClientRect().top,line);
  assert(Math.abs(offset-72)<8,`Deferred editor scroll alignment: ${offset}`);
  // Reverse scrolling must still move the editor after all the updates.
  const before=await page.locator('#editor').evaluate(e=>e.scrollTop);
  await page.locator('#previewScroll').hover();await page.mouse.wheel(0,550);await page.waitForTimeout(350);
  assert(await page.locator('#editor').evaluate(e=>e.scrollTop)>before+100);
  assert.deepEqual(errors,[]);
  console.log('PASS: current-preview refresh, successive edits, overlapping renders, deferred scrolling, reverse scrolling.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

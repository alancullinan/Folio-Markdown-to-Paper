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
  const source='# Heading\n\nA "quoted phrase" and **target words** for editing.\n\n'+Array.from({length:25},(_,i)=>`## Section ${i}\n\n${'A long paragraph for scrolling. '.repeat(6)}\n\n`).join('');
  await page.locator('#editor').fill(source);await ready();
  async function select(offset,end=offset){await page.locator('#editor').evaluate((e,[a,b])=>{e.focus({preventScroll:true});e.setSelectionRange(a,b);e.dispatchEvent(new Event('select'))},[offset,end]);await page.waitForTimeout(100)}
  async function aligned(offset){
    assert(await page.locator('.preview-caret').isVisible());
    const result=await page.locator('#pages strong').evaluate((el,offset)=>{const r=document.createRange();r.setStart(el.firstChild,offset);r.collapse(true);const expected=r.getBoundingClientRect(),actual=document.querySelector('.preview-caret').getBoundingClientRect();return {x:actual.left-expected.left,y:actual.top-expected.top,h:actual.height}},offset);
    assert(Math.abs(result.x)<2 && Math.abs(result.y)<2 && result.h>5,JSON.stringify(result));
  }
  // Clicking visible text shows a caret at that character, with no browser selection.
  await page.locator('#editor').evaluate(e=>{e.scrollTop=0});await page.waitForTimeout(250);
  const point=await page.locator('#pages strong').evaluate(el=>{const r=document.createRange();r.setStart(el.firstChild,3);r.setEnd(el.firstChild,4);const box=r.getBoundingClientRect();return {x:box.left+.1,y:box.top+box.height/2}});
  await page.mouse.click(point.x,point.y);await page.waitForTimeout(150);await aligned(3);
  const before=await page.locator('#previewScroll').evaluate(e=>e.scrollTop);
  await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);await aligned(4);
  assert.equal(await page.locator('#previewScroll').evaluate(e=>e.scrollTop),before);
  await page.keyboard.type('X');await ready();await page.waitForTimeout(150);await aligned(5);
  await page.keyboard.type('Y');await ready();await page.waitForTimeout(150);await aligned(6);
  // The overlay remains on the same text after zoom, without entering the document DOM.
  await page.locator('#zoom').selectOption('0.8');await select(source.indexOf('target')+6);await aligned(6);
  assert.equal(await page.locator('#pages .preview-caret').count(),0);
  assert.equal(await page.locator('.preview-caret').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  await select(0,5);assert.equal(await page.locator('.preview-caret').isVisible(),false);
  await select(source.indexOf('target')+6);await aligned(6);
  await page.locator('#linkedScroll').uncheck();await select(source.indexOf('target')+6);
  await page.locator('#previewScroll').evaluate(e=>e.scrollTop=2000);await page.waitForTimeout(150);assert.equal(await page.locator('.preview-caret').isVisible(),false);
  await page.locator('#previewScroll').evaluate(e=>e.scrollTop=0);await page.waitForTimeout(150);await aligned(6);
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.preview-caret').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: preview caret click, arrow navigation, successive edits, smart quotes, zoom, selection, clipping, print isolation.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

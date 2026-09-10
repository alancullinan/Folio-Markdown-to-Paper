const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
  const ready=async()=>{await page.waitForTimeout(800);await page.waitForFunction(()=>document.querySelector('#renderState').textContent.includes('Ready'),{timeout:60000});await page.waitForTimeout(100)};
  await ready();
  const source='# A title\n\nA paragraph with **bold words**.\n\n| A | B |\n| --- | --- |\n| One | Two |\n\n```js\nconst answer = 42;\n```\n\n[Normal link](#target)\n\n## Target\n';
  await page.locator('#editor').fill(source);await ready();
  const selected=()=>page.locator('#editor').evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd));
  await page.locator('#pages strong').click();assert.equal(await selected(),'A paragraph with **bold words**.');assert(await page.locator('#editor').evaluate(e=>e===document.activeElement));
  await page.locator('#pages h1').click();assert.equal(await selected(),'# A title');
  await page.locator('#pages td').first().click();assert.equal(await selected(),'| A | B |\n| --- | --- |\n| One | Two |');
  await page.locator('#pages pre code').click();assert.equal(await selected(),'```js\nconst answer = 42;\n```');
  await page.locator('#pages h2').focus();await page.keyboard.press('Enter');assert.equal(await selected(),'## Target');
  await page.getByRole('button',{name:'Preview',exact:true}).click();await page.locator('#pages h1').click();assert.equal(await page.locator('main').getAttribute('data-view'),'split');assert.equal(await selected(),'# A title');
  await page.locator('#linkedScroll').uncheck();await page.locator('#pages strong').click();assert.equal(await selected(),'A paragraph with **bold words**.');
  await page.keyboard.type('An edited paragraph.');await ready();assert((await page.locator('#editor').inputValue()).includes('An edited paragraph.'));await page.locator('#undo').click();assert.equal(await page.locator('#editor').inputValue(),source);await ready();
  // A normal link is still a link, rather than an edit target.
  const before=await page.locator('#editor').evaluate(e=>[e.selectionStart,e.selectionEnd]);await page.locator('#pages a').click();assert.deepEqual(await page.locator('#editor').evaluate(e=>[e.selectionStart,e.selectionEnd]),before);
  // A text selection in the preview must remain copyable.
  await page.locator('#pages h1').evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);const s=window.getSelection();s.removeAllRanges();s.addRange(r);e.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}))});assert.deepEqual(await page.locator('#editor').evaluate(e=>[e.selectionStart,e.selectionEnd]),before);
  await page.evaluate(()=>window.getSelection().removeAllRanges());
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Preview',exact:true}).click();await page.locator('#pages h1').click();assert(await page.locator('#editor').isVisible());assert.equal(await selected(),'# A title');
  assert.deepEqual(errors,[]);console.log('PASS: nested text, headings, tables, code, keyboard activation, preview-only/mobile reveal, unlinked scrolling, undo, links, and copy selection.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

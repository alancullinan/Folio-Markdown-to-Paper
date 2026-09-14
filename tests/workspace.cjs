const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await (process.env.FOLIO_TEST_BROWSER==='firefox'?firefox:chromium).launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
  const ready=async()=>{await page.waitForTimeout(800);await page.waitForFunction(()=>document.querySelector('#renderState').textContent.includes('Ready'),{timeout:60000})};
  await ready();
  const text=Array.from({length:35},(_,i)=>`## Section ${i+1}\n\n${'A paragraph with wrapping source text and readable print output. '.repeat(i%4+2)}\n\n${i%5===0?'<!-- pagebreak -->\n\n':''}`).join('');
  await page.locator('#editor').fill(text);await ready();
  const line=text.slice(0,text.indexOf('## Section 16')).split('\n').length-1;
  async function sourceToHeading(){
   await page.evaluate(line=>{const e=document.querySelector('#editor');e.dispatchEvent(new Event('wheel'));const m=document.querySelector('.source-measure');e.scrollTop=m.children[line].getBoundingClientRect().top-m.getBoundingClientRect().top-72},line);
   await page.waitForTimeout(250);
   return page.evaluate(line=>{const e=document.querySelector('#previewScroll'),h=document.querySelector(`#pages h2[data-source-line="${line}"]`);return h.getBoundingClientRect().top-e.getBoundingClientRect().top},line);
  }
  let offset=await sourceToHeading();assert(Math.abs(offset-72)<8,`Source alignment: ${offset}`);
  // Clicking the preview may reveal source, but must not realign the preview.
  await page.evaluate(line=>{
    const p=document.querySelector('#previewScroll'),h=document.querySelector(`#pages h2[data-source-line="${line}"]`);
    p.dispatchEvent(new Event('wheel'));p.scrollTop+=h.getBoundingClientRect().top-p.getBoundingClientRect().top-250;
  },line);
  await page.waitForTimeout(250);
  const clickPosition=await page.evaluate(()=>[document.querySelector('#previewScroll').scrollTop,window.scrollY]);
  await page.locator(`#pages h2[data-source-line="${line}"]`).click();
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>[document.querySelector('#previewScroll').scrollTop,window.scrollY]),clickPosition,'Preview click moved the reading position');
  assert(await page.locator('#editor').evaluate(e=>e===document.activeElement && e.selectionStart===e.selectionEnd));
  await sourceToHeading();
  // Re-pagination must not move either pane, even for a single typed character.
  for (const linked of [true,false]) {
    await page.locator('#linkedScroll').setChecked(linked);
    await page.locator('#editor').evaluate((e,text)=>{const caret=text.indexOf('## Section 16')+3;e.focus({preventScroll:true});e.setSelectionRange(caret,caret)},text);
    await page.waitForTimeout(250);
    await page.evaluate(()=>{
      window.scrollSamples=[];window.recordScroll=true;
      const sample=()=>{window.scrollSamples.push([document.querySelector('#editor').scrollTop,document.querySelector('#previewScroll').scrollTop]);if(window.recordScroll)requestAnimationFrame(sample)};sample();
    });
    await page.keyboard.type('x');await ready();await page.waitForTimeout(200);
    const samples=await page.evaluate(()=>{window.recordScroll=false;return window.scrollSamples});
    for (const pane of [0,1]) {const values=samples.map(sample=>sample[pane]);assert(Math.max(...values)-Math.min(...values)<3,`Typing moved pane ${pane} (linked=${linked}): ${Math.min(...values)}..${Math.max(...values)}`)}
    await page.keyboard.press('Backspace');await ready();
  }
  await page.locator('#linkedScroll').check();await sourceToHeading();
  await page.evaluate(line=>{const p=document.querySelector('#previewScroll');p.dispatchEvent(new Event('wheel'));const h=document.querySelector(`#pages h2[data-source-line="${line+6}"]`)||document.querySelectorAll('#pages h2')[18];p.scrollTop+=h.getBoundingClientRect().top-p.getBoundingClientRect().top-72},line);
  await page.waitForTimeout(250);
  const linkedPosition=await page.locator('#editor').evaluate(e=>e.scrollTop);assert(linkedPosition>1000);
  await page.locator('#linkedScroll').uncheck();const before=await page.locator('#previewScroll').evaluate(e=>e.scrollTop);await page.locator('#editor').evaluate(e=>{e.dispatchEvent(new Event('wheel'));e.scrollTop=100});await page.waitForTimeout(250);assert.equal(await page.locator('#previewScroll').evaluate(e=>e.scrollTop),before);
  await page.locator('#linkedScroll').check();await page.waitForTimeout(250);
  await page.locator('#zoom').selectOption('0.6');await page.waitForTimeout(250);offset=await sourceToHeading();assert(Math.abs(offset-72)<8,`Zoom alignment: ${offset}`);
  const width=await page.locator('#editor').evaluate(e=>e.clientWidth);await page.locator('#divider').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await page.locator('#editor').evaluate(e=>e.clientWidth)>width);
  const handle=await page.locator('#divider').boundingBox();await page.mouse.move(handle.x+4,handle.y+100);await page.mouse.down();await page.mouse.move(800,handle.y+100,{steps:5});await page.mouse.up();await page.waitForTimeout(250);assert(await page.locator('#editor').evaluate(e=>e.clientWidth)>750);offset=await sourceToHeading();assert(Math.abs(offset-72)<8,`Resize alignment: ${offset}`);
  const persisted=await page.locator('#divider').getAttribute('aria-valuenow');await page.reload();await ready();assert.equal(await page.locator('#divider').getAttribute('aria-valuenow'),persisted);
  await page.locator('#editor').fill('Before\n\nA heading\n\nAfter');await page.locator('#editor').evaluate(e=>e.setSelectionRange(10,15));await page.getByTitle('Heading',{exact:true}).click();await ready();assert.equal(await page.locator('#pages h1').textContent(),'A heading');await page.locator('#undo').click();assert.equal(await page.locator('#editor').inputValue(),'Before\n\nA heading\n\nAfter');await page.locator('#redo').click();assert((await page.locator('#editor').inputValue()).includes('# A heading'));
  // Fit width must keep growing beyond 100% on wide previews.
  await page.setViewportSize({width:2400,height:1000});await page.locator('#zoom').selectOption('fit');await page.locator('#divider').focus();await page.keyboard.press('Home');await page.waitForTimeout(300);
  const fitSize=await page.evaluate(()=>({page:document.querySelector('.pagedjs_page').getBoundingClientRect().width,available:document.querySelector('#previewScroll').clientWidth-60,zoom:Number(document.querySelector('#pages').style.zoom)}));assert(fitSize.zoom>1);assert(Math.abs(fitSize.page-fitSize.available)<2);
  await page.locator('#zoom').selectOption('1');await page.waitForTimeout(200);assert.equal(await page.locator('#pages').evaluate(e=>Number(e.style.zoom)),1);
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('#divider').isVisible(),false);assert.equal(await page.locator('.source-measure').isVisible(),false);await page.emulateMedia({media:'screen'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#divider').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS: content scrolling, reverse scrolling, toggle, zoom, pointer/keyboard resizing, persistence, headings, undo/redo, print isolation, mobile layout.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

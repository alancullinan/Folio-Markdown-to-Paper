const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
 const ready=async()=>{await page.waitForTimeout(800);await page.waitForFunction(()=>document.querySelector('#renderState').textContent.includes('Ready'),{timeout:60000})};await ready();
 await page.locator('#editor').fill('# A styled document\n\nA paragraph with **bold** and *italic* text. [A link](https://example.com)\n\n> A quotation.\n\n---\n\n| Item | Detail |\n| --- | --- |\n'+Array.from({length:85},(_,i)=>`| Row ${i+1} | Clear and readable table content. |`).join('\n'));await ready();
 await page.locator('#typeface').selectOption('source-sans');await ready();assert((await page.locator('.document').first().evaluate(e=>getComputedStyle(e).fontFamily)).includes('Source Sans 3'));
 await page.locator('#styles').click();await page.locator('#headingFont').selectOption('lora');await page.locator('#tableStyle').selectOption('striped');await page.locator('#tableAccent').selectOption('navy');await ready();
 assert((await page.locator('#pages h1').evaluate(e=>getComputedStyle(e).fontFamily)).includes('Lora'));
 assert(await page.evaluate(()=>document.fonts.check('400 16px "Lora"')&&document.fonts.check('700 16px "Source Sans 3"')));
 const tables=await page.locator('#pages table').evaluateAll(ts=>ts.map(t=>({header:!!t.tHead,rows:t.querySelectorAll('tbody tr').length})));assert(tables.length>1);assert(tables.every(t=>t.header),JSON.stringify(tables));assert.equal(tables.reduce((n,t)=>n+t.rows,0),85);
 for(const selector of ['#pages h1','#pages a','#pages blockquote'])assert.equal(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).color),'rgb(38, 77, 120)');
 assert.equal(await page.locator('#pages hr').first().evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(196, 211, 227)');
 const stripe=await page.locator('#pages .folio-row-odd td').first().evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(stripe,'rgb(237, 242, 248)');
 await page.locator('#tableStyle').selectOption('grid');await ready();assert(parseFloat(await page.locator('#pages td').first().evaluate(e=>getComputedStyle(e).borderLeftWidth))>.5);
 await page.locator('#tableStyle').selectOption('compact');await ready();assert(parseFloat(await page.locator('#pages td').first().evaluate(e=>getComputedStyle(e).paddingTop))<6);
 await page.locator('#repeatHeaders').uncheck();await ready();assert.equal(await page.locator('#pages thead').count(),1);
 await page.locator('#repeatHeaders').check();await page.locator('#tableStyle').selectOption('striped');await ready();await page.locator('#closeStyles').click();
 fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../test-results/document-style.png')});await page.pdf({path:path.resolve(__dirname,'../test-results/document-style.pdf'),preferCSSPageSize:true,printBackground:true});
 await page.reload();await ready();assert.equal(await page.locator('#typeface').inputValue(),'source-sans');assert.equal(await page.locator('#headingFont').inputValue(),'lora');assert.equal(await page.locator('#tableStyle').inputValue(),'striped');assert(await page.locator('#repeatHeaders').isChecked());
 for(const family of ['source-serif','lora','mono']){await page.locator('#typeface').selectOption(family);await ready();assert(!await page.locator('#pdf').isDisabled())}
 assert.deepEqual(errors,[]);console.log('PASS: bundled fonts, independent heading font, table presets, accent, repeated headers, row preservation, PDF generation, and saved preferences.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

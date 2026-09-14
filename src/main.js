import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import tasks from 'markdown-it-task-lists';
import deflist from 'markdown-it-deflist';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import mark from 'markdown-it-mark';
import ins from 'markdown-it-ins';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import {Previewer} from 'pagedjs';
import documentCSS from './document.css';
import {sourceLocations, blockLocation, setupWorkspace} from './workspace.js';
import {setupTheme} from './theme.js';
import {documentStyle,loadDocumentFonts,repeatTableHeaders} from './document-style.js';
const $=id=>document.getElementById(id), editor=$('editor');
const sample = `# A good idea deserves a beautiful page.

Folio is a quiet space for your Markdown. **Write on the left. See the finished page on the right.** When it is ready, take it to paper.

## From first draft to final copy

Open a **.md** file, drop one onto this window, or start writing. Your changes are kept as a local browser draft. Use **Save .md** to download your work.

> Make something worth reading.\n> Then give it room to breathe.

### A few things to try

- [x] A4 pages with real page boundaries
- [x] Clean, selectable text in PDF exports
- [ ] Write your next great document

| Detail | Default | Your choice |
| :--- | :--- | :--- |
| Paper | A4 | A4, A5 or Letter |
| Margins | 20 mm | 15, 20 or 25 mm |
| Typography | Editorial serif | Serif or sans |

### Small details, beautifully handled

Use *italics*, **bold**, ~~strikethrough~~ and ==a little emphasis==. Add links to [your favourite places](https://example.com), inline \`code\`, and footnotes.[^note]

[^note]: Footnotes appear at the end of your document.

<!-- pagebreak -->

## There is more beneath the surface

### Code that stays readable

\`\`\`javascript
const page = { size: "A4", margin: "20mm" };
function publish(document) {
  return document.toSomethingBeautiful(page);
}
\`\`\`

### Room for a little mathematics

Einstein’s familiar equation, $E = mc^2$, fits neatly into a sentence. Display equations get a line of their own:

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

### Ideas, connected

\`\`\`mermaid
flowchart LR
    A[Write] --> B[Refine]
    B --> C[Print or PDF]
\`\`\`

Markdown
: Plain text with a little structure and a lot of possibility.

---

**Ready to make it yours?** Choose New for a blank page, or Open .md to bring in your document.
`;
let math=[]; const mathEngine={renderToString(tex,opts){const id=math.push({tex,opts:{...opts}})-1;return `<span data-math="${id}"></span>`;}};
const md=new MarkdownIt({html:true,linkify:true,typographer:true,highlight:(code,lang)=>lang&&hljs.getLanguage(lang)?hljs.highlight(code,{language:lang,ignoreIllegals:true}).value:''}).use(footnote).use(tasks).use(deflist).use(sub).use(sup).use(mark).use(ins).use(texmath,{engine:mathEngine,delimiters:'dollars',katexOptions:{trust:false,strict:'ignore'}});
sourceLocations(md);
const fence=md.renderer.rules.fence;
let diagrams=[];
md.renderer.rules.fence=(tokens,idx,opts,env,self)=>{
 if(tokens[idx].info.trim()==='mermaid'){const id=diagrams.push(tokens[idx].content)-1;return `<div class="mermaid-diagram" data-diagram="${id}"${blockLocation(tokens[idx])}></div>`;}return `<div${blockLocation(tokens[idx])}>${fence(tokens,idx,opts,env,self)}</div>`;
};
const htmlBlock=md.renderer.rules.html_block;
md.renderer.rules.html_block=(tokens,i,...args)=>tokens[i].content.trim()==='<!-- pagebreak -->'?'<div class="page-break"></div>':htmlBlock(tokens,i,...args);
mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,theme:'base',themeVariables:{fontFamily:'Calibri, sans-serif',primaryColor:'#edf2e8',primaryTextColor:'#24332f',primaryBorderColor:'#6b9275',lineColor:'#6b9275'},flowchart:{htmlLabels:false}});
let revision=0,rendered=-1,running=null,timer,previewer,dirty=false,lastSaved='',imageMap=new Map(),toastTimer;
const printStyle=document.createElement('style');document.head.append(printStyle);
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500)}
function settings(){return {paper:$('paper').value,margin:$('margin').value,typeface:$('typeface').value,fontsize:$('fontsize').value,numbers:$('numbers').checked,headingFont:$('headingFont').value,tableStyle:$('tableStyle').value,tableAccent:$('tableAccent').value,repeatHeaders:$('repeatHeaders').checked}}
function persist(){try{localStorage.setItem('folio-draft-v1',JSON.stringify({text:editor.value,name:$('filename').value,settings:settings()}));$('saveState').textContent=dirty?'Draft saved in browser':'Saved .md';}catch{$('saveState').textContent='Browser storage unavailable · save .md'}}
function stats(){const s=editor.value;const words=(s.trim().match(/\S+/g)||[]).length;$('stats').textContent=`${words.toLocaleString()} words · ${s.length.toLocaleString()} characters`;const before=s.slice(0,editor.selectionStart).split('\n');$('caret').textContent=`Ln ${before.length}, Col ${before.at(-1).length+1}`}
let history=[],historyIndex=0,restoring=false,lastEditTime=0,lastEditType='',lastCursor=-1,mergeTyping=false;
function snapshot(){return {text:editor.value,start:editor.selectionStart,end:editor.selectionEnd,scroll:editor.scrollTop}}
function historyButtons(){$('undo').disabled=historyIndex===0;$('redo').disabled=historyIndex===history.length-1}
function resetHistory(){history=[snapshot()];historyIndex=0;lastEditType='';lastCursor=-1;historyButtons()}
function rememberSelection(){if(history[historyIndex]?.text===editor.value)history[historyIndex]=snapshot()}
function recordHistory(event){
 if(restoring||history[historyIndex]?.text===editor.value)return;
 const kind=event?.inputType||'command',now=Date.now();
 const merge=mergeTyping&&historyIndex===history.length-1&&historyIndex>0&&kind===lastEditType&&now-lastEditTime<750&&['insertText','deleteContentBackward','deleteContentForward'].includes(kind);
 history.splice(historyIndex+1);
 if(merge)history[historyIndex]=snapshot();else{history.push(snapshot());historyIndex++}
 // Bound memory when documents contain large embedded images.
 let bytes=history.reduce((sum,s)=>sum+s.text.length*2,0);
 while(history.length>2&&(history.length>100||bytes>16*1024*1024)){bytes-=history.shift().text.length*2;historyIndex--}
 lastEditTime=now;lastEditType=kind;lastCursor=editor.selectionEnd;mergeTyping=false;historyButtons();
}
function travelHistory(step){const next=historyIndex+step;if(next<0||next>=history.length)return;rememberSelection();historyIndex=next;const state=history[next];restoring=true;editor.value=state.text;editor.focus();editor.setSelectionRange(state.start,state.end);editor.scrollTop=state.scroll;changed();restoring=false;lastEditType='';lastCursor=-1;historyButtons()}
function changed(event){workspace?.invalidate();recordHistory(event);dirty=editor.value!==lastSaved;revision++;stats();persist();$('renderState').textContent='Updating pages…';clearTimeout(timer);timer=setTimeout(ensureRendered,150)}
let workspace;
function fit(align=true){const page=$('pages').querySelector('.pagedjs_page');if(!page)return;const v=$('zoom').value;$('pages').style.zoom=v==='fit'?Math.max(.2,($('previewScroll').clientWidth-60)/page.offsetWidth):Number(v);workspace?.refresh(align)}
async function renderOnce(){
 const rev=revision, source=editor.value,opts=settings();$('pdf').disabled=$('print').disabled=true;$('renderState').textContent='Typesetting…';
 diagrams=[];math=[];const raw=md.render(source||' ');const wrap=document.createElement('article');wrap.className='document';
 wrap.innerHTML=DOMPurify.sanitize(raw,{FORBID_TAGS:['style','script','iframe','object','embed','form','button','textarea','select','link','meta','base'],FORBID_ATTR:['style','srcset'],ADD_ATTR:['data-diagram','data-math']});
 for(const el of wrap.querySelectorAll('[data-math]')){const item=math[+el.dataset.math];if(item)katex.render(item.tex,el,{...item.opts,trust:false,throwOnError:false});}
 // Inline table alignment is generated by the parser, and safely re-applied as a constrained value.
 const template=document.createElement('template');template.innerHTML=raw;
 template.content.querySelectorAll('th,td').forEach((cell,i)=>{const align=cell.style.textAlign;if(['left','right','center'].includes(align)){const dest=wrap.querySelectorAll('th,td')[i];if(dest)dest.style.textAlign=align}});
 wrap.querySelectorAll('details').forEach(d=>d.open=true);
 wrap.querySelectorAll('a').forEach(a=>{if(!a.getAttribute('href')?.startsWith('#')){a.target='_blank';a.rel='noopener noreferrer'}});
 let warnings=0;
 for(const el of wrap.querySelectorAll('[data-diagram]')){try{const {svg}=await mermaid.render(`diagram${rev}_${el.dataset.diagram}`,diagrams[+el.dataset.diagram]);el.innerHTML=DOMPurify.sanitize(svg,{USE_PROFILES:{html:true,svg:true,svgFilters:true},ADD_TAGS:['style','foreignObject']});}catch{el.className='render-error';el.textContent='Diagram could not be rendered. Check the Mermaid syntax.\n'+diagrams[+el.dataset.diagram];warnings++}}
 for(const img of wrap.querySelectorAll('img')){const src=img.getAttribute('src');if(imageMap.has(src))img.src=imageMap.get(src);img.loading='eager';img.removeAttribute('width');img.removeAttribute('height')}
 await Promise.all([...wrap.querySelectorAll('img')].map(img=>new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(t);if(!img.naturalWidth){warnings++;const label=document.createElement('span');label.className='render-error';label.textContent=`[Image unavailable: ${img.alt||img.getAttribute('src')}]`;img.replaceWith(label)}resolve()};const t=setTimeout(finish,5000);img.onload=img.onerror=finish;if(img.complete)finish()})));
 wrap.querySelectorAll('tbody').forEach(body=>[...body.rows].forEach((row,i)=>row.classList.toggle('folio-row-odd',i%2===0)));
 await loadDocumentFonts(opts);
 await document.fonts.ready;
 if(rev!==revision)return;
 const restorePosition=workspace?.preserveRenderPosition();
 try {
 if(previewer){previewer.chunker.destroy();previewer.polisher.destroy();}
 $('pages').innerHTML='';previewer=new Previewer();if(opts.repeatHeaders)repeatTableHeaders(previewer);
 const css=`${documentCSS}\n@page { size: ${opts.paper}; margin: ${opts.margin}mm; @bottom-center { content: ${opts.numbers?'counter(page)':'none'}; font-family: Calibri, sans-serif; font-size: 9pt; color: #859087; } } .document {font-family:${opts.typeface==='sans'?"Calibri, 'Segoe UI', sans-serif":"Georgia, 'Times New Roman', serif"};font-size:${opts.fontsize}pt;}`;
 const flow=await previewer.preview(wrap.outerHTML,[{[location.href]:css+'\n'+documentStyle(opts)}],$('pages'));
 printStyle.textContent=`@media print { @page { size: ${opts.paper}; margin: 0; } }`;document.head.append(printStyle);
 rendered=rev;fit(false);$('pageCount').textContent=`/ ${flow.total} ${flow.total===1?'PAGE':'PAGES'}`;$('renderState').textContent=warnings?`Ready · ${warnings} image or diagram warning(s)`:`${opts.paper} · ${opts.margin} mm margins · Ready to print`;
 } finally {restorePosition?.()}
}
// Clear the queue after assigning its promise, even when there is nothing new to render.
async function ensureRendered(){if(running)return running;clearTimeout(timer);running=(async()=>{try{while(rendered!==revision)await renderOnce()}catch(err){$('renderState').textContent='Preview failed — your source is safe. Edit to retry.';toast('Could not render this document. '+err.message);console.error(err)}})().finally(()=>{running=null;$('pdf').disabled=$('print').disabled=rendered!==revision});return running}
function insert(before,after='',placeholder='text'){rememberSelection();const start=editor.selectionStart,end=editor.selectionEnd,selection=editor.value.slice(start,end)||placeholder;editor.focus();editor.setRangeText(before+selection+after,start,end,'select');editor.setSelectionRange(start+before.length,start+before.length+selection.length);changed()}
function heading(level){
 rememberSelection();const value=editor.value,start=editor.selectionStart,end=editor.selectionEnd;
 const lineStart=start===0?0:value.lastIndexOf('\n',start-1)+1;
 const lastSelected=end>start&&value[end-1]==='\n'?end-1:end;
 const nextNewline=value.indexOf('\n',lastSelected),lineEnd=nextNewline<0?value.length:nextNewline;
 const replacement=value.slice(lineStart,lineEnd).split('\n').map(line=>'#'.repeat(level)+' '+line.replace(/^[\t ]*(?:#{1,6}(?:[\t ]+|$))?/, '')).join('\n');
 editor.focus();editor.setRangeText(replacement,lineStart,lineEnd,'select');changed();
}
function save(){let name=$('filename').value.trim()||'Untitled.md';if(!/\.(md|markdown|mdown)$/i.test(name))name+='.md';const url=URL.createObjectURL(new Blob([editor.value],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);lastSaved=editor.value;dirty=false;persist();toast('Markdown downloaded')}
function canReplace(){return !dirty||confirm('Replace this draft? Save .md first if you want to keep a copy.')}
async function openFile(file){if(!file)return;if(!/\.(md|markdown|mdown|txt)$/i.test(file.name)){toast('Choose a Markdown (.md) or plain-text file');return}if(!canReplace())return;try{editor.value=await file.text();$('filename').value=file.name;imageMap.clear();lastSaved=editor.value;resetHistory();changed();toast('Opened '+file.name)}catch{toast('Could not read that file')}}
async function printDoc(pdf=false){if(pdf)toast('Choose Save as PDF; use 100% scale and turn off browser headers and footers.');await ensureRendered();if(rendered!==revision)return;document.title=$('filename').value.replace(/\.(md|markdown|mdown)$/i,'')||'Untitled';window.print()}
editor.addEventListener('input',changed);editor.addEventListener('click',stats);editor.addEventListener('keyup',stats);
editor.addEventListener('beforeinput',e=>{if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();travelHistory(e.inputType==='historyUndo'?-1:1);return}mergeTyping=editor.selectionStart===editor.selectionEnd&&editor.selectionStart===lastCursor;rememberSelection()});
$('undo').onclick=()=>travelHistory(-1);$('redo').onclick=()=>travelHistory(1);
document.addEventListener('keydown',e=>{if(e.isComposing||!(e.ctrlKey||e.metaKey)||e.altKey||$('guide').open)return;const target=e.target;if(target!==editor&&target.closest('input,textarea,select'))return;const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();travelHistory(key==='y'||e.shiftKey?1:-1)}});
document.querySelectorAll('[data-before]').forEach(b=>b.onclick=()=>/^#{1,6} $/.test(b.dataset.before)?heading(b.dataset.before.trim().length):insert(b.dataset.before,b.dataset.after||''));
$('code').onclick=()=>insert('\n```javascript\n','\n```\n','// Your code here');$('table').onclick=()=>insert('\n','\n','| Column | Column |\n| --- | --- |\n| Cell | Cell |');$('break').onclick=()=>insert('\n\n<!-- pagebreak -->\n\n','','');
$('save').onclick=save;$('open').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>{openFile(e.target.files[0]);e.target.value=''};
$('new').onclick=()=>{if(!canReplace())return;editor.value='';$('filename').value='Untitled.md';lastSaved='';imageMap.clear();resetHistory();changed();editor.focus()};
$('filename').oninput=()=>{dirty=true;persist()};['paper','margin','typeface','fontsize','numbers','headingFont','tableStyle','tableAccent','repeatHeaders'].forEach(id=>$(id).onchange=changed);
$('styles').onclick=()=>$('styleDialog').showModal();$('closeStyles').onclick=()=>$('styleDialog').close();
$('zoom').onchange=fit;new ResizeObserver(fit).observe($('previewScroll'));
document.querySelectorAll('[data-view]').forEach(b=>{if(b.tagName!=='BUTTON')return;b.onclick=()=>{document.querySelector('main').dataset.view=b.dataset.view;document.querySelectorAll('.view-tabs button').forEach(t=>t.classList.toggle('selected',t===b));fit()}});
$('pdf').onclick=()=>printDoc(true);$('print').onclick=()=>printDoc(false);$('help').onclick=()=>$('guide').showModal();$('closeHelp').onclick=()=>$('guide').close();
$('images').onclick=()=>$('imageInput').click();$('imageInput').onchange=async e=>{for(const file of e.target.files){const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const refs=[...editor.value.matchAll(/!\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)].filter(m=>{try{return decodeURIComponent(m[1]).split('/').at(-1)===file.name}catch{return false}});if(refs.length){for(const ref of refs){editor.value=editor.value.replace(ref[0],ref[0].replace(ref[1],data))}changed()}else insert(`\n![${file.name.replace(/[\[\]]/g,'')}](${data})\n`,'','')}e.target.value='';toast('Images embedded in Markdown — save .md to keep them')};
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey))return;const key=e.key.toLowerCase();if(['s','o','p'].includes(key)){e.preventDefault();if(key==='s')save();if(key==='o')$('fileInput').click();if(key==='p')printDoc()}if(document.activeElement===editor&&['b','i'].includes(key)){e.preventDefault();insert(key==='b'?'**':'*',key==='b'?'**':'*')}});
let dragDepth=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();dragDepth++;document.body.classList.add('dragging')}});document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragleave',()=>{if(--dragDepth<=0)document.body.classList.remove('dragging')});document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;document.body.classList.remove('dragging');openFile(e.dataTransfer.files[0])});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
editor.value=sample;try{const draft=JSON.parse(localStorage.getItem('folio-draft-v1'));if(draft&&typeof draft.text==='string'){editor.value=draft.text;$('filename').value=draft.name||'Untitled.md';for(const [key,val]of Object.entries(draft.settings||{})){if(['numbers','repeatHeaders'].includes(key))$(key).checked=!!val;else if($(key)?.options&&[...$(key).options].some(o=>o.value===String(val)))$(key).value=val}}}catch{}
setupTheme();
workspace=setupWorkspace({editor,preview:$('previewScroll'),pages:$('pages'),fit,isReady:()=>rendered===revision});
lastSaved=editor.value;resetHistory();stats();ensureRendered();





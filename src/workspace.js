// Map source lines to rendered blocks, rather than matching scrollbar percentages.
export function sourceLocations(md) {
  md.core.ruler.push('folio-source-locations', state => {
    for (const token of state.tokens) {
      if (token.map && ['heading_open', 'paragraph_open', 'list_item_open', 'table_open', 'hr'].includes(token.type)) {
        token.attrSet('data-source-line', String(token.map[0]));
        token.attrSet('data-source-end', String(token.map[1]));
      }
    }
  });
}

export function blockLocation(token) {
  return token.map ? ` data-source-line="${token.map[0]}" data-source-end="${token.map[1]}"` : '';
}

export function setupWorkspace({ editor, preview, pages, fit, isReady }) {
  const main = document.querySelector('main');
  const divider = document.getElementById('divider');
  const linked = document.getElementById('linkedScroll');
  const mirror = document.createElement('div');
  mirror.className = 'source-measure';
  mirror.setAttribute('aria-hidden', 'true');
  document.body.append(mirror);
  let anchors = [], lineOffsets = [], lineEnd = 0, measuredText = null, measuredWidth = 0;
  let mapDirty = true, scheduled = 0, leader = editor, suppress = null, suppressionTimer;
  let split = 38;
  try { const saved = JSON.parse(localStorage.getItem('folio-workspace-v1')); if (saved) { linked.checked = saved.linked !== false; split = Math.max(25, Math.min(70, Number(saved.split) || 38)); } } catch {}
  const save = () => { try { localStorage.setItem('folio-workspace-v1', JSON.stringify({linked: linked.checked, split})); } catch {} };
  const splitVisible = () => main.dataset.view === 'split' && matchMedia('(min-width: 721px)').matches;
  function setSplit(value) {
    split = Math.max(25, Math.min(70, value));
    main.style.setProperty('--editor-width', `${split}%`);
    divider.setAttribute('aria-valuenow', String(Math.round(split)));
    divider.setAttribute('aria-valuetext', `Editor ${Math.round(split)} percent`);
    invalidate();
  }
  setSplit(split);

  function measureSource() {
    if (measuredText === editor.value && measuredWidth === editor.clientWidth) return;
    const style = getComputedStyle(editor);
    for (const key of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft']) mirror.style[key] = style[key];
    mirror.style.width = `${editor.clientWidth}px`;
    mirror.replaceChildren(...editor.value.split('\n').map(line => {
      const row = document.createElement('div'); row.textContent = line || '\u200b'; return row;
    }));
    const top = mirror.getBoundingClientRect().top;
    lineOffsets = [...mirror.children].map(row => row.getBoundingClientRect().top - top);
    lineEnd = mirror.lastElementChild.getBoundingClientRect().bottom - top;
    measuredText = editor.value; measuredWidth = editor.clientWidth;
  }
  function buildMap() {
    measureSource();
    const box = preview.getBoundingClientRect();
    const groups = new Map();
    for (const el of pages.querySelectorAll('[data-source-line]')) {
      // Prefer the smallest block. Nested list containers otherwise duplicate paragraphs.
      if (el.querySelector('[data-source-line]')) continue;
      const start = Number(el.dataset.sourceLine), end = Number(el.dataset.sourceEnd);
      if (!Number.isInteger(start) || start < 0 || start >= lineOffsets.length || !Number.isInteger(end) || end <= start) continue;
      const r = el.getBoundingClientRect(); if (r.height <= 0) continue;
      const key = `${start}:${end}`;
      if (!groups.has(key)) groups.set(key, {start, end, pieces: []});
      groups.get(key).pieces.push({y: r.top - box.top + preview.scrollTop, height: r.height});
    }
    const points = [];
    for (const {start, end, pieces} of groups.values()) {
      pieces.sort((a,b) => a.y-b.y);
      const total = pieces.reduce((n,p) => n+p.height,0);
      const sourceStart = lineOffsets[start];
      const sourceEnd = end < lineOffsets.length ? lineOffsets[end] : lineEnd;
      let used = 0;
      for (const piece of pieces) {
        points.push({source: sourceStart+(sourceEnd-sourceStart)*used/total, preview: piece.y});
        used += piece.height;
      }
      const last = pieces.at(-1);
      points.push({source: sourceEnd, preview: last.y+last.height});
    }
    points.sort((a,b) => a.source-b.source || a.preview-b.preview);
    anchors = [];
    for (const point of points) {
      const previous = anchors.at(-1);
      if (!previous || (point.source > previous.source+.1 && point.preview >= previous.preview)) anchors.push(point);
    }
    mapDirty = false;
  }
  function interpolate(value, from, to) {
    if (!anchors.length) return 0;
    if (value <= anchors[0][from]) return anchors[0][to];
    for (let i=1;i<anchors.length;i++) {
      if (value <= anchors[i][from]) {
        const a=anchors[i-1], b=anchors[i], length=b[from]-a[from];
        return length ? a[to]+(b[to]-a[to])*(value-a[from])/length : b[to];
      }
    }
    return anchors.at(-1)[to];
  }
  function sync(from=leader) {
    if (!linked.checked || !splitVisible() || !isReady()) return;
    if (mapDirty) buildMap();
    if (!anchors.length) return;
    const to = from===editor ? preview : editor;
    // Align the content at a shared reading position, leaving room above it.
    const fromInset = Math.min(72, from.clientHeight*.15), toInset = Math.min(72,to.clientHeight*.15);
    const maximum = from.scrollHeight-from.clientHeight;
    let target = interpolate(from.scrollTop+fromInset, from===editor?'source':'preview', from===editor?'preview':'source')-toInset;
    if (from.scrollTop<=1) target=0;
    else if (maximum>1 && from.scrollTop>=maximum-1) target=to.scrollHeight-to.clientHeight;
    target=Math.max(0,Math.min(to.scrollHeight-to.clientHeight,target));
    if (Math.abs(to.scrollTop-target)<1) return;
    suppress=to; clearTimeout(suppressionTimer);
    to.scrollTop=target;
    suppressionTimer=setTimeout(()=>{suppress=null},120);
  }
  function onScroll(event) {
    if (event.currentTarget===suppress) return;
    leader=event.currentTarget;
    cancelAnimationFrame(scheduled);
    scheduled=requestAnimationFrame(()=>sync(leader));
  }
  function invalidate() { mapDirty=true; }
  function decoratePreview() {
    if (!isReady()) return;
    for (const block of pages.querySelectorAll('[data-source-line]')) {
      if (block.querySelector('[data-source-line]')) continue;
      block.tabIndex = 0;
      block.setAttribute('title', 'Click or press Enter to edit the Markdown source');
      block.setAttribute('aria-keyshortcuts', 'Enter');
    }
  }
  function comparableText(value) {
    const positions = [];
    const decoder = document.createElement('textarea');
    let text = '';
    const pattern = /&(?:#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);|\\[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]|\.\.\.|---|--|\([cCrR]\)|\([tT][mM]\)|\+-|[\s\S]/g;
    for (const match of value.matchAll(pattern)) {
      let part = match[0];
      if (part.startsWith('&') && part.endsWith(';')) { decoder.innerHTML = part; part = decoder.value; }
      else if (part.startsWith('\\') && part.length === 2) part = part.slice(1);
      const replacements = {'...':'\u2026','---':'\u2014','--':'\u2013','(c)':'\u00a9','(r)':'\u00ae','(tm)':'\u2122','+-':'\u00b1'};
      part = replacements[part.toLowerCase()] || part;
      part = part.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s/g, ' ');
      for (let i=0;i<part.length;i++) {positions.push(match.index);text += part[i];}
    }
    positions.push(value.length);
    return {text, positions};
  }
  function clickedOffset(block, event, start, end) {
    if (!event) return start;
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const range = !point && document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const node = point?.offsetNode || range?.startContainer;
    const offset = point?.offset ?? range?.startOffset;
    if (!node || node.nodeType !== Node.TEXT_NODE || !block.contains(node)) return start;
    // Generated diagrams and equations do not have a direct text-to-source mapping.
    if (node.parentElement.closest('svg, .katex, [data-diagram], [data-math]')) return start;
    const source = editor.value.slice(start, end);
    let cursor = 0;
    const comparable = comparableText(source);
    // Include earlier page fragments so repeated text maps to the correct occurrence.
    for (const piece of pages.querySelectorAll('[data-source-line]')) {
      if (piece.dataset.sourceLine !== block.dataset.sourceLine || piece.dataset.sourceEnd !== block.dataset.sourceEnd || piece.querySelector('[data-source-line]')) continue;
      const walker = document.createTreeWalker(piece, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (text.parentElement.closest('svg, .katex, [data-diagram], [data-math]')) continue;
        if (!text.data.trim()) continue; // Layout whitespace between table cells is not source text.
        const index = source.indexOf(text.data, cursor);
        if (index >= 0) {
          if (text === node) return start + index + offset;
          cursor = index + text.length;
          continue;
        }
        // Smart quotes, entities and escapes change rendered text and its length.
        const rendered = comparableText(text.data);
        const from = comparable.positions.findIndex(position => position >= cursor);
        const match = comparable.text.indexOf(rendered.text, from);
        if (text === node) {
          if (match < 0) return start;
          const boundary = rendered.positions.findIndex(position => position >= offset);
          return start + comparable.positions[match + boundary];
        }
        if (match >= 0) cursor = comparable.positions[match + rendered.text.length];
      }
      if (piece === block) break;
    }
    return start;
  }
  function editBlock(block, event) {
    if (!isReady()) return;
    const lines = editor.value.split('\n');
    const startLine = Number(block.dataset.sourceLine), endLine = Number(block.dataset.sourceEnd);
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 0 || endLine <= startLine || endLine > lines.length) return;
    const start = lines.slice(0, startLine).reduce((n,line)=>n+line.length+1,0);
    const end = Math.min(editor.value.length, start+lines.slice(startLine,endLine).join('\n').length);
    const caret = clickedOffset(block, event, start, end);
    const caretLine = editor.value.slice(0, caret).split('\n').length - 1;
    leader = editor;
    if (main.dataset.view === 'preview') document.querySelector('.view-tabs [data-view="split"]').click();
    // Collapse the selection so typing cannot replace the source block.
    editor.focus({preventScroll:true});
    editor.setSelectionRange(caret, caret);
    measureSource();
    suppress = preview; clearTimeout(suppressionTimer);
    editor.scrollTop = Math.max(0,lineOffsets[caretLine]-Math.min(72,editor.clientHeight*.15));
    editor.dispatchEvent(new Event('click')); // Refresh the line/column indicator.
    if (!matchMedia('(min-width: 721px)').matches) editor.scrollIntoView({block:'center'});
    suppressionTimer=setTimeout(()=>{suppress=null},120);
    refresh();
  }
  pages.addEventListener('click',event=>{
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (event.target.closest('a,button,input,select,textarea,summary')) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return; // Keep drag-to-copy working.
    const block=event.target.closest('[data-source-line]');
    if (block && pages.contains(block)) editBlock(block, event);
  });
  pages.addEventListener('keydown',event=>{
    if (event.key !== 'Enter' || event.target.closest('a,button,input,select,textarea,summary')) return;
    const block=event.target.closest('[data-source-line]');
    if (block && pages.contains(block)) {event.preventDefault();editBlock(block)}
  });
  function refresh() {
    invalidate(); cancelAnimationFrame(scheduled);
    scheduled=requestAnimationFrame(()=>{decoratePreview();sync(leader)});
  }
  for (const pane of [editor,preview]) {
    pane.addEventListener('scroll',onScroll,{passive:true});
    for(const event of ['wheel','pointerdown','touchstart']) pane.addEventListener(event,()=>{suppress=null;leader=pane},{passive:true});
  }
  linked.addEventListener('change',()=>{save();leader=editor;refresh()});
  new ResizeObserver(()=>{fit();refresh()}).observe(editor);
  new ResizeObserver(refresh).observe(pages);
  window.addEventListener('resize',refresh);
  let drag=null;
  divider.addEventListener('pointerdown',event=>{
    if(event.button!==0 || !splitVisible())return;
    drag=event.pointerId;divider.setPointerCapture(drag);divider.classList.add('dragging');event.preventDefault();
  });
  divider.addEventListener('pointermove',event=>{
    if(drag!==event.pointerId)return;
    const rect=main.getBoundingClientRect();setSplit((event.clientX-rect.left)/rect.width*100);fit();refresh();
  });
  function endDrag(){if(drag===null)return;drag=null;divider.classList.remove('dragging');save();refresh()}
  divider.addEventListener('pointerup',endDrag);divider.addEventListener('pointercancel',endDrag);divider.addEventListener('lostpointercapture',endDrag);
  divider.addEventListener('dblclick',()=>{setSplit(38);save();fit();refresh()});
  divider.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();setSplit(event.key==='Home'?25:event.key==='End'?70:split+(event.key==='ArrowLeft'?-2:2));save();fit();refresh();
  });
  return {invalidate,refresh};
}

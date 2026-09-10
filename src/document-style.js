export const fontFamilies = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "Calibri, 'Segoe UI', sans-serif",
  'source-serif': "'Source Serif 4', Georgia, serif",
  'source-sans': "'Source Sans 3', Calibri, sans-serif",
  lora: "'Lora', Georgia, serif",
  mono: "'IBM Plex Mono', Consolas, monospace"
};
const accents = {
  forest: ['#24654f','#edf2e8','#c8d8cc'],
  navy: ['#264d78','#edf2f8','#c4d3e3'],
  slate: ['#475569','#f1f3f5','#cbd2da'],
  plum: ['#704668','#f5eef4','#dbcbd7'],
  terracotta: ['#93472f','#faf0eb','#e5cabe']
};
export async function loadDocumentFonts(options) {
  const keys=new Set([options.typeface,options.headingFont==='inherit'?options.typeface:options.headingFont]);
  const requests=[];
  for(const key of keys) {
    if(!['source-serif','source-sans','lora','mono'].includes(key))continue;
    const family=fontFamilies[key].split(',')[0];
    for(const variant of ['400','700','italic 400'])requests.push(document.fonts.load(`${variant} 16px ${family}`));
  }
  await Promise.all(requests);
}
export function documentStyle(options) {
  const body=fontFamilies[options.typeface]||fontFamilies.serif;
  const heading=options.headingFont==='inherit'?body:fontFamilies[options.headingFont]||body;
  const [accent,tint,line]=accents[options.tableAccent]||accents.forest;
  const tableStyles={
    minimal:'.document th,.document td{border:0;border-bottom:1px solid '+line+'}',
    grid:'.document th,.document td{border:1px solid '+line+'}',
    striped:'.document th,.document td{border:0;border-bottom:1px solid '+line+'}.document .folio-row-odd td{background:'+tint+'}',
    compact:'.document th,.document td{padding:1.2mm 2mm;border:0;border-bottom:1px solid '+line+'}.document table{font-size:.8em}'
  };
  return `.document{font-family:${body};font-size:${options.fontsize}pt}
  .document h1,.document h2,.document h3,.document h4,.document h5,.document h6{font-family:${heading};color:${accent}}
  .document a{color:${accent}}
  .document h2{border-bottom-color:${line}}
  .document hr{border-top-color:${line}}
  .document blockquote{border-left-color:${accent};background:${tint};color:${accent}}
  .document .task-list-item input{accent-color:${accent}}
  .document th{font-family:${body};font-weight:700;background:${tint};color:${accent}}
  ${tableStyles[options.tableStyle]||tableStyles.minimal}
  .document thead{break-inside:avoid;break-after:avoid}`;
}
export function repeatTableHeaders(previewer) {
  // Insert continuation headers before layout measures the next page's rows.
  previewer.chunker.hooks.renderNode.register((clone,source)=>{
    if(source.nodeType!==1 || !source.closest('tbody'))return;
    const table=clone.nodeType===1?clone.closest('table'):null;
    if(!table?.hasAttribute('data-split-from') || table.querySelector('thead'))return;
    const original=source.closest('table')?.querySelector('thead');
    if(!original)return;
    const header=original.cloneNode(true);
    for(const el of [header,...header.querySelectorAll('*')]){el.removeAttribute('id');el.removeAttribute('data-ref')}
    table.insertBefore(header,table.firstChild);
  });
}

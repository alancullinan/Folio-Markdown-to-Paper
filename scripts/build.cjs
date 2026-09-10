const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild-wasm');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, {recursive: true});
for (const name of ['index.html', 'app.css']) fs.copyFileSync(path.join(root, 'src', name), path.join(out, name));
esbuild.buildSync({entryPoints:[path.join(root,'src/main.js')],bundle:true,minify:true,format:'iife',outfile:path.join(out,'app.js'),loader:{'.css':'text'},legalComments:'eof'});
fs.copyFileSync(require.resolve('katex/dist/katex.min.css'),path.join(out,'vendor.css'));
fs.appendFileSync(path.join(out,'vendor.css'),'\n'+fs.readFileSync(require.resolve('highlight.js/styles/github.css'),'utf8'));
fs.cpSync(path.join(root,'node_modules/katex/dist/fonts'),path.join(out,'fonts'),{recursive:true});
let notices='Folio bundles open-source dependencies. Package licenses follow.\n';
function licenses(folder) {
  for (const dir of fs.readdirSync(folder,{withFileTypes:true})) {
    if(!dir.isDirectory()||dir.name.startsWith('.'))continue;
    const location=path.join(folder,dir.name);
    if(dir.name.startsWith('@')){licenses(location);continue}
    for(const file of fs.readdirSync(location)) {
      if(/^licen[cs]e(?:\.|$)/i.test(file)&&fs.statSync(path.join(location,file)).isFile()) notices+='\n\n--- '+dir.name+' / '+file+' ---\n'+fs.readFileSync(path.join(location,file),'utf8');
    }
  }
}
licenses(path.join(root,'node_modules'));
fs.writeFileSync(path.join(out,'THIRD-PARTY-NOTICES.txt'),notices);
let html=fs.readFileSync(path.join(out,'index.html'),'utf8');
const vendor=fs.readFileSync(path.join(out,'vendor.css'),'utf8').replace(/url\((fonts\/[^)]+)\)/g,(_,f)=>'url(data:font/'+(f.endsWith('woff2')?'woff2':f.endsWith('woff')?'woff':'ttf')+';base64,'+fs.readFileSync(path.join(out,f)).toString('base64')+')');
html=html.replace('<link rel="stylesheet" href="vendor.css">',()=>'<style>'+vendor+'</style>').replace('<link rel="stylesheet" href="app.css">',()=>'<style>'+fs.readFileSync(path.join(out,'app.css'),'utf8')+'</style>').replace('<script src="app.js"></script>',()=>'<script>'+fs.readFileSync(path.join(out,'app.js'),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
fs.mkdirSync(path.join(root,'release'),{recursive:true});
fs.writeFileSync(path.join(root,'release/Folio.html'),html);
console.log('Built dist/ for hosting and release/Folio.html for offline use.');

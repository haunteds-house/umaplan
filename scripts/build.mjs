import {mkdir,rm,copyFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const name of ['index.html','styles.css','app.js','reference.js','core.js','storage.js','search-worker.js','veteran-search.js','search-ui.js','deck.js','training.js','training-options.js'])await copyFile(new URL(name,root),new URL(name,dist));
await cp(new URL('data/',root),new URL('data/',dist),{recursive:true});
console.log('Built dist/ — static GitHub Pages app.');

await cp(new URL('vendor/',root),new URL('vendor/',dist),{recursive:true});

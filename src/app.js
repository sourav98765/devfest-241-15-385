import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/600.css';
import './style.css';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerURL from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {PDFDocument} from 'pdf-lib';
import {MAX_FILES,MAX_BYTES,WorkspaceError,validateRequirements,duplicateFiles,matchProblem,setMatch,summarize,suggestMatches,checklistCSV} from './core.js';
import {generatePackage,packageFilename} from './pdf.js';
import {translate} from './i18n.js';
import sampleRequirements from './sample-requirements.json';
import sampleManifest from './sample-manifest.json';
pdfjs.GlobalWorkerOptions.workerSrc=workerURL;
const $=id=>document.getElementById(id);
const base=import.meta.env.BASE_URL;
let lang='en',data=validateRequirements(sampleRequirements),files=[],matches=new Map(),busy=false,notice=null,rejections=[],lastResult=null,fontPromise=null,progress=null;
const t=(key,values)=>translate(lang,key,values);
const number=value=>new Intl.NumberFormat(lang==='bn'?'bn-BD':'en-GB',{maximumFractionDigits:1}).format(value);
const date=value=>new Intl.DateTimeFormat(lang==='bn'?'bn-BD':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
function el(tag,className='',text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function button(text,className,action){const b=el('button',className,text);b.type='button';b.onclick=action;b.disabled=busy;return b;}
function invalidate(){if(lastResult)URL.revokeObjectURL(lastResult.url);lastResult=null;}
function showNotice(key,values={},error=false){notice={key,values,error};renderNotice();}
function renderNotice(){const node=$('notice');node.hidden=!notice;if(notice){node.textContent=t(notice.key,notice.values);node.classList.toggle('error',notice.error);}}
function mutate(action){try{action();invalidate();render();}catch(error){showNotice(error.code??'fetchError',{},true);}}
function render(){
 document.documentElement.lang=lang;document.title=t('appName')+' · TenderDesk';document.querySelector('.brand').setAttribute('aria-label',t('appName'));
 document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
 $('language').textContent=lang==='en'?'বাংলা':'English';$('language').setAttribute('lang',lang==='en'?'bn':'en');$('language').setAttribute('aria-label',t('languageName'));
 $('tender-details').setAttribute('aria-label',t('tenderDetails'));
 const details=$('tender-details');details.replaceChildren();
 const primary=el('div','tender-main');primary.append(el('span','tender-id',data.tender.tender_id),el('h2','',data.tender.title));details.append(primary);
 for(const [label,value,className] of [['procuringEntity',data.tender.procuring_entity,''],['bidder',data.tender.bidder,''],['deadline',date(data.tender.submission_deadline),'deadline']]){const field=el('div','tender-field '+className);field.append(el('small','',t(label)),el('strong','',value));details.append(field);}
 renderFiles();renderChecklist();refreshStatus();renderNotice();renderControls();
}
function renderControls(){
 for(const id of ['sample','load-requirements','upload','auto-match','export-csv'])$(id).disabled=busy||(id==='auto-match'&&!files.length);
 $('upload-progress').textContent=progress?t('reading',{current:number(progress.current),total:number(progress.total)}):'';
 $('generate').disabled=busy||!summarize(data,files,matches).ready;
 if(!busy)$('generate').textContent=t('generate');
}
function renderFiles(){
 $('file-count').textContent=`${number(files.length)} / ${number(MAX_FILES)}`;
 $('storage-usage').textContent=t('storage',{used:number(files.reduce((n,f)=>n+f.bytes.byteLength,0)/1_000_000)});
 const list=$('file-list');list.replaceChildren();const duplicates=duplicateFiles(files);
 if(!files.length){const empty=el('div','empty-files');empty.append(el('strong','',t('emptyLibrary')),el('p','',t('emptyHelp')));list.append(empty);}
 for(const file of files){
  const card=el('article','file-card'),top=el('div','file-card-top'),description=el('div','file-description');
  description.append(el('strong','',file.name),el('small','',t('filePages',{count:number(file.pages)})));
  if(duplicates.get(file.id).length){const badge=el('span','duplicate-badge',t('duplicate'));badge.title=t('duplicateOf',{names:duplicates.get(file.id).map(f=>f.name).join(', ')});description.append(badge);}
  top.append(el('span','pdf-icon','PDF'),description);
  const actions=el('div','file-actions');const owner=[...matches].find(([,match])=>match.fileId===file.id)?.[0];
  actions.append(el('span','file-state',owner?t('assignedTo',{id:owner}):t('fileNotAssigned')));
  const view=button(t('view'),'view-file',()=>window.open(file.url,'_blank','noopener'));view.setAttribute('aria-label',t('viewFile',{name:file.name}));
  const remove=button(t('remove'),'remove-file',()=>mutate(()=>{URL.revokeObjectURL(file.url);files=files.filter(f=>f.id!==file.id);for(const [id,match] of matches)if(match.fileId===file.id)matches.delete(id);}));remove.setAttribute('aria-label',t('removeFile',{name:file.name}));actions.append(view,remove);card.append(top,actions);list.append(card);
 }
 const report=$('upload-report');report.hidden=!rejections.length;report.replaceChildren();
 if(rejections.length){const details=el('details');details.open=true;details.append(el('summary','',t('uploadRejected',{count:number(rejections.length)})));const ul=el('ul');rejections.forEach(item=>ul.append(el('li','',t('fileRejected',{name:item.name,reason:t(item.code)}))));details.append(ul);report.append(details);}
}
function renderChecklist(){
 const list=$('checklist');list.replaceChildren();
 for(const requirement of data.requirements){
  const id=requirement.id,title=requirement['title_'+lang],match=matches.get(id),row=el('li','document-row');row.dataset.requirement=id;
  const name=el('div','document-name'),meta=el('small');meta.append(el('span','',id),el('span','requirement-tag'+(requirement.mandatory?'':' optional'),t(requirement.mandatory?'required':'optional')));name.append(el('strong','',title),meta);
  const matchCell=el('div','match-cell'),select=el('select');select.setAttribute('aria-label',t('matchDocument',{document:title}));select.disabled=busy;
  const none=el('option','',t('noFile'));none.value='';select.append(none);
  for(const file of files){const option=el('option','',`${file.name} (${number(file.pages)} ${lang==='bn'?'পৃষ্ঠা':'pp.'})`);option.value=file.id;const reason=matchProblem(files,matches,id,file.id);option.disabled=!!reason;if(reason)option.title=t(reason);select.append(option);}
  select.value=match?.fileId??'';select.onchange=()=>mutate(()=>setMatch(files,matches,id,select.value));matchCell.append(select);
  if(match)matchCell.append(button(t('clearMatch'),'undo-match',()=>mutate(()=>setMatch(files,matches,id,''))));
  const expiryCell=el('div','expiry-cell');
  if(requirement.has_expiry&&match){const input=el('input');input.type='date';input.value=match.expiry;input.disabled=busy;input.setAttribute('aria-label',t('expiryFor',{document:title}));input.oninput=()=>{match.expiry=input.value;invalidate();refreshStatus();};expiryCell.append(input);const hint=el('small','',t('validAfter',{date:date(data.tender.submission_deadline)}));expiryCell.append(hint);}
  else expiryCell.append(el('span','expiry-unneeded',t(requirement.has_expiry?'noExpiryUntilMatched':'notRequired')));
  const statusCell=el('div','status-cell');statusCell.dataset.status=id;
  row.append(el('span','document-order',number(requirement.order).padStart(2,lang==='bn'?'০':'0')),name,matchCell,expiryCell,statusCell);list.append(row);
 }
}
function refreshStatus(){
 const summary=summarize(data,files,matches);
 for(const row of summary.rows){const cell=[...$('checklist').querySelectorAll('[data-status]')].find(node=>node.dataset.status===row.requirement.id);if(!cell)continue;cell.replaceChildren(el('span','status-badge '+row.status,t(row.status)));if(row.status==='expired')cell.append(el('small','',t('expiredHelp')));}
 const duplicates=[...duplicateFiles(files).values()].filter(items=>items.length).length;
 const stats=$('status-summary');stats.replaceChildren(el('span','',t('matchedCount',{count:number(summary.included.length)})),el('span',summary.blockers.length?'attention':'',t('issuesCount',{count:number(summary.blockers.length)})),el('span','',t('optionalSkipped',{count:number(summary.rows.filter(row=>row.status==='notProvided').length)})));
 if(duplicates)stats.append(el('span','duplicate-stat',t('duplicatesCount',{count:number(duplicates)})));
 $('ready-title').textContent=t(summary.ready?'ready':'notReadyTitle');$('ready-title').closest('.readiness-card').classList.toggle('complete',summary.ready);
 $('ready-summary').textContent=t(summary.ready?'readySummary':'blockedSummary',summary.ready?{count:number(summary.included.length),pages:number(summary.pageCount)}:{ok:number(summary.ok),total:number(data.requirements.length),count:number(summary.blockers.length)});
 const acceptable=summary.rows.filter(r=>r.status==='ok'||r.status==='notProvided').length;
 $('progress-fill').style.width=`${acceptable/data.requirements.length*100}%`;
 const reasons=$('blocking-reasons');reasons.replaceChildren();
 if(summary.ready)reasons.append(el('p','all-clear',t('allClear')));
 else{reasons.append(el('p','',t('blockedHint')));const list=el('ul');for(const row of summary.blockers){const item=el('li');item.append(el('b','',row.requirement.id),el('span','',t(row.status+'Reason',{date:date(data.tender.submission_deadline)})));item.title=row.requirement['title_'+lang];list.append(item);}reasons.append(list);}
 const result=$('download-result');result.replaceChildren();result.hidden=!lastResult;
 if(lastResult){result.append(el('p','',t('generated',{name:lastResult.name})));const a=el('a','',t('downloadAgain'));a.href=lastResult.url;a.download=lastResult.name;result.append(a);}
 renderControls();
}
async function inspectPDF(file){
 if(!/\.pdf$/i.test(file.name))throw new WorkspaceError('notPDF');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const prefix=new TextDecoder('latin1').decode(bytes.subarray(0,1024));
 if(!prefix.includes('%PDF-'))throw new WorkspaceError('notPDF');
 let task;
 try{
  const lib=await PDFDocument.load(bytes,{throwOnInvalidObject:true});
  if(lib.isEncrypted)throw new WorkspaceError('protectedPDF');
  task=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,enableXfa:false,disableFontFace:true,stopAtErrors:true});
  const pdf=await task.promise,pages=pdf.numPages;
  if(!pages||pages!==lib.getPageCount())throw new WorkspaceError('invalidPDF');
  for(const page of lib.getPages()){const box=page.getCropBox();if(!Number.isFinite(box.width)||!Number.isFinite(box.height)||box.width<=0||box.height<=0)throw new WorkspaceError('invalidPDF');}
  let digest=null;
  if(globalThis.crypto?.subtle){const hash=await crypto.subtle.digest('SHA-256',bytes);digest=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  return {id:crypto.randomUUID?.()??`file-${Date.now()}-${Math.random()}`,name:file.name,bytes,pages,digest,url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}))};
 }catch(error){if(error instanceof WorkspaceError)throw error;throw new WorkspaceError(/password|encrypt/i.test(error.name+' '+error.message)?'protectedPDF':'invalidPDF');}
 finally{if(task){try{await task.destroy();}catch{}}}
}
async function addFiles(input){
 rejections=[];invalidate();
 for(let i=0;i<input.length;i++){
  const file=input[i];progress={current:i+1,total:input.length};renderControls();
  try{
   if(!/\.pdf$/i.test(file.name))throw new WorkspaceError('notPDF');
   if(files.length>=MAX_FILES)throw new WorkspaceError('tooMany');
   if(files.reduce((n,f)=>n+f.bytes.byteLength,0)+file.size>MAX_BYTES)throw new WorkspaceError('tooLarge');
   files.push(await inspectPDF(file));
  }catch(error){rejections.push({name:file.name,code:error.code??'fetchError'});}
  renderFiles();
 }
 progress=null;
}
$('upload').onclick=()=>$('pdf-input').click();
$('pdf-input').onchange=async event=>{const selected=[...event.target.files];event.target.value='';if(!selected.length||busy)return;busy=true;render();await addFiles(selected);busy=false;render();};
$('load-requirements').onclick=()=>$('requirements-input').click();
$('requirements-input').onchange=async event=>{
 const file=event.target.files[0];event.target.value='';if(!file||busy)return;busy=true;render();
 try{if(file.size>2_000_000)throw new WorkspaceError('jsonTooLarge');let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new WorkspaceError('jsonError');}const next=validateRequirements(parsed);data=next;matches=new Map();invalidate();showNotice('requirementsLoaded');}
 catch(error){showNotice(error.code??'fetchError',error.detail?{detail:error.detail}:{},true);}
 finally{busy=false;render();}
};
$('sample').onclick=async()=>{
 if(busy)return;
 if(files.length&&!window.confirm(t('sampleConfirm')))return;
 busy=true;render();
 try{
  const response=await fetch(base+'sample-pack/requirements.json');if(!response.ok)throw new Error('sample');
  const next=validateRequirements(await response.json());
  const selected=await Promise.all(sampleManifest.map(async name=>{const r=await fetch(base+'sample-pack/documents/'+encodeURIComponent(name));if(!r.ok)throw new Error('sample');return new File([await r.arrayBuffer()],name,{type:name.toLowerCase().endsWith('.pdf')?'application/pdf':'image/png'});}));
  files.forEach(f=>URL.revokeObjectURL(f.url));files=[];matches=new Map();data=next;invalidate();await addFiles(selected);showNotice('sampleLoaded');
 }catch{showNotice('sampleError',{},true);}
 finally{busy=false;render();}
};
$('auto-match').onclick=()=>mutate(()=>{const suggestions=suggestMatches(data,files,matches);suggestions.forEach(item=>setMatch(files,matches,item.requirementId,item.fileId));showNotice(suggestions.length?'suggestedMatches':'noSuggestions',{count:number(suggestions.length)});});
$('language').onclick=()=>{lang=lang==='en'?'bn':'en';render();};
function download(url,name){const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
$('export-csv').onclick=()=>{
 const summary=summarize(data,files,matches),labels=Object.fromEntries(['missing','expiryNeeded','expired','notProvided','ok'].map(key=>[key,t(key)]));labels.headers=t('csvHeaders');
 const url=URL.createObjectURL(new Blob([checklistCSV(summary,lang,labels)],{type:'text/csv;charset=utf-8'}));download(url,data.tender.tender_id.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'_Checklist.csv');setTimeout(()=>URL.revokeObjectURL(url),15000);
};
$('generate').onclick=async()=>{
 if(busy||!summarize(data,files,matches).ready)return;
 busy=true;render();$('generate').textContent=t('working');
 try{
  if(!fontPromise)fontPromise=fetch(base+'assets/DejaVuSans.ttf').then(async response=>{if(!response.ok)throw new WorkspaceError('fontError');return new Uint8Array(await response.arrayBuffer());});
  let fontBytes;try{fontBytes=await fontPromise;}catch{fontPromise=null;throw new WorkspaceError('fontError');}
  const bytes=await generatePackage({data,files,matches,fontBytes,onProgress:async(current,total)=>{$('generate').textContent=t('buildingProgress',{current:number(current),total:number(total)});await new Promise(resolve=>requestAnimationFrame(resolve));}});
  invalidate();lastResult={name:packageFilename(data.tender.tender_id),url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}))};download(lastResult.url,lastResult.name);showNotice('generated',{name:lastResult.name});
 }catch(error){showNotice(error.code??'generateError',{},true);}
 finally{busy=false;render();}
};
const zone=$('drop-zone');
zone.addEventListener('dragover',event=>{event.preventDefault();if(!busy)zone.classList.add('dragover');});
zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
zone.addEventListener('drop',async event=>{event.preventDefault();zone.classList.remove('dragover');if(busy||!event.dataTransfer.files.length)return;busy=true;render();await addFiles([...event.dataTransfer.files]);busy=false;render();});
window.addEventListener('pagehide',()=>{files.forEach(f=>URL.revokeObjectURL(f.url));if(lastResult)URL.revokeObjectURL(lastResult.url);});
render();

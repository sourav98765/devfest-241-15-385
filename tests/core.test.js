import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,degrees} from 'pdf-lib';
import {validateRequirements,isISODate,documentStatus,duplicateFiles,matchProblem,setMatch,summarize,suggestMatches,checklistCSV} from '../src/core.js';
import {generatePackage,packageFilename} from '../src/pdf.js';
import {translations} from '../src/i18n.js';
import {sampleWorkspace} from '../scripts/sample-workspace.mjs';
const fixture=await sampleWorkspace();
const fontBytes=new Uint8Array(await readFile(new URL('../public/assets/DejaVuSans.ttf',import.meta.url)));
test('all five status rules, inclusive deadline, and optional expiry blockers',()=>{
 const required=fixture.data.requirements[0],optional={...required,mandatory:false};
 assert.equal(documentStatus(required,null,fixture.files,'2026-10-20'),'missing');
 assert.equal(documentStatus(optional,null,fixture.files,'2026-10-20'),'notProvided');
 const m={fileId:'trade_license_2026.pdf',expiry:''};
 assert.equal(documentStatus(required,m,fixture.files,'2026-10-20'),'expiryNeeded');
 m.expiry='2026-10-19';assert.equal(documentStatus(required,m,fixture.files,'2026-10-20'),'expired');
 assert.equal(documentStatus(optional,m,fixture.files,'2026-10-20'),'expired');
 m.expiry='2026-10-20';assert.equal(documentStatus(required,m,fixture.files,'2026-10-20'),'ok');
 m.expiry='2026-10-21';assert.equal(documentStatus(required,m,fixture.files,'2026-10-20'),'ok');
 m.expiry='2026-02-30';assert.equal(documentStatus(required,m,fixture.files,'2026-10-20'),'expiryNeeded');
});
test('schema accepts arbitrary IDs, sorts by order, rejects ambiguous fields and dates',()=>{
 const raw=structuredClone(fixture.data);raw.requirements.reverse();raw.requirements[0].id='unseen-Ω';
 const valid=validateRequirements(raw);assert.deepEqual(valid.requirements.map(r=>r.order),[1,2,3,4,5,6,7,8,9,10]);
 assert.equal(isISODate('2024-02-29'),true);assert.equal(isISODate('2026-02-29'),false);assert.equal(isISODate('2026-1-2'),false);
 raw.requirements[1].id=raw.requirements[0].id;assert.throws(()=>validateRequirements(raw),{code:'duplicateRequirement'});
 const bad=structuredClone(fixture.data);bad.tender.submission_deadline='2026-02-30';assert.throws(()=>validateRequirements(bad),{code:'invalidDeadline'});
 bad.tender.submission_deadline='2026-10-20';bad.requirements[0].mandatory='true';assert.throws(()=>validateRequirements(bad),{code:'invalidRequirement'});
});
test('byte-identical files with different names are marked and cannot serve two documents',()=>{
 const dup=duplicateFiles(fixture.files);assert.equal(dup.get('experience_cert.pdf')[0].name,'experience_cert (1).pdf');
 const matches=new Map();setMatch(fixture.files,matches,'R05','experience_cert.pdf');
 assert.equal(matchProblem(fixture.files,matches,'R06','experience_cert (1).pdf'),'duplicateMatched');
 assert.equal(matchProblem(fixture.files,matches,'R06','experience_cert.pdf'),'alreadyMatched');
 assert.throws(()=>setMatch(fixture.files,matches,'R06','experience_cert (1).pdf'),{code:'duplicateMatched'});
 setMatch(fixture.files,matches,'R05','');setMatch(fixture.files,matches,'R06','experience_cert (1).pdf');assert.equal(matches.size,1);
 const different=fixture.files.map(f=>({...f,digest:'collision'}));assert.equal(duplicateFiles(different).get('trade_license_2026.pdf').length,0);
});
test('replacing a matched file clears its prior expiry and removal becomes Missing',()=>{
 const matches=new Map();setMatch(fixture.files,matches,'R01','trade_license_2026.pdf');matches.get('R01').expiry='2027-06-30';
 setMatch(fixture.files,matches,'R01','trade_license_2025.pdf');assert.equal(matches.get('R01').expiry,'');
 const remaining=fixture.files.filter(f=>f.id!=='trade_license_2025.pdf');assert.equal(documentStatus(fixture.data.requirements[0],matches.get('R01'),remaining,'2026-10-20'),'missing');
});
test('filename matching skips ambiguous trade licenses and matches unique proposals',()=>{
 const suggested=suggestMatches(fixture.data,fixture.files,new Map());
 assert.equal(suggested.some(s=>s.requirementId==='R01'),false);
 assert.equal(suggested.find(s=>s.requirementId==='R08').fileId,'02_technical_proposal.pdf');
 assert.equal(suggested.find(s=>s.requirementId==='R09').fileId,'01_financial_proposal.pdf');
 assert.equal(suggested.some(s=>s.requirementId==='R06'),false);
});
test('CSV quotes filenames, retains chosen language and neutralizes spreadsheet formulas',()=>{
 const summary=summarize(fixture.data,fixture.files,fixture.matches);summary.rows[0]={...summary.rows[0],file:{...summary.rows[0].file,name:'=bad,"name".pdf'}};
 const csv=checklistCSV(summary,'bn');assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('ট্রেড লাইসেন্স'));assert.ok(csv.includes("'=bad,"));assert.ok(csv.includes('""name""'));
 assert.deepEqual(Object.keys(translations.en).sort(),Object.keys(translations.bn).sort());
});
test('sample produces cover plus all 15 included pages, with source content above a separate footer band',async()=>{
 const summary=summarize(fixture.data,fixture.files,fixture.matches);assert.equal(summary.ready,true);assert.equal(summary.pageCount,16);assert.equal(summary.included.length,8);assert.equal(summary.rows.filter(r=>r.status==='notProvided').length,2);
 const bytes=await generatePackage({...fixture,fontBytes,preparedDate:'2026-10-06'});const output=await PDFDocument.load(bytes);assert.equal(output.getPageCount(),16);
 for(const page of output.getPages().slice(1)){assert.ok(Math.abs(page.getHeight()-(841.8898+44))<.1);assert.equal(page.getRotation().angle,0);}
 assert.equal(packageFilename('T-2026-0417'),'T-2026-0417_Package.pdf');
});
test('rotated source pages retain their visible orientation and space for the footer',async()=>{
 for(const angle of [90,180,270]){
  const source=await PDFDocument.load(fixture.files.find(f=>f.id==='trade_license_2026.pdf').bytes);source.getPage(0).setRotation(degrees(angle));const bytes=await source.save();
  const file={id:'rotated',name:'trade_license_2026.pdf',bytes,pages:1};
  const data={...fixture.data,requirements:[fixture.data.requirements[0]]};const matches=new Map([['R01',{fileId:file.id,expiry:'2027-06-30'}]]);
  const output=await PDFDocument.load(await generatePackage({data,files:[file],matches,fontBytes}));const page=output.getPage(1);
  assert.ok(Math.abs(page.getHeight()-((angle===180?841.8898:595.2756)+44))<.1);
  assert.ok(Math.abs(page.getWidth()-(angle===180?595.2756:841.8898))<.1);
 }
});

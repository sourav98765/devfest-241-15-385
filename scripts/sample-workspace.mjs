import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {validateRequirements,setMatch} from '../src/core.js';
import manifest from '../src/sample-manifest.json' with {type:'json'};
export async function sampleWorkspace(){
 const data=validateRequirements(JSON.parse(await readFile(new URL('../public/sample-pack/requirements.json',import.meta.url),'utf8')));
 const files=[];
 for(const name of manifest.filter(n=>n.endsWith('.pdf'))){const bytes=new Uint8Array(await readFile(new URL('../public/sample-pack/documents/'+encodeURIComponent(name),import.meta.url)));const pdf=await PDFDocument.load(bytes);files.push({id:name,name,bytes,pages:pdf.getPageCount(),digest:createHash('sha256').update(bytes).digest('hex')});}
 const matches=new Map();
 const selections={R01:'trade_license_2026.pdf',R02:'03_tin_certificate.pdf',R03:'04_vat_certificate.pdf',R04:'bank_solvency.pdf',R05:'experience_cert.pdf',R08:'02_technical_proposal.pdf',R09:'01_financial_proposal.pdf',R10:'scan_0042.pdf'};
 for(const [id,name] of Object.entries(selections))setMatch(files,matches,id,name);
 matches.get('R01').expiry='2027-06-30';matches.get('R04').expiry='2026-12-31';
 return {data,files,matches};
}

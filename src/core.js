export const MAX_FILES = 30;
export const MAX_BYTES = 50_000_000;
export class WorkspaceError extends Error {
  constructor(code, detail = '') { super(code); this.code = code; this.detail = detail; }
}
export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value && !value.startsWith('0000');
}
export function validateRequirements(raw) {
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;
  if (!raw || typeof raw !== 'object' || !raw.tender || !Array.isArray(raw.requirements) || !raw.requirements.length || raw.requirements.length > 500) throw new WorkspaceError('invalidRequirements');
  const tender = raw.tender;
  for (const key of ['tender_id', 'title', 'procuring_entity', 'bidder']) if (!text(tender[key])) throw new WorkspaceError('invalidTender', key);
  if (!isISODate(tender.submission_deadline)) throw new WorkspaceError('invalidDeadline');
  const ids = new Set(), orders = new Set();
  const requirements = raw.requirements.map(r => {
    if (!r || !text(r.id) || !text(r.title_en) || !text(r.title_bn) || !Number.isSafeInteger(r.order) || r.order < 1 || typeof r.mandatory !== 'boolean' || typeof r.has_expiry !== 'boolean') throw new WorkspaceError('invalidRequirement');
    if (ids.has(r.id) || orders.has(r.order)) throw new WorkspaceError('duplicateRequirement');
    ids.add(r.id); orders.add(r.order);
    return {id:r.id, order:r.order, title_en:r.title_en, title_bn:r.title_bn, mandatory:r.mandatory, has_expiry:r.has_expiry};
  }).sort((a,b) => a.order-b.order);
  return {tender:Object.fromEntries(['tender_id','title','procuring_entity','bidder','submission_deadline'].map(k => [k,tender[k]])), requirements};
}
export function sameContent(a, b) {
  if (!a || !b || a.bytes.byteLength !== b.bytes.byteLength) return false;
  if (a.digest && b.digest && a.digest !== b.digest) return false;
  return a.bytes.every((byte,i) => byte === b.bytes[i]);
}
export function duplicateFiles(files) {
  const result = new Map(files.map(f => [f.id, []]));
  for (let i=0;i<files.length;i++) for (let j=i+1;j<files.length;j++) if (sameContent(files[i],files[j])) {
    result.get(files[i].id).push(files[j]); result.get(files[j].id).push(files[i]);
  }
  return result;
}
export function matchProblem(files, matches, requirementId, fileId) {
  if (!fileId) return null;
  const file = files.find(f => f.id===fileId);
  if (!file) return 'unknownFile';
  for (const [id,match] of matches) {
    if (id===requirementId) continue;
    if (match.fileId===fileId) return 'alreadyMatched';
    if (sameContent(file,files.find(f => f.id===match.fileId))) return 'duplicateMatched';
  }
  return null;
}
export function setMatch(files, matches, requirementId, fileId) {
  const problem = matchProblem(files,matches,requirementId,fileId);
  if (problem) throw new WorkspaceError(problem);
  if (!fileId) {matches.delete(requirementId);return;}
  if (matches.get(requirementId)?.fileId!==fileId) matches.set(requirementId,{fileId,expiry:''});
}
export function documentStatus(requirement, match, files, deadline) {
  if (!match || !files.some(f => f.id===match.fileId)) return requirement.mandatory ? 'missing' : 'notProvided';
  if (requirement.has_expiry && !isISODate(match.expiry)) return 'expiryNeeded';
  if (requirement.has_expiry && match.expiry < deadline) return 'expired';
  return 'ok';
}
export const blocking = status => ['missing','expiryNeeded','expired'].includes(status);
export function summarize(data, files, matches) {
  const rows = data.requirements.map(requirement => {
    const match=matches.get(requirement.id);
    return {requirement,match,file:files.find(f=>f.id===match?.fileId),status:documentStatus(requirement,match,files,data.tender.submission_deadline)};
  });
  const included=rows.filter(r=>r.file);
  return {rows,included,blockers:rows.filter(r=>blocking(r.status)),ready:rows.every(r=>!blocking(r.status)),pageCount:1+included.reduce((n,r)=>n+r.file.pages,0),ok:rows.filter(r=>r.status==='ok').length};
}
const tokens = value => value.toLowerCase().replace(/['’]s\b/g,'').replace(/\.pdf$/,'').match(/[\p{L}\p{N}]+/gu)?.map(w=>({cert:'certificate',licence:'license',auth:'authorization'}[w]??w)).filter(w=>!/^\d+$/.test(w)&&!['certificate','registration','the','of','and','document','copy','pdf'].includes(w))??[];
export function suggestMatches(data, files, matches) {
  const next=new Map(matches), suggestions=[];
  for (const r of data.requirements) {
    if (next.has(r.id)) continue;
    const words=tokens(r.title_en);
    if (!words.length) continue;
    const available=files.filter(f=>!matchProblem(files,next,r.id,f.id));
    const unique=available.filter((f,i)=>!available.slice(0,i).some(g=>sameContent(f,g)));
    const ranked=unique.map(f=>({file:f,score:words.filter(w=>tokens(f.name).includes(w)).length/words.length})).filter(x=>x.score>=.75).sort((a,b)=>b.score-a.score);
    if (!ranked.length || (ranked[1] && ranked[0].score===ranked[1].score)) continue;
    const file=ranked[0].file;next.set(r.id,{fileId:file.id,expiry:''});suggestions.push({requirementId:r.id,fileId:file.id});
  }
  return suggestions;
}
export function checklistCSV(summary, language='en', labels={}) {
  const safe = value => {
    let s=String(value??'');
    if (/^[=+\-@\t\r]/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  const rows=[labels.headers??['Order','Document','Filename','Pages','Expiry date','Status'],...summary.rows.map(r=>[r.requirement.order,r.requirement['title_'+language],r.file?.name??'',r.file?.pages??'',r.match?.expiry??'',labels[r.status]??r.status])];
  return '\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n');
}

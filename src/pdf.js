import {PDFDocument, rgb, degrees, PDFName, PDFNumber} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {summarize, matchProblem, WorkspaceError} from './core.js';
export function localDate(date=new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function packageFilename(tenderId) {
  return tenderId.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'_Package.pdf';
}
function wrap(value,font,size,width) {
  const lines=[];
  for (const paragraph of String(value).split(/\r?\n/)) {
    let line='';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate=line?line+' '+word:word;
      if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
      if(line){lines.push(line);line='';}
      let part='';
      for (const char of word) {
        if(part&&font.widthOfTextAtSize(part+char,size)>width){lines.push(part);part=char;}else part+=char;
      }
      line=part;
    }
    lines.push(line);
  }
  return lines;
}
export async function generatePackage({data,files,matches,fontBytes,preparedDate=localDate(),onProgress}) {
  const summary=summarize(data,files,matches);
  if(!summary.ready)throw new WorkspaceError('notReady');
  for(const row of summary.included){const problem=matchProblem(files,matches,row.requirement.id,row.file.id);if(problem)throw new WorkspaceError(problem);}
  const output=await PDFDocument.create();output.registerFontkit(fontkit);
  const font=await output.embedFont(fontBytes,{subset:true});
  const navy=rgb(.10,.15,.25),muted=rgb(.35,.4,.49),accent=rgb(.39,.36,.9),lineColor=rgb(.84,.86,.9);
  const totalPages=summary.pageCount;
  const footerWidth=font.widthOfTextAtSize(`${data.tender.tender_id} | Page ${totalPages} of ${totalPages}`,10)+48;
  const coverWidth=Math.max(595.28,footerWidth);
  const fields=[['Tender ID',data.tender.tender_id],['Tender title',data.tender.title],['Procuring entity',data.tender.procuring_entity],['Bidder',data.tender.bidder],['Submission deadline',data.tender.submission_deadline],['Package prepared on',preparedDate]].map(([label,value])=>({label,lines:wrap(value,font,11,coverWidth-230)}));
  const included=summary.included.map(row=>({row,lines:wrap(row.requirement.title_en,font,11,coverWidth-112)}));
  const fieldHeight=fields.reduce((n,f)=>n+Math.max(29,f.lines.length*17+12),0);
  const listHeight=included.reduce((n,f)=>n+f.lines.length*17+10,0);
  const coverHeight=Math.max(841.89,160+fieldHeight+64+listHeight+70);
  if(coverHeight>14400||coverWidth>14400)throw new WorkspaceError('coverTooLong');
  const cover=output.addPage([coverWidth,coverHeight]);
  cover.drawRectangle({x:0,y:coverHeight-112,width:coverWidth,height:112,color:navy});
  cover.drawText('TENDER DOCUMENT PACKAGE',{x:42,y:coverHeight-59,size:21,font,color:rgb(1,1,1)});
  cover.drawText('Submission documents',{x:43,y:coverHeight-85,size:11,font,color:rgb(.76,.79,.86)});
  let y=coverHeight-151;
  for(const field of fields){cover.drawText(field.label,{x:42,y,size:10,font,color:muted});field.lines.forEach((value,i)=>{if(value)cover.drawText(value,{x:191,y:y-i*17,size:11,font,color:navy});});y-=Math.max(29,field.lines.length*17+12);}
  y-=12;cover.drawLine({start:{x:42,y},end:{x:coverWidth-42,y},thickness:1,color:lineColor});y-=32;
  cover.drawText('Included documents, in submission order',{x:42,y,size:13,font,color:navy});y-=30;
  for(const item of included){cover.drawText(String(item.row.requirement.order).padStart(2,'0'),{x:43,y,size:11,font,color:accent});item.lines.forEach((text,i)=>{if(text)cover.drawText(text,{x:80,y:y-i*17,size:11,font,color:navy});});y-=item.lines.length*17+10;}
  for(let i=0;i<summary.included.length;i++){
    const row=summary.included[i];
    await onProgress?.(i+1,summary.included.length);
    const source=await PDFDocument.load(row.file.bytes,{throwOnInvalidObject:true});
    if(source.getPageCount()!==row.file.pages)throw new WorkspaceError('invalidPDF');
    const form=source.getForm();if(form.getFields().length)form.flatten({updateFieldAppearances:false});
    const pages=source.getPages(),boxes=pages.map(p=>{const c=p.getCropBox();return {left:c.x,bottom:c.y,right:c.x+c.width,top:c.y+c.height};});
    const embeds=await output.embedPages(pages,boxes);
    for(let j=0;j<pages.length;j++){
      const original=pages[j],crop=original.getCropBox();
      const unit=original.node.lookupMaybe(PDFName.of('UserUnit'),PDFNumber)?.asNumber()??1;
      const w=crop.width*unit,h=crop.height*unit,rotation=((original.getRotation().angle%360)+360)%360;
      if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||![0,90,180,270].includes(rotation))throw new WorkspaceError('invalidPDF');
      const displayWidth=rotation%180?h:w,displayHeight=rotation%180?w:h;
      const width=Math.max(displayWidth,footerWidth,320),band=44,offset=(width-displayWidth)/2;
      const page=output.addPage([width,displayHeight+band]);
      const placement=rotation===90?{x:offset,y:w+band,rotate:degrees(-90)}:rotation===180?{x:offset+w,y:h+band,rotate:degrees(180)}:rotation===270?{x:offset+h,y:band,rotate:degrees(90)}:{x:offset,y:band};
      page.drawPage(embeds[j],{...placement,width:w,height:h});
    }
  }
  for(const [i,page] of output.getPages().entries()){
    const width=page.getWidth();
    page.drawLine({start:{x:20,y:37},end:{x:width-20,y:37},thickness:.6,color:lineColor});
    const text=`${data.tender.tender_id} | Page ${i+1} of ${totalPages}`;
    page.drawText(text,{x:(width-font.widthOfTextAtSize(text,10))/2,y:18,size:10,font,color:muted});
  }
  output.setTitle(`${data.tender.tender_id} - Tender Document Package`);
  output.setAuthor(data.tender.bidder);output.setProducer('Tender Document Package Builder / pdf-lib');
  return output.save();
}

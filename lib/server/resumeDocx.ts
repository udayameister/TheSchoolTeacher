/*
 * The resume as a Word (.docx) file: one column, real text and the standard Word styles (Title, Heading 1,
 * List Bullet), so Applicant Tracking Systems and school offices can read and edit it. No photo, tables or
 * text boxes on purpose. Fonts: Calibri for English, Nirmala UI / Mangal for Hindi (both ship with Windows).
 */
import type { ResumeData, ResumeTemplate } from '@/lib/resume/model';
import { visibleSections } from '@/lib/resume/model';
import { zip } from './zip';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const run = (t: string, o: { b?: boolean; i?: boolean; size?: number; color?: string } = {}) =>
  `<w:r>${o.b || o.i || o.size || o.color ? `<w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const para = (runs: string, style?: string, extra = '') => `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${runs}</w:p>`;
const TAB_RIGHT = '<w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs>';

export function resumeDocx(d: ResumeData, template: ResumeTemplate, hidden: string[], hindi: boolean): Buffer {
  const accent = template === 'modern' ? '0F5F5A' : '000000';
  const base = template === 'compact' ? 19 : 21;
  const body: string[] = [];
  body.push(para(run(d.name || 'Your name'), 'Title'));
  if (d.headline) body.push(para(run(d.headline, { size: base + 3, color: template === 'modern' ? accent : undefined })));
  if (d.contact.length) body.push(para(run(d.contact.join('  |  '))));
  for (const s of visibleSections(d, hidden)) {
    body.push(para(run(hindi ? s.heading : s.heading.toUpperCase(), { color: accent }), 'Heading1'));
    if (s.paragraph) for (const line of s.paragraph.split('\n')) body.push(para(run(line)));
    if (s.items?.length) {
      if (s.inline) body.push(para(run(s.items.join(', '))));
      else for (const i of s.items) body.push(para(run(i), 'ListBullet'));
    }
    for (const f of s.facts || []) body.push(para(run(`${f.label}: `, { b: true }) + run(f.value)));
    for (const e of s.entries || []) {
      body.push(para(run(e.title, { b: true }) + (e.dates ? `<w:r><w:tab/></w:r>${run(e.dates)}` : ''), undefined, `${TAB_RIGHT}<w:keepNext/>`));
      if (e.sub) body.push(para(run(e.sub, { i: true })));
      for (const b of e.bullets) body.push(para(run(b), 'ListBullet'));
    }
  }
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const margin = template === 'compact' ? 850 : 1134;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const font = hindi ? 'w:ascii="Nirmala UI" w:hAnsi="Nirmala UI" w:cs="Nirmala UI"' : 'w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Mangal"';
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts ${font}/><w:sz w:val="${base}"/><w:szCs w:val="${base}"/><w:lang w:val="${hindi ? 'hi-IN' : 'en-IN'}" w:bidi="hi-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="50" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:sz w:val="${base + 15}"/><w:szCs w:val="${base + 15}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${template === 'compact' ? 140 : 200}" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="${template === 'modern' ? accent : '999999'}"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="${base + 1}"/><w:szCs w:val="${base + 1}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:style>
</w:styles>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(`${d.name || 'Resume'} - Resume`)}</dc:title><dc:creator>${esc(d.name || '')}</dc:creator></cp:coreProperties>` },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/numbering.xml', data: numbering },
  ];
  return zip(files.map(f => ({ name: f.name, data: Buffer.from(f.data, 'utf8') })));
}

export function resumeFileName(name: string): string {
  return `${(name || 'Resume').replace(/[^\p{L}\p{N} -]/gu, '').trim().replace(/\s+/g, '_') || 'Resume'}_Resume.docx`;
}

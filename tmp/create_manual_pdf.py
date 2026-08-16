from pathlib import Path
import re
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Image, Paragraph, Spacer, Table, TableStyle, Frame, PageTemplate

root=Path(__file__).resolve().parents[1]; md=root/'docs/path-seeker-admin-user-manual.md'; out=root/'output/pdf/path-seeker-admin-user-manual.pdf'; out.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('NotoSC',r'C:\Windows\Fonts\NotoSansSC-VF.ttf'))
s=getSampleStyleSheet(); add=lambda n,**kw:s.add(ParagraphStyle(n,fontName='NotoSC',**kw))
add('T',fontSize=21,leading=29,alignment=TA_CENTER,textColor=colors.HexColor('#1f2937'),spaceAfter=12); add('H1',fontSize=16,leading=23,textColor=colors.HexColor('#1f2937'),spaceBefore=13,spaceAfter=7,keepWithNext=True); add('H2',fontSize=13,leading=20,textColor=colors.HexColor('#374151'),spaceBefore=10,spaceAfter=5,keepWithNext=True); add('H3',fontSize=11,leading=17,textColor=colors.HexColor('#4b5563'),spaceBefore=8,spaceAfter=4,keepWithNext=True); add('B',fontSize=9.2,leading=15,textColor=colors.HexColor('#111827'),spaceAfter=5); add('Q',fontSize=9,leading=15,leftIndent=9,borderPadding=5,backColor=colors.HexColor('#f3f4f6'),borderColor=colors.HexColor('#d1d5db'),borderWidth=.5,borderLeft=True,spaceAfter=7); add('S',fontSize=7.5,leading=11,textColor=colors.HexColor('#4b5563'))
def fmt(x):
 x=x.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;'); x=re.sub(r'!\[[^]]*\]\([^)]*\)','',x); x=re.sub(r'\[([^]]+)\]\(([^)]+)\)',r'\1',x); x=re.sub(r'`([^`]+)`',r'<font color="#7c3aed">\1</font>',x); x=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',x); return x
def pic(rel):
 p=(md.parent/rel).resolve()
 if not p.exists(): return None
 im=Image(str(p)); sc=min(170*mm/im.imageWidth,105*mm/im.imageHeight,1); im.drawWidth=im.imageWidth*sc; im.drawHeight=im.imageHeight*sc; im.hAlign='CENTER'; return im
story=[]; lines=md.read_text(encoding='utf8').splitlines(); i=0
while i<len(lines):
 l=lines[i]
 if not l.strip(): i+=1; continue
 m=re.match(r'!\[([^]]*)\]\(([^)]+)\)',l)
 if m:
  im=pic(m.group(2));
  if im: story += [Spacer(1,3),im,Paragraph(fmt(m.group(1)),s['S']),Spacer(1,5)]
  i+=1; continue
 if l.startswith('|'):
  rows=[]
  while i<len(lines) and lines[i].startswith('|'):
   z=lines[i].strip('|'); i+=1
   if re.match(r'^\s*:?-+:?\s*(\|\s*:?-+:?\s*)+$',z): continue
   rows.append([Paragraph(fmt(c.strip()),s['S']) for c in z.split('|')])
  if rows:
   t=Table(rows,repeatRows=1,colWidths=[170/len(rows[0])*mm]*len(rows[0])); t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e5e7eb')),('GRID',(0,0),(-1,-1),.3,colors.grey),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),4)])); story += [t,Spacer(1,7)]
  continue
 if l.startswith('# '): st='T'; text=l[2:]
 elif l.startswith('## '): st='H1'; text=l[3:]
 elif l.startswith('### '): st='H2'; text=l[4:]
 elif l.startswith('#### '): st='H3'; text=l[5:]
 elif l.startswith('> '): st='Q'; text=l[2:]
 elif re.match(r'^(\d+\. |- )',l): st='B'; text=('• ' if l.startswith('- ') else l.split(' ',1)[0]+' ')+l.split(' ',1)[1]
 else: st='B'; text=l
 story.append(Paragraph(fmt(text),s[st])); i+=1
def foot(c,d): c.saveState(); c.setFont('NotoSC',8); c.setFillColor(colors.grey); c.drawString(18*mm,10*mm,'Path Seeker 管理后台用户操作手册'); c.drawRightString(192*mm,10*mm,str(d.page)); c.restoreState()
f=Frame(18*mm,16*mm,174*mm,265*mm,id='f',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0); d=BaseDocTemplate(str(out),pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,topMargin=16*mm,bottomMargin=16*mm,title='Path Seeker 管理后台用户操作手册'); d.addPageTemplates([PageTemplate(id='p',frames=f,onPage=foot)]); d.build(story); print(out)

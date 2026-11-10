#!/usr/bin/env python3
import io, json, os, requests, textwrap, math
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageEnhance
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent/'public'/'pulso-informativo'
OUT.mkdir(parents=True,exist_ok=True)
D=json.loads((ROOT/'news.json').read_text(encoding='utf-8'))
font_bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font_regular='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(sz,bold=True): return ImageFont.truetype(font_bold if bold else font_regular,sz)
def photo(urls):
 for url in urls:
  try:
   r=requests.get(url,timeout=25,headers={'User-Agent':'PulsoInformativo/1.0 (news editorial)'})
   r.raise_for_status()
   return Image.open(io.BytesIO(r.content)).convert('RGB')
  except Exception as e: print('photo unavailable',str(e)[:140])
 return None
def wrap(draw,text,f,maxwidth):
 words=text.split(); lines=[]; cur=''
 for word in words:
  test=(cur+' '+word).strip()
  if draw.textbbox((0,0),test,font=f)[2]>maxwidth and cur:
   lines.append(cur);cur=word
  else:cur=test
 if cur:lines.append(cur)
 return lines
def render(article,typ):
 W=1080;H=1350 if typ=='feed' else 1920
 canvas=Image.new('RGB',(W,H),'#152a33')
 if article.get('photo_urls'):
  p=photo(article['photo_urls'])
  if p:
   p=ImageOps.fit(p,(W,H),centering=(.5,.4),method=Image.Resampling.LANCZOS)
   p=ImageEnhance.Color(p).enhance(.76)
   canvas.paste(p,(0,0))
 else:p=None
 if p is None:
  dr=ImageDraw.Draw(canvas)
  for y in range(H):
   t=y/H;dr.line([(0,y),(W,y)],fill=(int(19+19*t),int(43+24*t),int(58+24*t)))
  for k in range(17):
   y=int(H*.39+k*45);dr.arc((-600,y,1700,y+280),180,345,fill=(46,85,106),width=6)
 pix=canvas.load()
 for y in range(H):
  t=y/H
  a=.06+ .77*max(0,(t-.34)/.66)**1.7
  if t<.24:a=max(a,.18)
  for x in range(W):
   r,g,b=pix[x,y];pix[x,y]=(int(r*(1-a)),int(g*(1-a)),int(b*(1-a)))
 d=ImageDraw.Draw(canvas)
 d.text((70,70),'PULSO',font=font(58),fill='white',stroke_width=0)
 d.line([(70,144),(121,144),(134,125),(155,165),(171,134),(185,144),(300,144)],fill='#E63137',width=7,joint='curve')
 d.text((71,171),'I N F O R M A T I V O',font=font(23),fill='white')
 from datetime import datetime
 d.text((W-72,88),datetime.strptime(article['date'],'%Y-%m-%d').strftime('%d %b %Y').upper(),font=font(21,False),fill='#E1E1E1',anchor='ra')
 # Texto dentro de zona segura: ninguna línea ni bajada puede cortarse.
 label=article['category'].upper()
 title=article['headline']
 subtitle=article.get('subtitle','')
 safe_bottom=H-175 if typ=='feed' else H-335
 safe_top=340 if typ=='feed' else 620
 label_height=54
 sub_font=font(28,False)
 subtitle_lines=wrap(d,subtitle,sub_font,W-160)
 subtitle_height=len(subtitle_lines)*40
 # La cabecera de texto se posiciona desde abajo según la altura real.
 for fs in range(77 if typ=='feed' else 83,49,-2):
  title_font=font(fs)
  lines=wrap(d,title,title_font,W-150)
  title_step=int(fs*1.17)
  content_height=label_height+25+len(lines)*title_step+36+subtitle_height
  top=safe_bottom-content_height
  if top>=safe_top and len(lines)<=(5 if typ=='feed' else 6):
   break
 else:
  raise ValueError('El titular es demasiado largo para la zona segura: '+article['slug'])
 y=top
 label_width=min(650,146+len(label)*24)
 d.rounded_rectangle((70,y,label_width,y+label_height),fill='#D72430',radius=7)
 d.text((91,y+12),label,font=font(26),fill='white')
 y+=label_height+25
 for line in lines:
  d.text((70,y),line,font=title_font,fill='white')
  y+=title_step
 d.line((70,y+10,250,y+10),fill='#E63137',width=6)
 y+=36
 for line in subtitle_lines:
  d.text((70,y),line,font=sub_font,fill='#F0F0F0')
  y+=40
 if y>safe_bottom:
  raise ValueError('Desbordamiento detectado en placa '+article['slug']+' '+typ)
 footer_y=H-86 if typ=='feed' else H-228
 d.text((72,footer_y),'Imagen ilustrativa · Pulso Informativo',font=font(23,False),fill='#DDDDDD')
 path=OUT/article['date']/f"{article['slug']}-{typ}.jpg"
 path.parent.mkdir(parents=True,exist_ok=True)
 canvas.save(path,'JPEG',quality=90,subsampling=0,optimize=True,progressive=True)
 print('CREATED',path, path.stat().st_size)
for a in D['articles']:
 for fmt in ('feed','story'): render(a,fmt)

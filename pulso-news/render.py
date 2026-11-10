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
 d.text((W-72,88),'10 NOV 2026',font=font(21,False),fill='#E1E1E1',anchor='ra')
 label=article['category'].upper()
 d.rounded_rectangle((70,int(H*.60),min(620,135+len(label)*27),int(H*.60)+58),fill='#D72430',radius=7)
 d.text((91,int(H*.60)+14),label,font=font(28),fill='white')
 title=article['headline']
 fs=79 if typ=='feed' else 83
 while True:
  f=font(fs)
  lines=wrap(d,title,f,W-140)
  maxlines=4 if typ=='feed' else 5
  if len(lines)<=maxlines or fs<=51: break
  fs-=3
 y=int(H*.60)+91
 for line in lines:
  d.text((70,y),line,font=f,fill='white',stroke_width=0)
  y+=fs*1.22
 d.line((70,y+17,250,y+17),fill='#E63137',width=6)
 y+=49
 subtitle=article.get('subtitle','')
 for line in wrap(d,subtitle,font(30,False),W-160):
  d.text((70,y),line,font=font(30,False),fill='#F0F0F0')
  y+=42
 d.text((72,H-85),'Imagen ilustrativa · Pulso Informativo',font=font(23,False),fill='#DDDDDD')
 path=OUT/article['date']/f"{article['slug']}-{typ}.jpg"
 path.parent.mkdir(parents=True,exist_ok=True)
 canvas.save(path,'JPEG',quality=90,subsampling=0,optimize=True,progressive=True)
 print('CREATED',path, path.stat().st_size)
for a in D['articles']:
 for fmt in ('feed','story'): render(a,fmt)

import cv2, numpy as np, json
from PIL import Image
C=json.load(open('comps.json'))
out=[]
def hexc(c): return '#%02x%02x%02x'%tuple(int(round(v)) for v in c)
for rel,info in C.items():
  f='orig/Logo/'+rel
  im=Image.open(f); a=np.array(im.convert('RGBA')).astype(int)
  r,g,b,al=[a[...,i] for i in range(4)]
  bg=info['bg']
  entry=dict(path=rel,w=info['w'],h=info['h'],bg=bg,symbol=None)
  comps=info['comps']
  if 'text' not in rel.lower():
    # drop frame (bbox containing others)
    def contains(A,B): return A[0]<=B[0] and A[1]<=B[1] and A[2]>=B[2] and A[3]>=B[3] and A!=B
    cs=[c for c in comps if not any(contains(c['bbox'],o['bbox']) for o in comps)]
    cs=sorted(cs,key=lambda c:-(c['bbox'][3]-c['bbox'][1]))[:2]
    cs=sorted(cs,key=lambda c:c['bbox'][0])  # left piece first
    if bg=='transparent': ink=al>128
    elif bg=='black': ink=(r+g+b)/3>128
    else: ink=(r+g+b)/3<200
    green=(g>150)&(g-r>60)&(g-b>60)&(al>128)
    ink=ink|green
    pieces=[]; X0=Y0=10**9; X1=Y1=-1
    for c in cs:
      x0,y0,x1,y1=c['bbox']; sub=np.zeros_like(ink); sub[y0:y1,x0:x1]=ink[y0:y1,x0:x1]
      m8=(sub*255).astype(np.uint8)
      n,lab,st,_=cv2.connectedComponentsWithStats(m8)
      k=1+int(np.argmax(st[1:,4])); pm=lab==k
      ys,xs=np.nonzero(pm)
      X0=min(X0,xs.min());Y0=min(Y0,ys.min());X1=max(X1,xs.max()+1);Y1=max(Y1,ys.max()+1)
      er=cv2.erode((pm*255).astype(np.uint8),np.ones((7,7),np.uint8))>0
      col=np.median(a[er][:,:3],axis=0)
      pieces.append(dict(color=hexc(col),green=bool(green[er].mean()>0.5)))
    entry['symbol']=dict(bbox=[int(X0),int(Y0),int(X1),int(Y1)],left=pieces[0],right=pieces[1])
  out.append(entry)
  s=entry['symbol']
  print(f"{rel:45} {bg:11}", s and (s['bbox'], s['bbox'][2]-s['bbox'][0], s['bbox'][3]-s['bbox'][1], round((s['bbox'][3]-s['bbox'][1])/(s['bbox'][2]-s['bbox'][0]),3), s['left'], s['right']))
json.dump(out,open('manifest.json','w'),indent=1)

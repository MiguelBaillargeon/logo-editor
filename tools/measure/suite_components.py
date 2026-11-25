import cv2, numpy as np, glob, os, json
from PIL import Image
res={}
for f in sorted(glob.glob('orig/Logo/**/*',recursive=True)):
  if os.path.isdir(f): continue
  rel=os.path.relpath(f,'orig/Logo')
  a=np.array(Image.open(f).convert('RGBA')).astype(int)
  H,W=a.shape[:2]; r,g,b,al=[a[...,i] for i in range(4)]
  has_alpha=Image.open(f).mode=='RGBA'
  if has_alpha: bg='transparent'; ink=al>128
  else:
    lum=(r+g+b)/3
    if lum[:5,:5].mean()<128: bg='black'; ink=lum>128
    else: bg='white'; ink=lum<200
  green=(g>150)&(g-r>60)&(g-b>60)&(al>128)
  ink=ink|green
  m8=(ink*255).astype(np.uint8)
  m8=cv2.morphologyEx(m8,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
  d=cv2.dilate(m8,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(13,13)))
  n,lab,st,_=cv2.connectedComponentsWithStats(d)
  comps=[]
  for i in range(1,n):
    x,y,w,h,ar=st[i]
    if ar<2000: continue
    gr=int((green&(lab==i)).sum())
    comps.append(dict(i=i,bbox=[int(x),int(y),int(x+w),int(y+h)],area=int(ar),green=gr))
  print(rel,(W,H),bg,'comps:',[(c['bbox'],c['green']) for c in comps])
  res[rel]=dict(w=W,h=H,bg=bg,comps=comps)
json.dump(res,open('comps.json','w'),indent=1)

import json, re, numpy as np
from PIL import Image
M=json.load(open('manifest.json'))
for e in M:
  o=Image.open('orig/Logo/'+e['path']); n=Image.open('out/Logo/'+e['path'])
  a=np.array(o.convert('RGBA')).astype(int); b=np.array(n.convert('RGBA')).astype(int)
  size_ok=o.size==n.size
  H,W=a.shape[:2]; outside=np.ones((H,W),bool)
  iou='-'
  if e['symbol']:
    x0,y0,x1,y1=e['symbol']['bbox']; m=round(0.02*max(x1-x0,y1-y0))+2+3
    outside[max(0,y0-m):y1+m, max(0,x0-m):x1+m]=False
    def ink(arr):
      r,g,bb,al=[arr[...,i] for i in range(4)]
      if e['bg']=='transparent': return al>128
      if e['bg']=='black': return (r+g+bb)/3>128
      return (r+g+bb)/3<200 | ((g-r)>60)
    def inkm(arr):
      r,g,bb,al=[arr[...,i] for i in range(4)]
      lum=(r+g+bb)/3; green=(g-r>60)&(g-bb>60)&(al>128)
      if e['bg']=='transparent': base=al>128
      elif e['bg']=='black': base=lum>128
      else: base=lum<200
      return base|green
    A=inkm(a)[y0-8:y1+8,x0-8:x1+8]; B=inkm(b)[y0-8:y1+8,x0-8:x1+8]
    iou=f'{(A&B).sum()/(A|B).sum():.3f}'
  # text preservation outside symbol area: count pixels changed by more than 12 in any channel (excluding bg snapping)
  d=np.abs(a-b).max(-1)
  if e['bg']=='transparent': changed=(d>12)&(a[...,3]>8)
  else: changed=(d>20)
  print(f"{e['path']:42} size_ok={size_ok} mode {o.mode}->{n.mode}  changed_outside={(changed&outside).sum():6d}  symbol_IoU={iou}")

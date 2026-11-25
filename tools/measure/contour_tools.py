import cv2, numpy as np, sys, json
from PIL import Image

def masks(f):
  a=np.array(Image.open(f).convert('RGBA')).astype(int)
  r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
  green=(g>150)&(g-r>60)&(g-b>60)&(al>128)
  dark=(r<110)&(g<110)&(b<110)&(al>128)
  light=(r>190)&(g>190)&(b>190)&(al>128)
  return green,dark,light

def biggest(m, k=1, open_=0):
  m8=(m*255).astype(np.uint8)
  if open_:
    ker=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(open_,open_))
    m8=cv2.morphologyEx(m8,cv2.MORPH_OPEN,ker); m8=cv2.morphologyEx(m8,cv2.MORPH_CLOSE,ker)
  n,lab,st,_=cv2.connectedComponentsWithStats(m8)
  idx=sorted(range(1,n),key=lambda i:-st[i][4])[:k]
  return [(lab==i).astype(np.uint8)*255 for i in idx],[st[i] for i in idx]

def line_fit(pts):
  pts=np.asarray(pts,float); c=pts.mean(0)
  u,s,vt=np.linalg.svd(pts-c); d=vt[0]
  return c,d

def inter(l1,l2):
  (c1,d1),(c2,d2)=l1,l2
  A=np.array([d1,-d2]).T
  if abs(np.linalg.det(A))<1e-6: return None
  t=np.linalg.solve(A,c2-c1); return c1+t[0]*d1

def analyze(mask, eps):
  cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
  c=max(cs,key=cv2.contourArea)[:,0,:].astype(float)
  # smooth slightly
  ap=cv2.approxPolyDP(c.astype(np.int32).reshape(-1,1,2),eps,True)[:,0,:]
  # map approx vertices to contour indices
  idx=[int(np.argmin(((c-p)**2).sum(1))) for p in ap]
  N=len(c); K=len(idx)
  lines=[]
  for k in range(K):
    i0,i1=idx[k],idx[(k+1)%K]
    seg=c[i0:i1+1] if i1>i0 else np.vstack([c[i0:],c[:i1+1]])
    L=len(seg); s=seg[int(L*0.25):max(int(L*0.75),int(L*0.25)+2)]
    lines.append((line_fit(s),L))
  out=[]
  for k in range(K):
    (l_prev,Lp),(l_next,Ln)=lines[k-1],lines[k]
    v=inter(l_prev,l_next)
    if v is None: v=ap[k].astype(float)
    # interior angle between edges
    d1=-l_prev[1]; d2=l_next[1]
    # orient directions away from vertex
    p_prev=c[idx[k-1]]; p_next=c[idx[(k+1)%K]]
    if np.dot(p_prev-v,d1)<0: d1=-d1
    if np.dot(p_next-v,d2)<0: d2=-d2
    th=np.arccos(np.clip(np.dot(d1,d2),-1,1))
    dmin=np.sqrt(((c-v)**2).sum(1)).min()
    s=np.sin(th/2)
    r= dmin/(1/s-1) if s<0.999 else 0
    out.append(dict(x=round(v[0],1),y=round(v[1],1),ang=round(np.degrees(th),1),d=round(dmin,1),r=round(r,1)))
  return out

if __name__=='__main__':
  f=sys.argv[1]; eps=float(sys.argv[2])
  g,d,l=masks(f)
  which=sys.argv[3:]
  for w in which:
    name,k,op=w.split(':')
    m={'green':g,'dark':d,'light':l}[name]
    ms,sts=biggest(m,int(k),int(op))
    for mm,st in zip(ms,sts):
      print('==',name,st)
      for v in analyze(mm,eps): print('  ',v)

import numpy as np, cv2, sys
from contour_tools import masks, biggest, line_fit, inter

def seg_dist(P,a,b):
  ab=b-a; t=np.clip(((P-a)@ab)/(ab@ab),0,1); return np.linalg.norm(P-(a+t[:,None]*ab),axis=1)

def model_dist(P,v,d1,d2,r,L):
  th=np.arccos(np.clip(d1@d2,-1,1)); a=th/2
  if r<=0: return np.minimum(seg_dist(P,v,v+d1*L),seg_dist(P,v,v+d2*L))
  t=r/np.tan(a); u=(d1+d2)/np.linalg.norm(d1+d2); c=v+u*r/np.sin(a)
  t1=v+d1*t; t2=v+d2*t
  ds=np.minimum(seg_dist(P,t1,v+d1*max(L,t+1)),seg_dist(P,t2,v+d2*max(L,t+1)))
  # arc: points whose direction from c lies between t1 and t2 (the short arc, facing v)
  w=P-c; n=np.linalg.norm(w,axis=1)+1e-9
  e1=(t1-c)/r; e2=(t2-c)/r
  # inside sector if cross products consistent
  cr=lambda x,y: x[...,0]*y[...,1]-x[...,1]*y[...,0]
  s1=cr(e1,w)*cr(e1,e2)>=0; s2=cr(e2,w)*cr(e2,e1)>=0
  inside=s1&s2&((w/n[:,None])@((e1+e2)/2)>0)
  da=np.where(inside,np.abs(n-r),np.inf)
  return np.minimum(ds,da)

def analyze(mask,eps):
  cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
  c=max(cs,key=cv2.contourArea)[:,0,:].astype(float)
  ap=cv2.approxPolyDP(c.astype(np.int32).reshape(-1,1,2),eps,True)[:,0,:]
  idx=[int(np.argmin(((c-p)**2).sum(1))) for p in ap]; K=len(idx)
  segs=[]
  for k in range(K):
    i0,i1=idx[k],idx[(k+1)%K]
    seg=c[i0:i1+1] if i1>i0 else np.vstack([c[i0:],c[:i1+1]])
    segs.append(seg)
  lines=[]
  for seg in segs:
    L=len(seg); s=seg[int(L*0.3):max(int(L*0.7),int(L*0.3)+2)]
    lines.append(line_fit(s))
  res=[]
  for k in range(K):
    v=inter(lines[k-1],lines[k])
    pp=segs[k-1][len(segs[k-1])//2]; pn=segs[k][len(segs[k])//2]
    d1=lines[k-1][1]; d2=lines[k][1]
    if (pp-v)@d1<0: d1=-d1
    if (pn-v)@d2<0: d2=-d2
    Lmin=min(np.linalg.norm(pp-v),np.linalg.norm(pn-v))
    # contour points near corner: half of each adjacent segment
    P=np.vstack([segs[k-1][len(segs[k-1])//2:],segs[k][:len(segs[k])//2]])
    best=None
    for r in np.arange(0,120,0.25):
      if r/np.tan(np.arccos(np.clip(d1@d2,-1,1))/2)>Lmin*1.9: break
      e=np.mean(model_dist(P,v,d1,d2,r,2000)**2)
      if best is None or e<best[1]: best=(r,e)
    th=np.degrees(np.arccos(np.clip(d1@d2,-1,1)))
    res.append((v,th,best[0],best[1]))
  return res

if __name__=='__main__':
  f=sys.argv[1]; eps=float(sys.argv[2])
  g,d,l=masks(f)
  for w in sys.argv[3:]:
    name,k,op=w.split(':')
    ms,sts=biggest({'green':g,'dark':d,'light':l}[name],int(k),int(op))
    for mm in ms:
      print('==',name)
      for v,th,r,e in analyze(mm,eps):
        print(f'   ({v[0]:7.1f},{v[1]:7.1f}) ang {th:6.1f}  r {r:5.2f}  rms {np.sqrt(e):.2f}')

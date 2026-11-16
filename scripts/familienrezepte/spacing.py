import cv2,numpy as np
from detect import *
def line_spacing(p):
    im=load(p); card,(x,y,w,h)=white_card(im)
    g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(float)
    reg=g[y+int(h*.08):y+int(h*.95), x+int(w*.55):x+int(w*.9)]
    prof=reg.mean(1); prof=prof-cv2.GaussianBlur(prof.reshape(-1,1),(1,0),25).ravel()
    prof=-prof; prof-=prof.mean()
    ac=np.correlate(prof,prof,'full')[len(prof)-1:]
    lo,hi=35,110
    k=lo+np.argmax(ac[lo:hi])
    # refine with multiples
    k2=2*k; r=np.argmax(ac[k2-5:k2+6])+k2-5
    return r/2
if __name__=='__main__':
    for p in list(range(1,34))+['toc']: print(p, round(line_spacing(p),1))

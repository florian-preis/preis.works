import cv2,numpy as np
from pages import *
def load(p):
    im=cv2.imread(U+P[p]); return im
def card_box(im):
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    m=((hsv[...,2]>165)&(hsv[...,1]<35)).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((25,25),np.uint8))
    n,l,st,_=cv2.connectedComponentsWithStats(m)
    i=1+np.argmax(st[1:,4]); x,y,w,h=st[i,:4]
    return x,y,w,h
def inkmask(im):
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    return ((hsv[...,2]<110)&(hsv[...,1]<110)).astype(np.uint8)
def comps(m):
    n,l,st,c=cv2.connectedComponentsWithStats(m,8)
    return [(st[i,0],st[i,1],st[i,2],st[i,3],st[i,4],i) for i in range(1,n) if st[i,4]>=6], l
def white_card(im):
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    m=((hsv[...,2]>150)&(hsv[...,1]<20)).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((41,41),np.uint8))
    n,l,st,_=cv2.connectedComponentsWithStats(m)
    i=1+np.argmax(st[1:,4]); 
    card=(l==i).astype(np.uint8)
    cs,_=cv2.findContours(card,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    card=np.zeros_like(card); cv2.drawContours(card,cs,-1,1,-1)
    card=cv2.erode(card,np.ones((21,21),np.uint8))
    return card, st[i,:4]

import sys,glob
from PIL import Image
fs=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).convert('RGB').resize((640,360)) for f in fs]
rows=(len(ims)+1)//2
S=Image.new('RGB',(1280,360*rows))
for i,im in enumerate(ims): S.paste(im,((i%2)*640,(i//2)*360))
S.save(out,quality=85)

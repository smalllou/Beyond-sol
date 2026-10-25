import re,glob,subprocess
txt=''
for f in glob.glob('src/**/*.js',recursive=True)+['index.html']: txt+=open(f,encoding='utf8').read()
chars=set(c for c in txt if ord(c)>127)
chars|=set('0123456789０１２３４５６７８９，。：；！？、·—…“”‘’（）《》年月日时分秒天光公里度')
chars|=set(chr(c) for c in range(32,127))
open('/tmp/chars.txt','w',encoding='utf8').write(''.join(sorted(chars)))
print(len(chars))
subprocess.run(['pyftsubset','/workspace/work/ncdeps/fonts/NotoSansSC.ttf','--text-file=/tmp/chars.txt','--flavor=woff2','--output-file=public/assets/fonts/NotoSansSC-hud.woff2','--layout-features=*'],check=True)

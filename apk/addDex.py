# -*- coding: utf-8 -*-
"""aapt2가 만든 APK에 classes.dex를 넣어 새 APK로 저장한다."""
import shutil, sys, zipfile
base, dex, out = sys.argv[1], sys.argv[2], sys.argv[3]
shutil.copyfile(base, out)
with zipfile.ZipFile(out, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
print('  classes.dex 추가 완료')

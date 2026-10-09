import os
import sys
from pathlib import Path

if getattr(sys,'frozen',False):
    binaries=Path(sys._MEIPASS)/'bin'
    os.environ['PATH']=str(binaries)+os.pathsep+os.environ.get('PATH','')

if len(sys.argv)>1 and sys.argv[1]=='--gui-smoke':
    import tkinter as tk
    root=tk.Tk();root.withdraw();root.update();root.destroy()
elif len(sys.argv)>1:
    from spm_editor.__main__ import main
    raise SystemExit(main())
else:
    from spm_editor.gui import launch
    launch()

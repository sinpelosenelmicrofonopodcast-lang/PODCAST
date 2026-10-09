"""A local execution interface; no cloud services or website."""
import json
import threading
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

def launch():
    root=tk.Tk();root.title('SPM Podcast Editor');root.geometry('820x570')
    manifest=tk.StringVar();status=tk.StringVar(value='Abre Resolve Studio con tu multicam sincronizado y selecciona el JSON.')
    output=tk.StringVar(value=str(Path.home()/'Movies'/'SPM_AUTOPILOT'))
    frame=ttk.Frame(root,padding=20);frame.pack(fill='both',expand=True)
    ttk.Label(frame,text='SPM PODCAST EDITOR',font=('Arial',22,'bold')).pack(anchor='w')
    ttk.Label(frame,text='JSON → edición completa → revisión → exportación').pack(anchor='w',pady=(4,20))
    row=ttk.Frame(frame);row.pack(fill='x')
    ttk.Entry(row,textvariable=manifest).pack(side='left',fill='x',expand=True)
    def choose():
        path=filedialog.askopenfilename(filetypes=[('Master JSON','*.json')])
        if path:manifest.set(path)
    ttk.Button(row,text='Seleccionar JSON',command=choose).pack(side='left',padx=8)
    ttk.Label(frame,text='Carpeta de resultados').pack(anchor='w',pady=(16,2))
    ttk.Entry(frame,textvariable=output).pack(fill='x')
    ttk.Label(frame,textvariable=status,wraplength=760).pack(anchor='w',pady=16)
    log=tk.Text(frame,height=15,wrap='word');log.pack(fill='both',expand=True)
    pending=[];busy=[False]
    def display():
        while pending:
            kind,value=pending.pop(0)
            if kind=='done':
                busy[0]=False;run.configure(state='normal')
                status.set('Listo para revisar en Resolve.' if value.get('ready_for_review') else 'Revisa el informe.')
            elif kind=='error':
                busy[0]=False;run.configure(state='normal');status.set('Operación detenida: '+value)
            log.insert('end',json.dumps(value,ensure_ascii=False,indent=2) if isinstance(value,dict) else str(value))
            log.insert('end','\n');log.see('end')
        root.after(200,display)
    def execute():
        if busy[0]:return
        path=Path(manifest.get())
        if not path.is_file():messagebox.showerror('SPM','Selecciona un master JSON válido.');return
        directory=output.get();busy[0]=True;run.configure(state='disabled')
        status.set('Editando. El original se conserva; el episodio mantiene sus pausas.')
        def worker():
            try:
                from .core import validate
                from .engine import Engine
                value=validate(json.loads(path.read_text()))
                pending.append(('done',Engine(value,directory).run()))
            except Exception as exc:pending.append(('error',str(exc)))
        threading.Thread(target=worker,daemon=True).start()
    run=ttk.Button(frame,text='EDITAR / REANUDAR',command=execute);run.pack(anchor='e',pady=12)
    root.after(200,display);root.mainloop()

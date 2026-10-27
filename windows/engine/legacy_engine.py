"""UI adapter for the original, unmodified OBS File Sorter processing methods."""
from pathlib import Path
from datetime import datetime
import builtins,json,logging,marshal,os,shutil,subprocess,threading,time,types

METHODS=marshal.loads((Path(__file__).parent/'original_methods.marshal').read_bytes())

def make_engine(config,settings_file,emit,stop_event=None,enqueue=None):
    stop_event=stop_event or threading.Event()
    enqueue=enqueue or (lambda fn:fn())
    logger=logging.getLogger('obs-sorter')
    class TimeProxy:
        @staticmethod
        def sleep(seconds):
            flag={'short-recordings':'auto_delete','old-folders':'auto_delete_folders'}.get(threading.current_thread().name)
            if flag and not config.get(flag):raise SystemExit
            if stop_event.wait(seconds):raise SystemExit
            if flag and not config.get(flag):raise SystemExit
        def __getattr__(self,name):return getattr(time,name)
    class Messages:
        @staticmethod
        def showerror(title,message):emit({'type':'notice','level':'error','message':message})
        @staticmethod
        def showinfo(title,message):emit({'type':'notice','level':'info','message':message})
    class Status:
        def config(self,**kwargs):
            if 'text' in kwargs:emit({'type':'status','message':kwargs['text']})
    class Root:
        def update(self):pass
        def after(self,milliseconds,callback):
            until=time.time()+milliseconds/1000
            emit({'type':'delay','until':until})
            def run():
                if not stop_event.wait(milliseconds/1000):enqueue(callback)
            threading.Thread(target=run,daemon=True).start()
    class Entry:
        def __init__(self,key):self.key=key
        def get(self):return config.get(self.key,'')
    globals_map={'__builtins__':builtins.__dict__,'os':os,'shutil':shutil,'json':json,'subprocess':subprocess,'datetime':datetime,
       'threading':threading,'time':TimeProxy(),'logger':logger,'CONFIG_FILE':str(settings_file),
       'messagebox':Messages,'print':lambda *args,**kwargs:logger.info(' '.join(map(str,args)))}
    methods={name:types.FunctionType(code,globals_map,name) for name,code in METHODS.items()}
    Engine=type('OriginalSorterEngine',(),methods)
    engine=Engine();engine.configurations=config;engine.root=Root();engine.status_label=Status()
    for key in ('source_folder','backtrack_folder','replay_folder','recording_folder','vault_destination_folder'):
        setattr(engine,key+'_entry',Entry(key))
    def save():
        settings_file.parent.mkdir(parents=True,exist_ok=True)
        temp=settings_file.with_suffix('.tmp')
        temp.write_text(json.dumps(config,indent=4),encoding='utf-8')
        os.replace(temp,settings_file)
    engine.save_configurations=save
    engine._globals=globals_map
    return engine

from pathlib import Path
import json,logging,os,queue,re,sys,threading,time
from logging.handlers import RotatingFileHandler
from legacy_engine import make_engine

sys.stdout.reconfigure(encoding='utf-8');sys.stdin.reconfigure(encoding='utf-8-sig')
TEST='--test' in sys.argv

DATA=Path(os.environ['APPDATA'])/'OBS File Sorter'
DATA.mkdir(parents=True,exist_ok=True)
CONFIG=DATA/'settings.json'
out_lock=threading.Lock();stopped=threading.Event();jobs=queue.Queue();threads={}
protocol=sys.stdout
def emit(event):
    with out_lock:
        protocol.write(json.dumps(event,ensure_ascii=False)+'\n');protocol.flush()

class Activity(logging.Handler):
    def emit(self,record):
        if record.levelno>=logging.INFO:
            emit({'type':'activity','level':record.levelname.lower(),'message':record.getMessage(),'time':time.time()})

logger=logging.getLogger('obs-sorter');logger.setLevel(logging.DEBUG)
log=RotatingFileHandler(DATA/'obs_sorter.log',maxBytes=5_000_000,backupCount=3,encoding='utf-8')
log.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(log);logger.addHandler(Activity())
config=json.loads(CONFIG.read_text(encoding='utf-8-sig'))
engine=make_engine(config,CONFIG,emit,stopped,jobs.put)

def work():
    while True:
        action=jobs.get()
        try:
            if action is None:return
            emit({'type':'busy','value':True})
            action()
        except Exception:
            logger.exception('Could not finish the requested action')
            emit({'type':'notice','level':'error','message':'The action could not finish. See the activity log for details.'})
        finally:
            emit({'type':'busy','value':False});jobs.task_done()

worker=threading.Thread(target=work,daemon=True);worker.start()
original_sort=engine.run_sorter
def sort():
    if not stopped.is_set():original_sort()
engine.run_sorter=sort

def launch_feature(name,target):
    if name in threads and threads[name].is_alive():return
    thread=threading.Thread(target=target,daemon=True,name=name);threads[name]=thread;thread.start()

def start_features():
    launch_feature('vault',engine.monitor_vault_folders)
    if config.get('auto_delete'):launch_feature('short-recordings',engine.auto_delete_files)
    if config.get('auto_delete_folders'):launch_feature('old-folders',engine.delete_old_folders)

def hotkeys():
    try:
        import keyboard
        engine._globals['keyboard']=keyboard
        engine.listen_for_hotkeys()
    except Exception:
        logger.exception('Global hotkeys are unavailable')
        emit({'type':'notice','level':'warning','message':'Hotkeys could not start. The Sort clips button is still available.'})

def snapshot():
    while not stopped.is_set():
        source=config.get('source_folder','')
        exists=Path(source).is_dir() if source else False
        try:pending=sum(p.is_file() and p.suffix.lower()=='.mp4' for p in Path(source).iterdir()) if exists else 0
        except OSError:pending=0
        emit({'type':'snapshot','pending':pending,'source_available':exists,'vault':bool(config.get('vault_destination_folder'))})
        stopped.wait(3)

if not TEST:
    start_features();launch_feature('hotkeys',hotkeys);launch_feature('snapshot',snapshot)
emit({'type':'ready','config':config})
try:
    for line in sys.stdin:
        try:command=json.loads(line)
        except ValueError:continue
        action=command.get('action')
        if action=='shutdown':break
        if action in ('save','sort'):
            settings=command.get('settings')
            if settings:
                # Keep the same configuration keys and values used by the old app.
                config.update(settings);engine.save_configurations()
                if not TEST:start_features()
                emit({'type':'saved'})
            if action=='sort':jobs.put(engine.run_sorter)
except Exception:logger.exception('Backend input failed')
finally:
    stopped.set()
    try:
        import keyboard
        keyboard.unhook_all_hotkeys()
    except Exception:pass
    # Let any current sort finish safely before the worker exits.
    jobs.put(None);worker.join()
    for name,thread in threads.items():
        if name not in ('hotkeys','snapshot'):thread.join()
    logger.info('OBS File Sorter closed')

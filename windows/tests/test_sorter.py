from pathlib import Path
import hashlib,json,marshal,os,subprocess,sys,tempfile,threading,time,types,unittest

SOURCE=Path(__file__).resolve().parents[1]
INSTALL=Path(os.environ.get('OBS_SORTER_ROOT',str(SOURCE)))
sys.path.insert(0,str(INSTALL/'engine'))
from legacy_engine import METHODS,make_engine

class SorterTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.config={key:str(self.root/name) for key,name in [('source_folder','source'),('backtrack_folder','vertical'),('replay_folder','horizontal'),('recording_folder','recordings'),('vault_destination_folder','vault')]}
        self.config.update(auto_delete=False,delete_length_minutes=7,auto_delete_folders=False,delete_length_days=14)
        for key,value in self.config.items():
            if key.endswith('folder'):Path(value).mkdir()
        self.events=[];self.engine=make_engine(self.config,self.root/'settings.json',self.events.append)
        self.engine.get_video_length=lambda path:600
        self.date='2026-10-20';self.stamp=time.mktime(time.strptime(self.date,'%Y-%m-%d'))
    def tearDown(self):self.temp.cleanup()
    def file(self,name,data=b'test MP4 placeholder'):
        path=Path(self.config['source_folder'])/name;path.write_bytes(data);os.utime(path,(self.stamp,self.stamp));return path
    def test_original_methods_unchanged(self):
        manifest=json.loads((INSTALL/'engine'/'original-methods.json').read_text())
        self.assertEqual(hashlib.sha256((INSTALL/'engine'/'original_methods.marshal').read_bytes()).hexdigest(),manifest['methods_file_sha256'])
        original=marshal.loads((Path(__file__).parent/'sorter-inspection'/'file.marshal').read_bytes())
        def walk(code):
            yield code
            for item in code.co_consts:
                if isinstance(item,types.CodeType):yield from walk(item)
        reference={c.co_name:c for c in walk(original)}
        for name,code in METHODS.items():self.assertEqual(code,reference[name],name)
    def test_routes_date_numbering_and_vault_categories(self):
        for name in ('Backtrack sample.MP4','REPLAY sample.mp4','Recording.mp4'):self.file(name)
        self.file('notes.txt');self.engine.run_sorter()
        for key in ('backtrack_folder','replay_folder','recording_folder'):
            folder=Path(self.config[key])/self.date
            self.assertTrue((folder/'001.mp4').is_file(),key)
            for category in ('Fortnite','R.E.P.O','Random'):self.assertTrue((folder/'The Vault'/category).is_dir())
        self.assertTrue((Path(self.config['source_folder'])/'notes.txt').exists())
    def test_existing_entries_keep_original_numbering(self):
        folder=Path(self.config['replay_folder'])/self.date;folder.mkdir();(folder/'001.mp4').write_bytes(b'original')
        self.file('Replay sample.mp4');self.engine.run_sorter()
        self.assertEqual((folder/'001.mp4').read_bytes(),b'original');self.assertTrue((folder/'002.mp4').exists())
    def test_vault_copy_skips_existing_and_keeps_source(self):
        folder=Path(self.config['recording_folder'])/self.date;self.engine.create_vault_folders(str(folder))
        source=folder/'The Vault'/'Random'/'favorite.mp4';source.write_bytes(b'favorite')
        self.engine.sync_vault_files(str(folder));target=Path(self.config['vault_destination_folder'])/'Random'/'favorite.mp4'
        self.assertEqual(target.read_bytes(),b'favorite');self.assertTrue(source.exists())
        source.write_bytes(b'changed');self.engine.sync_vault_files(str(folder));self.assertEqual(target.read_bytes(),b'favorite')
    def test_short_recording_threshold_keeps_clips(self):
        self.config['auto_delete']=True;self.engine.get_video_length=lambda path:420
        for name in ('Short.mp4','Backtrack short.mp4','Replay short.mp4'):self.file(name)
        self.engine.run_sorter()
        self.assertFalse(list(Path(self.config['recording_folder']).rglob('*.mp4')))
        self.assertEqual(len(list(Path(self.config['backtrack_folder']).rglob('*.mp4'))),1)
        self.assertEqual(len(list(Path(self.config['replay_folder']).rglob('*.mp4'))),1)
    def test_five_second_hotkey_delay(self):
        calls=[]
        class Root:
            def after(_,ms,callback):calls.append(ms)
        self.engine.root=Root();self.engine.delayed_sort();self.assertEqual(calls,[5000])
    def test_settings_round_trip_keeps_schema_and_values(self):
        self.engine.save_configurations();self.assertEqual(json.loads((self.root/'settings.json').read_text()),self.config)
    def one_cycle(self,callback):
        class EndCycle:
            def sleep(_,seconds):raise SystemExit
        self.engine._globals['time']=EndCycle()
        with self.assertRaises(SystemExit):callback()
    def test_old_folder_cleanup_keeps_recent_and_non_date_folders(self):
        for key in ('backtrack_folder','replay_folder','recording_folder'):
            for date in ('2020-01-01',time.strftime('%Y-%m-%d'),'Favorites'):
                folder=Path(self.config[key])/date;folder.mkdir();(folder/'dummy.mp4').write_bytes(b'test')
        self.one_cycle(self.engine.delete_old_folders)
        for key in ('backtrack_folder','replay_folder','recording_folder'):
            self.assertFalse((Path(self.config[key])/'2020-01-01').exists())
            self.assertTrue((Path(self.config[key])/time.strftime('%Y-%m-%d')/'dummy.mp4').exists())
            self.assertTrue((Path(self.config[key])/'Favorites'/'dummy.mp4').exists())
    def test_background_vault_monitor_scans_each_route(self):
        for key in ('backtrack_folder','replay_folder','recording_folder'):
            folder=Path(self.config[key])/self.date;self.engine.create_vault_folders(str(folder))
            (folder/'The Vault'/'Fortnite'/(key+'.mp4')).write_bytes(key.encode())
        self.one_cycle(self.engine.monitor_vault_folders)
        for key in ('backtrack_folder','replay_folder','recording_folder'):
            self.assertEqual((Path(self.config['vault_destination_folder'])/'Fortnite'/(key+'.mp4')).read_bytes(),key.encode())
    def test_empty_source_reports_without_modifying_files(self):
        self.engine.run_sorter();self.assertTrue(any(e.get('type')=='notice' for e in self.events))
        self.assertFalse(list(self.root.rglob('*.mp4')))
    def test_backend_protocol_isolated(self):
        data=self.root/'OBS File Sorter';data.mkdir();(data/'settings.json').write_text(json.dumps(self.config))
        env=dict(os.environ,APPDATA=str(self.root))
        commands='\n'.join(json.dumps(x) for x in [{'action':'save','settings':self.config},{'action':'sort'},{'action':'shutdown'}])+'\n'
        process=subprocess.run([sys.executable,str(INSTALL/'engine'/'backend.py'),'--test'],input=commands,capture_output=True,text=True,encoding='utf-8',env=env,timeout=15)
        self.assertEqual(process.returncode,0,process.stderr)
        events=[json.loads(x) for x in process.stdout.splitlines()]
        self.assertTrue(any(x['type']=='ready' for x in events));self.assertTrue(any(x['type']=='saved' for x in events))
        self.assertEqual(json.loads((data/'settings.json').read_text()),self.config)

if __name__=='__main__':unittest.main(verbosity=2)

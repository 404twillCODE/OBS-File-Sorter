using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace OBSFileSorter;
public sealed record ActivityRow(string Time,string Message);
public sealed class SettingsModel:INotifyPropertyChanged {
    public JsonObject Config;
    public SettingsModel(JsonObject config){Config=config;}
    public event PropertyChangedEventHandler? PropertyChanged;
    public void Notify([CallerMemberName]string? name=null)=>PropertyChanged?.Invoke(this,new(name));
    string Get(string key)=>Config[key]?.ToString()??"";
    void Set(string key,string value,string name){Config[key]=value;Notify(name);}
    public string SourceFolder{get=>Get("source_folder");set=>Set("source_folder",value,nameof(SourceFolder));}
    public string BacktrackFolder{get=>Get("backtrack_folder");set=>Set("backtrack_folder",value,nameof(BacktrackFolder));}
    public string ReplayFolder{get=>Get("replay_folder");set=>Set("replay_folder",value,nameof(ReplayFolder));}
    public string RecordingFolder{get=>Get("recording_folder");set=>Set("recording_folder",value,nameof(RecordingFolder));}
    public string VaultFolder{get=>Get("vault_destination_folder");set=>Set("vault_destination_folder",value,nameof(VaultFolder));}
    public bool AutoDelete{get=>Config["auto_delete"]?.GetValue<bool>()??false;set{Config["auto_delete"]=value;Notify();Notify(nameof(CleanupSummary));}}
    public bool DeleteFolders{get=>Config["auto_delete_folders"]?.GetValue<bool>()??false;set{Config["auto_delete_folders"]=value;Notify();Notify(nameof(CleanupSummary));}}
    public string Minutes{get=>Get("delete_length_minutes");set=>Set("delete_length_minutes",value,nameof(Minutes));}
    public string Days{get=>Get("delete_length_days");set=>Set("delete_length_days",value,nameof(Days));}
    public string CleanupSummary=>!AutoDelete&&!DeleteFolders?"Both options off":AutoDelete&&DeleteFolders?"Both options on":AutoDelete?"Short recordings on":"Old folders on";
    string pending="—";
    public string Pending{get=>pending;set{pending=value;Notify();}}
    public ObservableCollection<ActivityRow> Activity{get;}=[];
    public void SetFolder(string key,string value){Config[key]=value;foreach(var name in new[]{nameof(SourceFolder),nameof(BacktrackFolder),nameof(ReplayFolder),nameof(RecordingFolder),nameof(VaultFolder)})Notify(name);}
    public JsonObject Validated(){
        if(!int.TryParse(Minutes,out int minutes)||minutes<=0||!int.TryParse(Days,out int days)||days<=0)throw new ArgumentException("Enter positive whole numbers for the cleanup thresholds.");
        var copy=(JsonObject)Config.DeepClone();copy["delete_length_minutes"]=minutes;copy["delete_length_days"]=days;
        foreach(var key in new[]{"source_folder","backtrack_folder","replay_folder","recording_folder","vault_destination_folder"}){
            string path=copy[key]?.ToString()??"";
            if(!string.IsNullOrWhiteSpace(path)&&!Path.IsPathFullyQualified(path))throw new ArgumentException("Folder paths must be full paths, such as D:\\OBS.");
        }
        return copy;
    }
}
public partial class MainWindow:Window {
    [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr hwnd,int attribute,ref int value,int size);
    readonly SettingsModel model;
    Process? backend;
    bool closing,allowClose,busy,ready;
    double delayUntil;
    readonly DispatcherTimer timer=new(){Interval=TimeSpan.FromSeconds(1)};
    public MainWindow(){
        InitializeComponent();
        MinWidth=900;MinHeight=650;Width=Math.Min(1160,SystemParameters.WorkArea.Width);Height=Math.Min(840,SystemParameters.WorkArea.Height);
        SourceInitialized+=(_,_)=>{int dark=1;DwmSetWindowAttribute(new System.Windows.Interop.WindowInteropHelper(this).Handle,20,ref dark,sizeof(int));};
        string configFile=Path.Combine(App.DataFolder,"settings.json");
        model=new SettingsModel(JsonNode.Parse(File.ReadAllText(configFile))!.AsObject());DataContext=model;
        try{Icon=BitmapFrame.Create(new Uri("pack://application:,,,/Assets/App.ico"));}catch{}
        model.PropertyChanged+=(_,e)=>{if(e.PropertyName!=nameof(SettingsModel.Pending))SavedText.Text="Unsaved changes";};
        Loaded+=(_,_)=>{if(App.Preview){StatusText.Text="Design preview · file operations are disabled";ready=true;}else StartBackend();};
        Closing+=CloseApp;
        timer.Tick+=(_,_)=>{if(delayUntil>0){double remaining=Math.Ceiling(delayUntil-DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()/1000.0);if(remaining>0)StatusText.Text=$"Sorting in {remaining:0} seconds…";else{delayUntil=0;StatusText.Text="Sorting…";}}};timer.Start();
    }
    void Navigate(object sender,RoutedEventArgs e){
        string page=((Button)sender).Tag.ToString()!;
        foreach(var pair in new[]{(OverviewNav,OverviewView,"Overview"),(FoldersNav,FoldersView,"Folders"),(CleanupNav,CleanupView,"Cleanup"),(ActivityNav,ActivityView,"Activity")}){
            pair.Item2.Visibility=pair.Item3==page?Visibility.Visible:Visibility.Collapsed;
            pair.Item1.Background=(Brush)new BrushConverter().ConvertFromString(pair.Item3==page?"#28223D":"Transparent")!;
        }
        PageTitle.Text=page switch{"Overview"=>"Your recording workspace","Folders"=>"Your folders","Cleanup"=>"Keep what matters",_=>"Activity"};
        PageSubtitle.Text=page switch{"Overview"=>"Clips organized. Originals handled the way you configured.","Folders"=>"The same destinations. A clearer view.","Cleanup"=>"Your existing cleanup rules, in one place.",_=>"See what the sorter is doing."};
    }
    void StartBackend(){
        try{
            string root=AppContext.BaseDirectory;
            var info=new ProcessStartInfo(Path.Combine(root,"runtime","python.exe")){
                WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,
                StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8,StandardInputEncoding=new UTF8Encoding(false)};
            info.ArgumentList.Add(Path.Combine(root,"engine","backend.py"));
            backend=new Process{StartInfo=info,EnableRaisingEvents=true};
            backend.OutputDataReceived+=(_,e)=>{if(e.Data!=null)Dispatcher.BeginInvoke(()=>HandleEvent(e.Data));};
            backend.ErrorDataReceived+=(_,e)=>{if(!string.IsNullOrWhiteSpace(e.Data))Dispatcher.BeginInvoke(()=>AddActivity("Engine: "+e.Data));};
            backend.Exited+=(_,_)=>Dispatcher.BeginInvoke(()=>{if(!closing){ready=false;SortButton.IsEnabled=false;StatusText.Text="Processing engine stopped. Reopen the app to reconnect.";AddActivity("The processing engine stopped. Check the full log for details.");}});
            backend.Start();backend.BeginOutputReadLine();backend.BeginErrorReadLine();
        }catch(Exception ex){StatusText.Text="Could not start the processing engine.";AddActivity(ex.Message);SortButton.IsEnabled=false;}
    }
    void HandleEvent(string line){
        try{
            var value=JsonNode.Parse(line)!;string type=value["type"]?.ToString()??"";
            switch(type){
                case "ready":ready=true;StatusText.Text="Ready · F9 or F14 to sort";AddActivity("Sorter ready. Your existing folders and processing rules are loaded.");break;
                case "snapshot":model.Pending=value["pending"]!.ToString();if(!busy&&delayUntil==0)StatusText.Text=value["source_available"]!.GetValue<bool>()?"Ready · F9 or F14 to sort":"Source folder is unavailable · check Folders";break;
                case "activity":AddActivity(value["message"]!.ToString());break;
                case "status":if(delayUntil==0)StatusText.Text=value["message"]!.ToString();break;
                case "notice":StatusText.Text=value["message"]!.ToString();AddActivity(value["message"]!.ToString());break;
                case "busy":busy=value["value"]!.GetValue<bool>();SortButton.IsEnabled=!busy;Progress.Visibility=busy?Visibility.Visible:Visibility.Collapsed;if(!busy){delayUntil=0;StatusText.Text="Ready · F9 or F14 to sort";}break;
                case "delay":delayUntil=value["until"]!.GetValue<double>();StatusText.Text="Sorting in 5 seconds…";break;
                case "saved":SavedText.Text="Settings saved";StatusText.Text="Settings saved";break;
            }
        }catch{AddActivity(line);}
    }
    void AddActivity(string message){model.Activity.Insert(0,new(DateTime.Now.ToString("HH:mm:ss"),message));while(model.Activity.Count>200)model.Activity.RemoveAt(model.Activity.Count-1);}
    void Send(string action,JsonObject? settings=null){
        if(App.Preview){StatusText.Text="Preview only · no files or settings were changed";return;}
        if(!ready||backend==null||backend.HasExited){MessageBox.Show(this,"The processing engine is not ready. Please reopen the app.","OBS File Sorter");return;}
        var command=new JsonObject{["action"]=action};if(settings!=null)command["settings"]=settings;
        backend.StandardInput.WriteLine(command.ToJsonString());backend.StandardInput.Flush();
    }
    void SaveSettings(object sender,RoutedEventArgs e){try{if(busy){StatusText.Text="Wait for the current sort to finish before saving.";return;}Send("save",model.Validated());}catch(ArgumentException ex){MessageBox.Show(this,ex.Message,"Check settings",MessageBoxButton.OK,MessageBoxImage.Information);}}
    void SortClips(object sender,RoutedEventArgs e){try{Send("sort",model.Validated());}catch(ArgumentException ex){MessageBox.Show(this,ex.Message,"Check settings");}}
    void BrowseFolder(object sender,RoutedEventArgs e){string key=((Button)sender).Tag.ToString()!;var dialog=new Microsoft.Win32.OpenFolderDialog{Title="Choose a folder",InitialDirectory=model.Config[key]?.ToString()??""};if(dialog.ShowDialog(this)==true)model.SetFolder(key,dialog.FolderName);}
    void OpenFolder(object sender,RoutedEventArgs e){string path=model.Config[((Button)sender).Tag.ToString()!]?.ToString()??"";if(Directory.Exists(path))Process.Start(new ProcessStartInfo(path){UseShellExecute=true});else MessageBox.Show(this,"This folder is not available. Check its path in Folders.","OBS File Sorter");}
    void OpenLog(object sender,RoutedEventArgs e){string file=Path.Combine(App.DataFolder,"obs_sorter.log");if(File.Exists(file))Process.Start(new ProcessStartInfo("notepad.exe"){ArgumentList={file},UseShellExecute=true});}
    async void CloseApp(object? sender,CancelEventArgs e){
        if(allowClose)return;
        if(backend==null||backend.HasExited){timer.Stop();return;}
        e.Cancel=true;if(closing)return;closing=true;SortButton.IsEnabled=false;StatusText.Text="Closing · finishing any active file operation…";
        try{backend.StandardInput.WriteLine("{\"action\":\"shutdown\"}");backend.StandardInput.Flush();await backend.WaitForExitAsync();}catch{}
        allowClose=true;timer.Stop();Close();
    }
}

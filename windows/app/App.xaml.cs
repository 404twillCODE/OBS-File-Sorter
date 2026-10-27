using System.IO;
using System.Threading;
using System.Windows;

namespace OBSFileSorter;
public partial class App:Application {
    private Mutex? instance;
    private System.Windows.Threading.DispatcherTimer? activation;
    public static string DataFolder=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"OBS File Sorter");
    public static bool Preview;
    protected override void OnStartup(StartupEventArgs e){
        base.OnStartup(e);
        Directory.CreateDirectory(DataFolder);
        if(e.Args.Contains("--make-icon")){Branding.SaveIcon(e.Args.Last());Shutdown();return;}
        string settings=Path.Combine(DataFolder,"settings.json");
        if(!File.Exists(settings))File.WriteAllText(settings,"""
            {"source_folder":"","backtrack_folder":"","replay_folder":"","recording_folder":"","vault_destination_folder":"","auto_delete":false,"delete_length_minutes":7,"auto_delete_folders":false,"delete_length_days":14}
            """);
        Preview=e.Args.Contains("--preview");
        instance=new Mutex(true,"BEETOGLE.OBSFileSorter"+(Preview?".Preview":""),out bool first);
        if(!first){File.WriteAllText(Path.Combine(DataFolder,"show.request"),"");Shutdown();return;}
        var window=new MainWindow();MainWindow=window;window.Show();
        if(e.Args.Contains("--startup"))window.WindowState=WindowState.Minimized;
        activation=new System.Windows.Threading.DispatcherTimer{Interval=TimeSpan.FromMilliseconds(500)};
        activation.Tick+=(_,_)=>{string request=Path.Combine(DataFolder,"show.request");if(File.Exists(request)){File.Delete(request);window.WindowState=WindowState.Normal;window.Show();window.Activate();}};
        activation.Start();
    }
    protected override void OnExit(ExitEventArgs e){activation?.Stop();instance?.Dispose();base.OnExit(e);}
}

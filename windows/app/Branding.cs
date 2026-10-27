using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace OBSFileSorter;
internal static class Branding {
    public static void SaveIcon(string path){
        var sizes=new[]{16,24,32,48,64,128,256};var frames=new List<byte[]>();
        foreach(int size in sizes){
            var visual=new DrawingVisual();
            using(var dc=visual.RenderOpen()){
                dc.PushTransform(new ScaleTransform(size/64.0,size/64.0));
                dc.DrawRoundedRectangle(new SolidColorBrush(Color.FromRgb(29,25,54)),null,new Rect(1,1,62,62),15,15);
                var folder=Geometry.Parse("M12,19 L27,19 L32,24 L53,24 L53,47 Q53,51 49,51 L15,51 Q11,51 11,47 L11,23 Q11,19 12,19 Z");
                dc.DrawGeometry(new SolidColorBrush(Color.FromRgb(174,151,255)),null,folder);
                dc.DrawGeometry(new SolidColorBrush(Color.FromRgb(49,211,191)),null,Geometry.Parse("M29,29 L37,29 L37,36 L43,36 L33,46 L23,36 L29,36 Z"));
                dc.Pop();
            }
            var bitmap=new RenderTargetBitmap(size,size,96,96,PixelFormats.Pbgra32);bitmap.Render(visual);
            var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using var stream=new MemoryStream();encoder.Save(stream);frames.Add(stream.ToArray());
        }
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var output=new BinaryWriter(File.Create(path));output.Write((ushort)0);output.Write((ushort)1);output.Write((ushort)sizes.Length);
        int offset=6+sizes.Length*16;
        for(int i=0;i<sizes.Length;i++){int size=sizes[i];output.Write((byte)(size==256?0:size));output.Write((byte)(size==256?0:size));output.Write((byte)0);output.Write((byte)0);output.Write((ushort)1);output.Write((ushort)32);output.Write(frames[i].Length);output.Write(offset);offset+=frames[i].Length;}
        foreach(var frame in frames)output.Write(frame);
    }
}

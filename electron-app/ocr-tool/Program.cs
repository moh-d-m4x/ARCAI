using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Storage;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Globalization;
using Windows.Storage.Streams;

class Program
{
    static async Task<int> Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: OcrTool.exe <imagePath> <resultPath> [language]");
            Console.Error.WriteLine("  language: ar-SA (default) or en-US");
            return 1;
        }

        string imagePath = args[0];
        string resultPath = args[1];
        string languageTag = args.Length > 2 ? args[2] : "ar-SA";

        try
        {
            // Get the image file
            var file = await StorageFile.GetFileFromPathAsync(imagePath);
            
            // Open stream
            using (var stream = await file.OpenAsync(FileAccessMode.Read))
            {
                // Decode image
                var decoder = await BitmapDecoder.CreateAsync(stream);
                
                // Upscale the image 3x for better OCR accuracy
                uint scaleFactor = 3;
                uint scaledWidth = decoder.PixelWidth * scaleFactor;
                uint scaledHeight = decoder.PixelHeight * scaleFactor;
                
                // Create transform for upscaling with high-quality interpolation
                var transform = new BitmapTransform
                {
                    ScaledWidth = scaledWidth,
                    ScaledHeight = scaledHeight,
                    InterpolationMode = BitmapInterpolationMode.Fant // High quality
                };
                
                // Get upscaled pixel data
                var pixelData = await decoder.GetPixelDataAsync(
                    BitmapPixelFormat.Bgra8,
                    BitmapAlphaMode.Premultiplied,
                    transform,
                    ExifOrientationMode.RespectExifOrientation,
                    ColorManagementMode.ColorManageToSRgb);
                
                var pixels = pixelData.DetachPixelData();
                
                // Apply sharpening filter to enhance edges and dots
                ApplySharpenFilter(pixels, (int)scaledWidth, (int)scaledHeight);
                
                // Create software bitmap from processed pixel data
                var bitmap = SoftwareBitmap.CreateCopyFromBuffer(
                    pixels.AsBuffer(),
                    BitmapPixelFormat.Bgra8,
                    (int)scaledWidth,
                    (int)scaledHeight,
                    BitmapAlphaMode.Premultiplied);
                
                // Create OCR engine
                var language = new Language(languageTag);
                var engine = OcrEngine.TryCreateFromLanguage(language);
                
                if (engine == null)
                {
                    File.WriteAllText(resultPath, "ERROR:OCR engine not available for " + languageTag);
                    return 1;
                }
                
                // Perform OCR on processed image
                var result = await engine.RecognizeAsync(bitmap);
                
                // For Arabic, ensure lines are in top-to-bottom order
                var lines = result.Lines
                    .OrderBy(line => line.Words.FirstOrDefault()?.BoundingRect.Y ?? 0)
                    .Select(line => line.Text)
                    .ToList();
                
                string text = string.Join("\n", lines);
                
                // Write result
                File.WriteAllText(resultPath, "TEXT:" + text);
                return 0;
            }
        }
        catch (Exception ex)
        {
            File.WriteAllText(resultPath, "ERROR:" + ex.Message);
            return 1;
        }
    }
    
    /// <summary>
    /// Apply a 3x3 sharpening convolution filter to enhance edges and details.
    /// This helps OCR distinguish similar characters like خ and ع by making dots clearer.
    /// </summary>
    static void ApplySharpenFilter(byte[] pixels, int width, int height)
    {
        // Sharpening kernel (unsharp mask style)
        // [  0, -1,  0 ]
        // [ -1,  5, -1 ]
        // [  0, -1,  0 ]
        int[] kernel = { 0, -1, 0, -1, 5, -1, 0, -1, 0 };
        
        // Create a copy of the original pixels
        byte[] original = new byte[pixels.Length];
        Array.Copy(pixels, original, pixels.Length);
        
        int stride = width * 4; // BGRA = 4 bytes per pixel
        
        // Apply convolution (skip edges to avoid boundary issues)
        for (int y = 1; y < height - 1; y++)
        {
            for (int x = 1; x < width - 1; x++)
            {
                int pixelIndex = y * stride + x * 4;
                
                // Apply kernel to each color channel (B, G, R), skip Alpha
                for (int c = 0; c < 3; c++)
                {
                    int sum = 0;
                    int ki = 0;
                    
                    for (int ky = -1; ky <= 1; ky++)
                    {
                        for (int kx = -1; kx <= 1; kx++)
                        {
                            int sampleIndex = (y + ky) * stride + (x + kx) * 4 + c;
                            sum += original[sampleIndex] * kernel[ki];
                            ki++;
                        }
                    }
                    
                    // Clamp result to valid byte range
                    pixels[pixelIndex + c] = (byte)Math.Max(0, Math.Min(255, sum));
                }
            }
        }
    }
}

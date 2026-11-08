using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using DesktopHost.Services;
using Microsoft.Web.WebView2.Core;

namespace DesktopHost;

public partial class MainWindow : Window
{
    private readonly PosPrinterBridge _printerBridge = new();

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnMainWindowLoaded;
        Closing += OnMainWindowClosing;
    }

    private async void OnMainWindowLoaded(object sender, RoutedEventArgs e)
    {
        await InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            // Set isolated user data directory in %AppData%\ZiloxERP\WebView2Cache
            string userDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "ZiloxERP",
                "WebView2Cache"
            );
            Directory.CreateDirectory(userDataDir);

            var env = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null, // Uses Evergreen WebView2 Runtime
                userDataFolder: userDataDir,
                options: new CoreWebView2EnvironmentOptions()
            );

            await WebViewControl.EnsureCoreWebView2Async(env);

            // Configure browser settings for App / Kiosk Experience
            var settings = WebViewControl.CoreWebView2.Settings;
            settings.IsStatusBarEnabled = false;
            settings.AreDefaultContextMenusEnabled = false;
            settings.AreDevToolsEnabled = true; // Enabled for diagnosis; set to false in strict retail kiosk
            settings.IsZoomControlEnabled = false;

            // Register POS Hardware Bridge for JavaScript
            WebViewControl.CoreWebView2.AddHostObjectToScript("posPrinterBridge", _printerBridge);

            // Configure Virtual Host Mapping to local SPA directory (app.zilox.local -> wwwroot)
            LocalWebServer.Instance.ConfigureVirtualHostMapping(WebViewControl.CoreWebView2);

            // Inject global desktop environment identifier into JavaScript
            await WebViewControl.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
                window.__IS_WINDOWS_DESKTOP__ = true;
                window.__ZILOX_HOST_VERSION__ = '2.0.0';
                console.log('[ZiloX Desktop Host] Native POS Hardware Bridge initialized.');
            ");

            // Navigate to SPA
            string targetUrl = LocalWebServer.AppSchemeUrl;
            WebViewControl.CoreWebView2.NavigationCompleted += (s, args) =>
            {
                if (args.IsSuccess)
                {
                    LoadingOverlay.Visibility = Visibility.Collapsed;
                }
            };

            WebViewControl.CoreWebView2.Navigate(targetUrl);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                this,
                $"فشل تهيئة محرك WebView2: {ex.Message}\n\nيرجى التأكد من تثبيت Microsoft Edge WebView2 Runtime.",
                "خطأ في تشغيل واجهة النظام",
                MessageBoxButton.OK,
                MessageBoxImage.Error
            );
        }
    }

    private void OnMainWindowClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        // Gracefully kill backend process and all child workers
        BackendProcessManager.Instance.StopBackend();
        LocalWebServer.Instance.Dispose();
    }
}


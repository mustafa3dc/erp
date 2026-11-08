using System;
using System.Threading;
using System.Windows;
using DesktopHost.Services;
using DesktopHost.Views;

namespace DesktopHost;

public partial class App : Application
{
    private const string MutexId = "Global\\ZiloxERPDesktopSingleInstance";
    private Mutex? _singleInstanceMutex;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // 1. Single Instance Check via Global Mutex
        _singleInstanceMutex = new Mutex(true, MutexId, out bool isNewInstance);
        if (!isNewInstance)
        {
            MessageBox.Show(
                "برنامج ZiloX ERP يعمل بالفعل على هذا الجهاز في الخلفية!",
                "تنبيه تشغيل نسخة سابقة",
                MessageBoxButton.OK,
                MessageBoxImage.Warning
            );
            Shutdown();
            return;
        }

        // 2. Hardware-Locked License Verification
        var licenseResult = LicensingService.Instance.CheckCurrentLicense();
        if (!licenseResult.IsValid)
        {
            // Prompt User with Activation Window
            var activationWin = new ActivationWindow();
            bool? activated = activationWin.ShowDialog();

            if (activated != true)
            {
                // User closed activation without activating
                Shutdown();
                return;
            }
        }

        // 3. Show Splash Screen while booting API & Database
        var splash = new SplashScreenWindow();
        splash.Show();

        // 4. Start ASP.NET Core Backend in Background
        bool backendStarted = await BackendProcessManager.Instance.StartBackendAsync(msg =>
        {
            splash.UpdateStatus(msg);
        });

        // 5. Start Fallback Local HTTP Server
        LocalWebServer.Instance.StartHttpListener();

        // 6. Launch Main Application Window
        splash.UpdateStatus("اكتمل الإعداد! جاري فتح نافذة النظام...");
        await System.Threading.Tasks.Task.Delay(500);

        var mainWindow = new MainWindow();
        MainWindow = mainWindow;
        mainWindow.Show();

        splash.Close();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        BackendProcessManager.Instance.Dispose();
        LocalWebServer.Instance.Dispose();
        if (_singleInstanceMutex != null)
        {
            try { _singleInstanceMutex.ReleaseMutex(); } catch { }
            _singleInstanceMutex.Dispose();
        }
        base.OnExit(e);
    }
}


using System.Windows;

namespace DesktopHost.Views;

public partial class SplashScreenWindow : Window
{
    public SplashScreenWindow()
    {
        InitializeComponent();
    }

    public void UpdateStatus(string message)
    {
        Dispatcher.Invoke(() =>
        {
            TxtStatus.Text = message;
        });
    }
}


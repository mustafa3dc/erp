using System;
using System.IO;
using System.Windows;
using System.Windows.Media;
using DesktopHost.Services;
using Microsoft.Win32;

namespace DesktopHost.Views;

public partial class ActivationWindow : Window
{
    public ActivationWindow()
    {
        InitializeComponent();
        Loaded += OnWindowLoaded;
    }

    private void OnWindowLoaded(object sender, RoutedEventArgs e)
    {
        TxtMachineId.Text = HardwareIdService.GetMachineId();
    }

    private void OnCopyMachineIdClicked(object sender, RoutedEventArgs e)
    {
        Clipboard.SetText(TxtMachineId.Text);
        ShowAlert("تم نسخ كود الجهاز (Machine ID) إلى الحافظة بنجاح! أرسله للمطور لإصدار الترخيص.", isSuccess: true);
    }

    private void OnImportLicenseFileClicked(object sender, RoutedEventArgs e)
    {
        var ofd = new OpenFileDialog
        {
            Filter = "ملفات الترخيص (*.lic)|*.lic|All Files (*.*)|*.*",
            Title = "اختر ملف الترخيص الخاص بهذا الجهاز"
        };

        if (ofd.ShowDialog() == true)
        {
            try
            {
                string content = File.ReadAllText(ofd.FileName);
                TxtLicenseKey.Text = content.Trim();
                OnActivateClicked(sender, e);
            }
            catch (Exception ex)
            {
                ShowAlert($"فشل قراءة ملف الترخيص: {ex.Message}", isSuccess: false);
            }
        }
    }

    private void OnActivateClicked(object sender, RoutedEventArgs e)
    {
        string key = TxtLicenseKey.Text.Trim();
        if (string.IsNullOrWhiteSpace(key))
        {
            ShowAlert("يرجى لصق أو إدخال مفتاح التفعيل أولاً.", isSuccess: false);
            return;
        }

        var result = LicensingService.Instance.ValidateLicenseKey(key, persistIfValid: true);
        if (result.IsValid)
        {
            ShowAlert(result.StatusMessage, isSuccess: true);
            MessageBox.Show(
                this,
                $"{result.StatusMessage}\n\nنوع النشاط المفعل: {result.Payload?.Preset}\nعدد النقاط: {result.Payload?.MaxTerminals}",
                "تم تفعيل النظام بنجاح",
                MessageBoxButton.OK,
                MessageBoxImage.Information
            );
            DialogResult = true;
            Close();
        }
        else
        {
            ShowAlert(result.StatusMessage, isSuccess: false);
        }
    }

    private void OnCloseClicked(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void ShowAlert(string message, bool isSuccess)
    {
        AlertBorder.Visibility = Visibility.Visible;
        TxtStatusMessage.Text = message;

        if (isSuccess)
        {
            AlertBorder.Background = new SolidColorBrush(Color.FromRgb(6, 78, 59));
            AlertBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(16, 185, 129));
            TxtStatusMessage.Foreground = new SolidColorBrush(Color.FromRgb(209, 250, 229));
        }
        else
        {
            AlertBorder.Background = new SolidColorBrush(Color.FromRgb(127, 29, 29));
            AlertBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(239, 68, 68));
            TxtStatusMessage.Foreground = new SolidColorBrush(Color.FromRgb(254, 226, 226));
        }
    }
}


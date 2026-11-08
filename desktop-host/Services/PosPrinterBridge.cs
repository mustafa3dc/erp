using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using DesktopHost.Models;

namespace DesktopHost.Services;

/// <summary>
/// Native POS Hardware Bridge exposed to Next.js / React frontend via WebView2 JavaScript Object Bridge.
/// Available in JS via window.chrome.webview.hostObjects.posPrinterBridge.
/// Enables completely silent ESC/POS thermal printing and electronic cash drawer kicking without browser dialogs.
/// </summary>
[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class PosPrinterBridge
{
    // ESC/POS Commands
    private static readonly byte[] EscInit = new byte[] { 0x1B, 0x40 }; // Initialize printer
    private static readonly byte[] EscAlignLeft = new byte[] { 0x1B, 0x61, 0x00 };
    private static readonly byte[] EscAlignCenter = new byte[] { 0x1B, 0x61, 0x01 };
    private static readonly byte[] EscAlignRight = new byte[] { 0x1B, 0x61, 0x02 };
    private static readonly byte[] EscBoldOn = new byte[] { 0x1B, 0x45, 0x01 };
    private static readonly byte[] EscBoldOff = new byte[] { 0x1B, 0x45, 0x00 };
    private static readonly byte[] EscDoubleSize = new byte[] { 0x1D, 0x21, 0x11 }; // 2x width & height
    private static readonly byte[] EscNormalSize = new byte[] { 0x1D, 0x21, 0x00 };
    private static readonly byte[] EscCutPaper = new byte[] { 0x1D, 0x56, 0x00 }; // GS V 0 (Full Cut)
    private static readonly byte[] EscKickDrawer = new byte[] { 0x1B, 0x70, 0x00, 0x19, 0xFA }; // ESC p 0 25 250 (Drawer Kick)
    private static readonly byte[] EscFeedLines = new byte[] { 0x1B, 0x64, 0x03 }; // Feed 3 lines

    /// <summary>
    /// Gets list of all installed printer names on this Windows machine as a JSON array string.
    /// </summary>
    public string GetInstalledPrinters()
    {
        var list = new List<string>();
        foreach (string printer in PrinterSettings.InstalledPrinters)
        {
            list.Add(printer);
        }
        return JsonSerializer.Serialize(list);
    }

    /// <summary>
    /// Gets the default printer name.
    /// </summary>
    public string GetDefaultPrinter()
    {
        return RawPrinterHelper.GetDefaultPrinterName();
    }

    /// <summary>
    /// Sends the electronic pulse to kick/open the cash drawer connected via RJ11 to the printer.
    /// </summary>
    public bool KickCashDrawer(string? printerName = null)
    {
        string targetPrinter = ResolvePrinterName(printerName);
        if (string.IsNullOrEmpty(targetPrinter)) return false;

        return RawPrinterHelper.SendBytesToPrinter(targetPrinter, EscKickDrawer, "Open Cash Drawer");
    }

    /// <summary>
    /// Prints a receipt silently from JSON data and optionally opens the cash drawer.
    /// </summary>
    public bool PrintReceipt(string receiptJson)
    {
        if (string.IsNullOrWhiteSpace(receiptJson)) return false;

        PrintJobRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<PrintJobRequest>(receiptJson);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PosPrinterBridge] Failed to deserialize receipt JSON: {ex.Message}");
            return false;
        }

        if (request == null) return false;

        string targetPrinter = ResolvePrinterName(request.PrinterName);
        if (string.IsNullOrEmpty(targetPrinter)) return false;

        try
        {
            byte[] receiptBytes = BuildReceiptBytes(request);
            bool printed = RawPrinterHelper.SendBytesToPrinter(targetPrinter, receiptBytes, $"Invoice_{request.InvoiceNumber}");

            if (printed && request.OpenDrawer)
            {
                KickCashDrawer(targetPrinter);
            }

            return printed;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PosPrinterBridge] Printing error: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Sends raw binary data (Base64 encoded) directly to the printer spooler.
    /// </summary>
    public bool PrintRawBytesBase64(string printerName, string base64Bytes, string docName = "Raw Job")
    {
        try
        {
            string targetPrinter = ResolvePrinterName(printerName);
            byte[] bytes = Convert.FromBase64String(base64Bytes);
            return RawPrinterHelper.SendBytesToPrinter(targetPrinter, bytes, docName);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Prints a diagnostic test slip to verify hardware connection.
    /// </summary>
    public string TestPrint(string? printerName = null)
    {
        string targetPrinter = ResolvePrinterName(printerName);
        if (string.IsNullOrEmpty(targetPrinter))
        {
            return "ERROR: لا توجد طابعة معتمدة مثبتة على هذا الحاسوب.";
        }

        var sb = new List<byte>();
        sb.AddRange(EscInit);
        sb.AddRange(EscAlignCenter);
        sb.AddRange(EscBoldOn);
        sb.AddRange(EscDoubleSize);
        sb.AddRange(Encoding.UTF8.GetBytes("ZiloX Business Suite\n"));
        sb.AddRange(EscNormalSize);
        sb.AddRange(Encoding.UTF8.GetBytes("Hardware Bridge Test Slip\n"));
        sb.AddRange(Encoding.UTF8.GetBytes("--------------------------------\n"));
        sb.AddRange(EscAlignLeft);
        sb.AddRange(Encoding.UTF8.GetBytes($"Printer: {targetPrinter}\n"));
        sb.AddRange(Encoding.UTF8.GetBytes($"Date: {DateTime.Now:yyyy-MM-dd HH:mm:ss}\n"));
        sb.AddRange(Encoding.UTF8.GetBytes($"Status: Operational (Silent ESC/POS)\n"));
        sb.AddRange(Encoding.UTF8.GetBytes("--------------------------------\n"));
        sb.AddRange(EscAlignCenter);
        sb.AddRange(Encoding.UTF8.GetBytes("تم الاتصال بالطابعة الحرارية بنجاح!\n"));
        sb.AddRange(EscFeedLines);
        sb.AddRange(EscCutPaper);

        bool success = RawPrinterHelper.SendBytesToPrinter(targetPrinter, sb.ToArray(), "Test Slip");
        return success ? $"OK: تم إرسال أمر الطباعة بنجاح إلى '{targetPrinter}'." : "ERROR: فشل إرسال أمر الطباعة.";
    }

    private byte[] BuildReceiptBytes(PrintJobRequest req)
    {
        var ms = new MemoryStream();
        using var bw = new BinaryWriter(ms);

        // 1. Initialize
        bw.Write(EscInit);

        // 2. Header (Centered, Bold)
        bw.Write(EscAlignCenter);
        bw.Write(EscBoldOn);
        bw.Write(EscDoubleSize);
        bw.Write(Encoding.UTF8.GetBytes($"{req.CompanyName}\n"));
        bw.Write(EscNormalSize);
        bw.Write(EscBoldOff);

        if (!string.IsNullOrWhiteSpace(req.CompanyPhone))
        {
            bw.Write(Encoding.UTF8.GetBytes($"هاتف: {req.CompanyPhone}\n"));
        }
        if (!string.IsNullOrWhiteSpace(req.CompanyAddress))
        {
            bw.Write(Encoding.UTF8.GetBytes($"{req.CompanyAddress}\n"));
        }

        bw.Write(Encoding.UTF8.GetBytes("================================\n"));

        // 3. Invoice Metadata (Left / Right)
        bw.Write(EscAlignLeft);
        bw.Write(Encoding.UTF8.GetBytes($"رقم الفاتورة: {req.InvoiceNumber}\n"));
        bw.Write(Encoding.UTF8.GetBytes($"التاريخ: {req.InvoiceDate}\n"));
        bw.Write(Encoding.UTF8.GetBytes($"الكاشير: {req.CashierName}\n"));
        if (!string.IsNullOrWhiteSpace(req.CustomerName))
        {
            bw.Write(Encoding.UTF8.GetBytes($"العميل: {req.CustomerName}\n"));
        }
        bw.Write(Encoding.UTF8.GetBytes($"طريقة الدفع: {req.PaymentMethod}\n"));
        bw.Write(Encoding.UTF8.GetBytes("--------------------------------\n"));

        // 4. Items Table Header
        // 32-column standard thermal width (80mm / 58mm)
        // Format: Item Name (16 chars), Qty (4 chars), Price (12 chars)
        bw.Write(EscBoldOn);
        bw.Write(Encoding.UTF8.GetBytes("الصنف               الكمية   الإجمالي\n"));
        bw.Write(EscBoldOff);
        bw.Write(Encoding.UTF8.GetBytes("--------------------------------\n"));

        // 5. Items Lines
        foreach (var item in req.Items)
        {
            string name = item.Name.Length > 18 ? item.Name.Substring(0, 18) : item.Name;
            string qty = item.Quantity.ToString("0.###");
            string total = $"{item.TotalPrice:N0} {req.Currency}";

            // Line 1: Item Name
            bw.Write(Encoding.UTF8.GetBytes($"{name}\n"));
            // Line 2: Details right aligned
            string details = $"  {qty} × {item.UnitPrice:N0} = {total}";
            bw.Write(Encoding.UTF8.GetBytes($"{details}\n"));
        }

        bw.Write(Encoding.UTF8.GetBytes("================================\n"));

        // 6. Totals
        bw.Write(EscAlignRight);
        bw.Write(Encoding.UTF8.GetBytes($"المجموع الفرعي: {req.Subtotal:N0} {req.Currency}\n"));
        if (req.Discount > 0)
        {
            bw.Write(Encoding.UTF8.GetBytes($"الخصم: -{req.Discount:N0} {req.Currency}\n"));
        }
        if (req.Tax > 0)
        {
            bw.Write(Encoding.UTF8.GetBytes($"الضريبة: +{req.Tax:N0} {req.Currency}\n"));
        }

        bw.Write(EscBoldOn);
        bw.Write(EscDoubleSize);
        bw.Write(Encoding.UTF8.GetBytes($"الصافي: {req.GrandTotal:N0} {req.Currency}\n"));
        bw.Write(EscNormalSize);
        bw.Write(EscBoldOff);

        bw.Write(Encoding.UTF8.GetBytes("--------------------------------\n"));

        // 7. Footer & Notes
        bw.Write(EscAlignCenter);
        if (!string.IsNullOrWhiteSpace(req.Notes))
        {
            bw.Write(Encoding.UTF8.GetBytes($"{req.Notes}\n"));
        }
        bw.Write(Encoding.UTF8.GetBytes("شكراً لزيارتكم • ZiloX ERP\n"));

        // 8. Feed and Cut
        bw.Write(EscFeedLines);
        if (req.CutPaper)
        {
            bw.Write(EscCutPaper);
        }

        return ms.ToArray();
    }

    private string ResolvePrinterName(string? candidate)
    {
        if (!string.IsNullOrWhiteSpace(candidate))
        {
            foreach (string p in PrinterSettings.InstalledPrinters)
            {
                if (string.Equals(p, candidate.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    return p;
                }
            }
        }

        return RawPrinterHelper.GetDefaultPrinterName();
    }
}


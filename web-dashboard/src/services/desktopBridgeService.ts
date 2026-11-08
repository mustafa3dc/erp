/**
 * Desktop Hardware Bridge Service.
 * Interfaces directly with the C# WPF Desktop Host via Microsoft.Web.WebView2
 * Host Objects for completely silent ESC/POS printing and cash drawer kick.
 */

export interface DesktopPrintItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string;
}

export interface DesktopReceiptPayload {
  printerName?: string;
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  invoiceNumber: string;
  invoiceDate: string;
  cashierName: string;
  customerName?: string;
  items: DesktopPrintItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  currency: string;
  paymentMethod: string;
  notes?: string;
  openDrawer?: boolean;
  cutPaper?: boolean;
  qrData?: string;
}

declare global {
  interface Window {
    __IS_WINDOWS_DESKTOP__?: boolean;
    __ZILOX_HOST_VERSION__?: string;
    chrome?: {
      webview?: {
        hostObjects?: {
          posPrinterBridge?: {
            GetInstalledPrinters: () => Promise<string>;
            GetDefaultPrinter: () => Promise<string>;
            KickCashDrawer: (printerName?: string) => Promise<boolean>;
            PrintReceipt: (json: string) => Promise<boolean>;
            PrintRawBytesBase64: (printerName: string, base64: string, docName?: string) => Promise<boolean>;
            TestPrint: (printerName?: string) => Promise<string>;
          };
        };
      };
    };
  }
}

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.__IS_WINDOWS_DESKTOP__ || 
    window.chrome?.webview?.hostObjects?.posPrinterBridge
  );
}

export async function printReceiptNative(payload: DesktopReceiptPayload): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const bridge = window.chrome?.webview?.hostObjects?.posPrinterBridge;
  if (!bridge) {
    // Fallback to standard browser print
    window.print();
    return true;
  }

  try {
    const jsonStr = JSON.stringify(payload);
    const success = await bridge.PrintReceipt(jsonStr);
    return Boolean(success);
  } catch (err) {
    console.error('[DesktopBridge] Native print error, falling back to window.print():', err);
    window.print();
    return false;
  }
}

export async function kickDrawerNative(printerName?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const bridge = window.chrome?.webview?.hostObjects?.posPrinterBridge;
  if (!bridge) return false;

  try {
    return await bridge.KickCashDrawer(printerName);
  } catch (err) {
    console.error('[DesktopBridge] Kick drawer error:', err);
    return false;
  }
}

export async function getInstalledPrintersNative(): Promise<string[]> {
  if (typeof window === 'undefined') return [];

  const bridge = window.chrome?.webview?.hostObjects?.posPrinterBridge;
  if (!bridge) return [];

  try {
    const json = await bridge.GetInstalledPrinters();
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export async function testPrinterNative(printerName?: string): Promise<string> {
  if (typeof window === 'undefined') return 'Error: Not in Desktop Host';

  const bridge = window.chrome?.webview?.hostObjects?.posPrinterBridge;
  if (!bridge) return 'Error: Bridge not found';

  try {
    return await bridge.TestPrint(printerName);
  } catch (err: any) {
    return `Error: ${err?.message || err}`;
  }
}


using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;

namespace DesktopHost.Services;

/// <summary>
/// High-performance local server for Next.js / Vite SPA files.
/// Supports both WebView2 Virtual Host Mapping (app.zilox.local) and lightweight local HttpListener.
/// </summary>
public class LocalWebServer : IDisposable
{
    private static readonly Lazy<LocalWebServer> _instance = new(() => new LocalWebServer());
    public static LocalWebServer Instance => _instance.Value;

    public const string VirtualHostName = "app.zilox.local";
    public const string AppSchemeUrl = $"http://{VirtualHostName}/";

    private HttpListener? _listener;
    private CancellationTokenSource? _cts;
    public int ListenerPort { get; private set; } = 5054;
    public string FallbackHttpUrl => $"http://localhost:{ListenerPort}/";

    private string _wwwRootDir = string.Empty;

    public LocalWebServer()
    {
        _wwwRootDir = ResolveWwwRootDirectory();
    }

    /// <summary>
    /// Configures WebView2 to serve local static files via Virtual Host Mapping.
    /// This requires no open network sockets and provides maximum speed and security.
    /// </summary>
    public void ConfigureVirtualHostMapping(CoreWebView2 coreWebView2)
    {
        _wwwRootDir = ResolveWwwRootDirectory();
        if (Directory.Exists(_wwwRootDir))
        {
            coreWebView2.SetVirtualHostNameToFolderMapping(
                VirtualHostName,
                _wwwRootDir,
                CoreWebView2HostResourceAccessKind.Allow
            );

            // Handle SPA routing: if requesting an unknown file path without extension, rewrite to index.html
            coreWebView2.AddWebResourceRequestedFilter($"http://{VirtualHostName}/*", CoreWebView2WebResourceContext.All);
            coreWebView2.WebResourceRequested += (sender, args) =>
            {
                var uri = new Uri(args.Request.Uri);
                string localPath = uri.AbsolutePath.TrimStart('/');
                string fullPath = Path.Combine(_wwwRootDir, localPath.Replace('/', Path.DirectorySeparatorChar));

                if (!File.Exists(fullPath) && !Path.HasExtension(localPath))
                {
                    string indexPath = Path.Combine(_wwwRootDir, "index.html");
                    if (File.Exists(indexPath))
                    {
                        var stream = File.OpenRead(indexPath);
                        var response = coreWebView2.Environment.CreateWebResourceResponse(
                            stream,
                            200,
                            "OK",
                            "Content-Type: text/html; charset=utf-8"
                        );
                        args.Response = response;
                    }
                }
            };
        }
    }

    /// <summary>
    /// Starts a background HttpListener on localhost:5054 as a standalone fallback server.
    /// </summary>
    public void StartHttpListener()
    {
        _wwwRootDir = ResolveWwwRootDirectory();
        if (!Directory.Exists(_wwwRootDir)) return;

        try
        {
            _listener = new HttpListener();
            _listener.Prefixes.Add($"http://localhost:{ListenerPort}/");
            _listener.Start();

            _cts = new CancellationTokenSource();
            Task.Run(() => ListenLoopAsync(_cts.Token));
        }
        catch { }
    }

    private async Task ListenLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && _listener != null && _listener.IsListening)
        {
            try
            {
                var context = await _listener.GetContextAsync();
                _ = Task.Run(() => ProcessRequest(context), ct);
            }
            catch
            {
                if (ct.IsCancellationRequested) break;
            }
        }
    }

    private void ProcessRequest(HttpListenerContext context)
    {
        try
        {
            string urlPath = context.Request.Url?.AbsolutePath.TrimStart('/') ?? "";
            string filePath = Path.Combine(_wwwRootDir, urlPath.Replace('/', Path.DirectorySeparatorChar));

            if (string.IsNullOrEmpty(urlPath) || !File.Exists(filePath))
            {
                filePath = Path.Combine(_wwwRootDir, "index.html");
            }

            if (File.Exists(filePath))
            {
                byte[] bytes = File.ReadAllBytes(filePath);
                string contentType = GetMimeType(Path.GetExtension(filePath));

                context.Response.ContentType = contentType;
                context.Response.ContentLength64 = bytes.Length;
                context.Response.StatusCode = 200;
                context.Response.AddHeader("Access-Control-Allow-Origin", "*");
                context.Response.OutputStream.Write(bytes, 0, bytes.Length);
            }
            else
            {
                context.Response.StatusCode = 404;
            }
        }
        catch { }
        finally
        {
            try { context.Response.OutputStream.Close(); } catch { }
        }
    }

    public string ResolveWwwRootDirectory()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;

        string[] candidates = new[]
        {
            Path.Combine(baseDir, "wwwroot"),
            Path.Combine(baseDir, "web-dashboard", "dist"),
            Path.Combine(baseDir, "dist"),
            Path.Combine(baseDir, "..", "..", "..", "..", "web-dashboard", "dist"),
            Path.Combine(baseDir, "..", "..", "..", "..", "web-dashboard", "out")
        };

        foreach (var c in candidates)
        {
            if (Directory.Exists(c) && File.Exists(Path.Combine(c, "index.html")))
            {
                return Path.GetFullPath(c);
            }
        }

        return Path.Combine(baseDir, "wwwroot");
    }

    private static string GetMimeType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".html" or ".htm" => "text/html; charset=utf-8",
            ".js" or ".mjs" => "application/javascript; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".svg" => "image/svg+xml",
            ".ico" => "image/x-icon",
            ".woff2" => "font/woff2",
            ".woff" => "font/woff",
            ".ttf" => "font/ttf",
            _ => "application/octet-stream"
        };
    }

    public void Dispose()
    {
        _cts?.Cancel();
        try { _listener?.Stop(); _listener?.Close(); } catch { }
    }
}


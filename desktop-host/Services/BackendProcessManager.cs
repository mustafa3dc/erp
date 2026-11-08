using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace DesktopHost.Services;

/// <summary>
/// Manages the .NET Core ASP.NET Core Web API background process.
/// Guarantees clean startup, health check polling, and zero-zombie process termination
/// via Windows Win32 Job Objects (JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE).
/// </summary>
public class BackendProcessManager : IDisposable
{
    private static readonly Lazy<BackendProcessManager> _instance = new(() => new BackendProcessManager());
    public static BackendProcessManager Instance => _instance.Value;

    public int BackendPort { get; private set; } = 5055;
    public string BaseUrl => $"http://localhost:{BackendPort}";

    private Process? _backendProcess;
    private IntPtr _jobHandle = IntPtr.Zero;
    private readonly HttpClient _httpClient;

    public BackendProcessManager()
    {
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(3)
        };
        InitializeJobObject();
    }

    /// <summary>
    /// Starts the .NET Core API backend process if not already running.
    /// </summary>
    public async Task<bool> StartBackendAsync(Action<string>? statusCallback = null)
    {
        // 1. Check if an API instance is already healthy on this port
        statusCallback?.Invoke("فحص اتصال الخادم المحلي...");
        if (await IsBackendHealthyAsync())
        {
            statusCallback?.Invoke("الخادم المحلي قيد التشغيل ومستعد.");
            return true;
        }

        // 2. Locate backend executable or dll
        string backendPath = FindBackendExecutablePath();
        if (string.IsNullOrEmpty(backendPath))
        {
            statusCallback?.Invoke("تحذير: لم يتم العثور على ملف الخادم المستقل، جاري المحاولة كوضع مدمج.");
            return false;
        }

        statusCallback?.Invoke("جاري إطلاق محرك الـ API في الخلفية...");

        var startInfo = new ProcessStartInfo
        {
            FileName = backendPath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) ? "dotnet" : backendPath,
            Arguments = backendPath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) 
                ? $"\"{backendPath}\" --urls \"http://localhost:{BackendPort}\"" 
                : $"--urls \"http://localhost:{BackendPort}\"",
            WorkingDirectory = Path.GetDirectoryName(backendPath) ?? AppDomain.CurrentDomain.BaseDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        // Pass ASP.NET Core environment variables
        startInfo.EnvironmentVariables["ASPNETCORE_URLS"] = BaseUrl;
        startInfo.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = "Production";

        try
        {
            _backendProcess = new Process { StartInfo = startInfo };
            _backendProcess.Start();

            // Bind to Windows Job Object so child process dies automatically if host exits
            AssignProcessToJob(_backendProcess);

            // 3. Health Check Polling
            statusCallback?.Invoke("جاري التحقق من جاهزية قواعد البيانات والخدمات...");
            bool isReady = await PollHealthCheckAsync(TimeSpan.FromSeconds(25), statusCallback);
            return isReady;
        }
        catch (Exception ex)
        {
            statusCallback?.Invoke($"فشل تشغيل خادم الـ API: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Polls the /health endpoint until it returns HTTP 200 OK or times out.
    /// </summary>
    public async Task<bool> PollHealthCheckAsync(TimeSpan timeout, Action<string>? statusCallback = null)
    {
        var stopwatch = Stopwatch.StartNew();
        int attempts = 0;

        while (stopwatch.Elapsed < timeout)
        {
            attempts++;
            if (await IsBackendHealthyAsync())
            {
                statusCallback?.Invoke("تم التحقق من جاهزية النظام بنجاح (Healthy).");
                return true;
            }

            statusCallback?.Invoke($"جاري انتظار استجابة المحرك... ({attempts})");
            await Task.Delay(400);
        }

        return false;
    }

    public async Task<bool> IsBackendHealthyAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/health");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private string FindBackendExecutablePath()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;

        string[] possiblePaths = new[]
        {
            Path.Combine(baseDir, "api", "ERP.Warehouse.Api.exe"),
            Path.Combine(baseDir, "ERP.Warehouse.Api.exe"),
            Path.Combine(baseDir, "api", "ERP.Warehouse.Api.dll"),
            Path.Combine(baseDir, "ERP.Warehouse.Api.dll"),
            Path.Combine(baseDir, "..", "..", "..", "..", "backend", "bin", "Release", "net8.0", "ERP.Warehouse.Api.exe"),
            Path.Combine(baseDir, "..", "..", "..", "..", "backend", "bin", "Debug", "net8.0", "ERP.Warehouse.Api.exe"),
            Path.Combine(baseDir, "..", "..", "..", "..", "backend", "bin", "Debug", "net8.0", "ERP.Warehouse.Api.dll")
        };

        foreach (var p in possiblePaths)
        {
            if (File.Exists(p)) return Path.GetFullPath(p);
        }

        return string.Empty;
    }

    #region Win32 Job Object (Zero-Zombie Process Guarantee)

    private void InitializeJobObject()
    {
        try
        {
            _jobHandle = CreateJobObject(IntPtr.Zero, null);
            var info = new JOBOBJECT_BASIC_LIMIT_INFORMATION
            {
                LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            };
            var extendedInfo = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION
            {
                BasicLimitInformation = info
            };

            int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            IntPtr extendedInfoPtr = Marshal.AllocHGlobal(length);
            try
            {
                Marshal.StructureToPtr(extendedInfo, extendedInfoPtr, false);
                SetInformationJobObject(_jobHandle, JobObjectInfoType.ExtendedLimitInformation, extendedInfoPtr, (uint)length);
            }
            finally
            {
                Marshal.FreeHGlobal(extendedInfoPtr);
            }
        }
        catch { }
    }

    private void AssignProcessToJob(Process process)
    {
        if (_jobHandle != IntPtr.Zero && process.Handle != IntPtr.Zero)
        {
            try
            {
                AssignProcessToJobObject(_jobHandle, process.Handle);
            }
            catch { }
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string? lpName);

    [DllImport("kernel32.dll")]
    private static extern bool SetInformationJobObject(IntPtr hJob, JobObjectInfoType infoType, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

    private enum JobObjectInfoType
    {
        ExtendedLimitInformation = 9
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryLimit;
        public UIntPtr PeakJobMemoryLimit;
    }

    #endregion

    public void StopBackend()
    {
        try
        {
            if (_backendProcess != null && !_backendProcess.HasExited)
            {
                _backendProcess.Kill(entireProcessTree: true);
                _backendProcess.Dispose();
                _backendProcess = null;
            }
        }
        catch { }
    }

    public void Dispose()
    {
        StopBackend();
        if (_jobHandle != IntPtr.Zero)
        {
            CloseHandle(_jobHandle);
            _jobHandle = IntPtr.Zero;
        }
        _httpClient.Dispose();
    }
}


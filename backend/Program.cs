using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using ERP.Warehouse.Api.Authorization;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Domain.Constants;
using ERP.Warehouse.Api.Models;
using ERP.Warehouse.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure Dynamic Port for Render & Cloud Environments
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://+:{port}");
}

// Add Controllers and Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "ERP Warehouse & Inventory API", Version = "v1" });
});

// Add HttpContext & Multi-Tenant Provider (STRICTLY Scoped, NEVER Singleton)
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, TenantProvider>();

// Configure PostgreSQL via EF Core with Render DATABASE_URL support
var rawConnectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Port=5432;Database=erp_warehouse;Username=postgres;Password=postgres";

var connectionString = ParsePostgreSqlConnectionString(rawConnectionString);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Configure Redis Cache (Optional fallback)
var redisConnection = Environment.GetEnvironmentVariable("REDIS_URL") 
    ?? builder.Configuration.GetConnectionString("Redis") 
    ?? "localhost:6379";
try
{
    var multiplexer = ConnectionMultiplexer.Connect(redisConnection);
    builder.Services.AddSingleton<IConnectionMultiplexer>(multiplexer);
}
catch
{
    // Redis connection fallback for development/free environments
}

// Register Business Services
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IDiscountEngineService, DiscountEngineService>();
builder.Services.AddScoped<ITenantFeatureService, TenantFeatureService>();

// JWT Authentication Configuration
var jwtSecret = "ZiloxEnterpriseSecretSigningKey2026_SecureKeyForJwtTokenAuth!!";
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = signingKey,
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// Policy-Based Authorization (RBAC)
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Permissions.Dashboard.View", policy =>
        policy.RequireClaim("Permission", Permissions.DashboardView));

    options.AddPolicy("Permissions.Inventory.View", policy =>
        policy.RequireClaim("Permission", Permissions.InventoryView));

    options.AddPolicy("Permissions.Inventory.Manage", policy =>
        policy.RequireClaim("Permission", Permissions.InventoryManage));

    options.AddPolicy("Permissions.Inventory.CostPrice.View", policy =>
        policy.RequireClaim("Permission", Permissions.InventoryCostPriceView));

    options.AddPolicy("Permissions.Transfers.Manage", policy =>
        policy.RequireClaim("Permission", Permissions.TransfersManage));

    options.AddPolicy("Permissions.StockCounts.Manage", policy =>
        policy.RequireClaim("Permission", Permissions.StockCountsManage));

    options.AddPolicy("Permissions.Pos.Terminal.Access", policy =>
        policy.RequireClaim("Permission", Permissions.PosTerminalAccess));

    options.AddPolicy("Permissions.Shifts.Manage", policy =>
        policy.RequireClaim("Permission", Permissions.ShiftsManage));

    options.AddPolicy("Permissions.Invoices.Manage", policy =>
        policy.RequireClaim("Permission", Permissions.InvoicesManage));

    options.AddPolicy("Permissions.Finance.Ledger", policy =>
        policy.RequireClaim("Permission", Permissions.FinanceLedger));

    options.AddPolicy("Permissions.Reports.Executive", policy =>
        policy.RequireClaim("Permission", Permissions.ReportsExecutive));

    options.AddPolicy("Permissions.Settings.Audit", policy =>
        policy.RequireClaim("Permission", Permissions.SettingsAudit));
});

// Enable CORS for Next.js Web Dashboard & Flutter
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

var enableSwagger = app.Environment.IsDevelopment() 
    || string.Equals(Environment.GetEnvironmentVariable("ENABLE_SWAGGER"), "true", StringComparison.OrdinalIgnoreCase);

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "ERP API v1");
        c.RoutePrefix = "swagger";
    });
}

// Enable Static Files for Serving the React/Vite Single Page Application
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Health Check Endpoint for Desktop Host, Load Balancer & Render
app.MapGet("/health", () => Results.Ok(new 
{ 
    status = "Healthy", 
    timestamp = DateTime.UtcNow, 
    service = "ZiloX ERP API",
    version = "2.0.0" 
}));

// Fallback to index.html for React SPA Routes (e.g. /dashboard, /inventory, /pos)
app.MapFallbackToFile("index.html");

// Automatic Database Schema Bootstrap on Startup
using (var scope = app.Services.CreateScope())
{
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        
        logger.LogInformation("Verifying PostgreSQL database schema connectivity...");
        if (dbContext.Database.CanConnect())
        {
            using var conn = dbContext.Database.GetDbConnection();
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouses';";
            var count = Convert.ToInt32(cmd.ExecuteScalar() ?? 0);

            if (count == 0)
            {
                logger.LogInformation("Database tables not found. Executing automatic initialization script...");
                string[] searchPaths = 
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "render_full_init.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "render_full_init.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "render_full_init.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "render_full_init.sql")
                };

                var foundPath = searchPaths.FirstOrDefault(File.Exists);
                if (foundPath != null)
                {
                    var sql = File.ReadAllText(foundPath);
                    dbContext.Database.ExecuteSqlRaw(sql);
                    logger.LogInformation("Database schema initialized successfully from {Path}!", foundPath);
                }
                else
                {
                    logger.LogWarning("render_full_init.sql not found in search paths. Skipping auto-migration.");
                }
            }
            else
            {
                logger.LogInformation("Database schema is already initialized ({Count} tables verified).", count);
            }
        }
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogWarning(ex, "Database schema check or auto-initialization skipped/encountered warning.");
    }
}

app.Run();

// Static Connection String Parser for Cloud URLs (e.g., Render postgres:// or postgresql://)
static string ParsePostgreSqlConnectionString(string connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString)) return connectionString;

    if (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(connectionString);
            var userInfo = uri.UserInfo.Split(':');
            var user = Uri.UnescapeDataString(userInfo[0]);
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var host = uri.Host;
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');
            return $"Host={host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Prefer;Trust Server Certificate=true;";
        }
        catch
        {
            return connectionString;
        }
    }
    return connectionString;
}

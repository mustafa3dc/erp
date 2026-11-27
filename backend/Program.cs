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
builder.Services.AddHttpClient();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IDiscountEngineService, DiscountEngineService>();
builder.Services.AddScoped<ITenantFeatureService, TenantFeatureService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();
builder.Services.AddScoped<IQuotationService, QuotationService>();
builder.Services.AddScoped<IPriceListService, PriceListService>();
builder.Services.AddScoped<IPurchaseReturnService, PurchaseReturnService>();
builder.Services.AddScoped<ISerialTrackingService, SerialTrackingService>();
builder.Services.AddScoped<ISalesReturnService, SalesReturnService>();
builder.Services.AddScoped<ILoyaltyService, LoyaltyService>();
builder.Services.AddScoped<ILoyaltyRewardsService, LoyaltyRewardsService>();
builder.Services.AddScoped<IPartnersService, PartnersService>();
builder.Services.AddScoped<IRecurringExpenseService, RecurringExpenseService>();
builder.Services.AddHostedService<RecurringExpenseBackgroundWorker>();
builder.Services.AddScoped<IInvoiceOcrService, GeminiInvoiceOcrService>();

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
var wwwrootDir = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwrootDir))
{
    wwwrootDir = Path.Combine(AppContext.BaseDirectory, "wwwroot");
}

if (Directory.Exists(wwwrootDir))
{
    var fileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootDir);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

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

// Config Status Endpoint — shows which env vars are loaded (no secrets exposed)
app.MapGet("/api/config/status", async (IConfiguration config, IHttpClientFactory httpFactory, bool? probe) =>
{
    static string DescribeKey(string? k)
    {
        var t = k?.Trim();
        if (string.IsNullOrWhiteSpace(t)) return "NOT SET";
        if (t.Length <= 10) return $"SET (len={t.Length})";
        return $"SET (len={t.Length}, {t[..6]}...{t[^4..]})";
    }

    var envGemini = Environment.GetEnvironmentVariable("GEMINI_API_KEY")?.Trim();
    var envGeminiDouble = Environment.GetEnvironmentVariable("Gemini__ApiKey")?.Trim();
    var cfgGemini = config["Gemini:ApiKey"]?.Trim();
    var geminiKey = !string.IsNullOrWhiteSpace(envGemini) ? envGemini : (cfgGemini ?? envGeminiDouble);

    object? probeResult = null;
    if (probe == true && !string.IsNullOrWhiteSpace(geminiKey))
    {
        try
        {
            var client = httpFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(15);
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={Uri.EscapeDataString(geminiKey)}";
            using var content = new StringContent("{\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"ping\"}]}]}", Encoding.UTF8, "application/json");
            using var resp = await client.PostAsync(url, content);
            var body = await resp.Content.ReadAsStringAsync();
            probeResult = new { status = (int)resp.StatusCode, ok = resp.IsSuccessStatusCode, body = body.Length > 400 ? body[..400] : body };
        }
        catch (Exception ex)
        {
            probeResult = new { error = ex.Message };
        }
    }

    return Results.Ok(new
    {
        gemini_key_configured = !string.IsNullOrWhiteSpace(geminiKey),
        gemini_model = config["Gemini:Model"] ?? "not set",
        env_GEMINI_API_KEY = DescribeKey(envGemini),
        env_Gemini__ApiKey = DescribeKey(envGeminiDouble),
        config_Gemini_ApiKey = DescribeKey(cfgGemini),
        probe = probeResult
    });
}).AllowAnonymous();

// Fallback to index.html for React SPA Routes (e.g. /dashboard, /inventory, /pos)
app.MapFallback(async context =>
{
    var path = context.Request.Path.Value ?? "";
    if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) || 
        path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = 404;
        return;
    }

    var targetWwwroot = Directory.Exists(wwwrootDir) ? wwwrootDir : Path.Combine(AppContext.BaseDirectory, "wwwroot");
    var indexPath = Path.Combine(targetWwwroot, "index.html");

    if (File.Exists(indexPath))
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexPath);
    }
    else
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.WriteAsync("<h1>ZiloX ERP API is Running</h1><p>Frontend assets are being prepared. Access <a href='/swagger'>Swagger API Documentation</a> or <a href='/health'>Health Check</a>.</p>");
    }
});

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
            int count;
            using (var conn = dbContext.Database.GetDbConnection())
            {
                conn.Open();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouses';";
                count = Convert.ToInt32(cmd.ExecuteScalar() ?? 0);
            }

            try
            {
                dbContext.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS warehouse_shelves (
                        id uuid PRIMARY KEY,
                        tenant_id uuid NULL,
                        warehouse_id uuid NOT NULL,
                        name varchar(200) NOT NULL,
                        code varchar(50) NULL,
                        notes text NULL,
                        max_capacity int NULL,
                        is_active boolean NOT NULL DEFAULT true,
                        created_at timestamptz NOT NULL DEFAULT NOW(),
                        updated_at timestamptz NULL
                    );
                    CREATE INDEX IF NOT EXISTS ix_warehouse_shelves_tenant_wh ON warehouse_shelves (tenant_id, warehouse_id);
                    ALTER TABLE IF EXISTS warehouse_stock ADD COLUMN IF NOT EXISTS shelf_id uuid NULL;
                ");
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Warehouse shelves startup DDL check warning.");
            }

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
                // Idempotently ensure incremental columns exist on existing databases
                dbContext.Database.ExecuteSqlRaw(@"
                    ALTER TABLE IF EXISTS warehouses
                        ADD COLUMN IF NOT EXISTS storage_type VARCHAR(30) NOT NULL DEFAULT 'Standard';
                    ALTER TABLE IF EXISTS products
                        ADD COLUMN IF NOT EXISTS requires_serial_number BOOLEAN NOT NULL DEFAULT FALSE,
                        ADD COLUMN IF NOT EXISTS warranty_months INT NOT NULL DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT FALSE;
                    ALTER TABLE IF EXISTS customers
                        ADD COLUMN IF NOT EXISTS tenant_id UUID,
                        ADD COLUMN IF NOT EXISTS price_list_id UUID;
                ");

                try
                {
                    dbContext.Database.ExecuteSqlRaw(@"
                        CREATE TABLE IF NOT EXISTS warehouse_shelves (
                            id UUID PRIMARY KEY,
                            tenant_id UUID NULL,
                            warehouse_id UUID NOT NULL,
                            name VARCHAR(150) NOT NULL,
                            code VARCHAR(50) NULL,
                            notes TEXT NULL,
                            max_capacity INT NULL,
                            is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NULL
                        );
                        ALTER TABLE IF EXISTS warehouse_shelves
                            ADD COLUMN IF NOT EXISTS tenant_id UUID NULL,
                            ADD COLUMN IF NOT EXISTS warehouse_id UUID NULL,
                            ADD COLUMN IF NOT EXISTS name VARCHAR(150) NULL,
                            ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL,
                            ADD COLUMN IF NOT EXISTS notes TEXT NULL,
                            ADD COLUMN IF NOT EXISTS max_capacity INT NULL,
                            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL,
                            ADD COLUMN IF NOT EXISTS created_by VARCHAR(150) NULL;
                        DO $$
                        DECLARE
                            col_name TEXT;
                        BEGIN
                            FOREACH col_name IN ARRAY ARRAY['code', 'notes', 'max_capacity', 'zone', 'aisle', 'rack', 'level', 'bin_code', 'shelf_type', 'status', 'updated_at', 'created_by']
                            LOOP
                                IF EXISTS (
                                    SELECT 1 FROM information_schema.columns
                                    WHERE table_name = 'warehouse_shelves'
                                      AND column_name = col_name
                                      AND is_nullable = 'NO'
                                ) THEN
                                    EXECUTE format('ALTER TABLE warehouse_shelves ALTER COLUMN %I DROP NOT NULL', col_name);
                                END IF;
                            END LOOP;
                        END $$;
                        CREATE INDEX IF NOT EXISTS ix_warehouse_shelves_tenant_wh ON warehouse_shelves (tenant_id, warehouse_id);
                        DROP INDEX IF EXISTS ux_warehouse_shelves_tenant_wh_code;
                        CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_shelves_tenant_wh_code_partial
                            ON warehouse_shelves (tenant_id, warehouse_id, LOWER(code))
                            WHERE code IS NOT NULL AND code <> '' AND is_active = TRUE;
                        ALTER TABLE IF EXISTS warehouse_stock
                            ADD COLUMN IF NOT EXISTS shelf_id UUID NULL;
                    ");
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Warehouse shelves startup DDL reconciliation warning.");
                }

                dbContext.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS recurring_expenses (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tenant_id UUID NULL,
                        title VARCHAR(200) NOT NULL,
                        category VARCHAR(150) NOT NULL,
                        amount NUMERIC(18, 4) NOT NULL,
                        frequency VARCHAR(30) NOT NULL DEFAULT 'Monthly',
                        day_of_month INT NULL,
                        day_of_week INT NULL,
                        interval_days INT NULL,
                        next_due_date TIMESTAMPTZ NOT NULL,
                        last_executed_date TIMESTAMPTZ NULL,
                        execution_mode VARCHAR(30) NOT NULL DEFAULT 'RemindAndConfirm',
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                        notes VARCHAR(1000) NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_recurring_expenses_tenant_due
                        ON recurring_expenses (tenant_id, is_active, is_deleted, next_due_date);
                ");

                // Ensure incremental Profit-Based Customer Loyalty schema upgrades are idempotently applied
                string[] incrementalPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "13_profit_based_customer_loyalty.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "13_profit_based_customer_loyalty.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "13_profit_based_customer_loyalty.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "13_profit_based_customer_loyalty.sql")
                };
                var loyaltySqlPath = incrementalPaths.FirstOrDefault(File.Exists);
                if (loyaltySqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(loyaltySqlPath));
                }

                // Ensure incremental Loyalty Rewards Store & Digital Wallet schema upgrades are idempotently applied
                string[] rewardsSqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "14_loyalty_rewards_store_and_digital_wallet.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "14_loyalty_rewards_store_and_digital_wallet.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "14_loyalty_rewards_store_and_digital_wallet.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "14_loyalty_rewards_store_and_digital_wallet.sql")
                };
                var rewardsSqlPath = rewardsSqlPaths.FirstOrDefault(File.Exists);
                if (rewardsSqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(rewardsSqlPath));
                }

                // Ensure incremental Partners & Profit Sharing schema upgrades are idempotently applied
                string[] partnersSqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "15_partners_and_profit_distribution.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "15_partners_and_profit_distribution.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "15_partners_and_profit_distribution.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "15_partners_and_profit_distribution.sql")
                };
                var partnersSqlPath = partnersSqlPaths.FirstOrDefault(File.Exists);
                if (partnersSqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(partnersSqlPath));
                }

                // Ensure incremental Recurring & Fixed Operating Expenses schema upgrades are idempotently applied
                string[] recurringSqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "16_recurring_operating_expenses.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "16_recurring_operating_expenses.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "16_recurring_operating_expenses.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "16_recurring_operating_expenses.sql")
                };
                var recurringSqlPath = recurringSqlPaths.FirstOrDefault(File.Exists);
                if (recurringSqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(recurringSqlPath));
                }

                // Cleanup pre-populated seeded expense categories and allow optional category assignment on expense vouchers
                string[] cleanupCategoriesSqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "17_remove_seeded_expense_categories.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "17_remove_seeded_expense_categories.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "17_remove_seeded_expense_categories.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "17_remove_seeded_expense_categories.sql")
                };
                var cleanupCategoriesSqlPath = cleanupCategoriesSqlPaths.FirstOrDefault(File.Exists);
                if (cleanupCategoriesSqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(cleanupCategoriesSqlPath));
                }

                // Ensure Treasury Transactions ledger & recurring budget cleanup migration is applied idempotently
                string[] treasuryLedgerSqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "18_recurring_budget_cap_and_treasury_ledger.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "18_recurring_budget_cap_and_treasury_ledger.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "18_recurring_budget_cap_and_treasury_ledger.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "18_recurring_budget_cap_and_treasury_ledger.sql")
                };
                var treasuryLedgerSqlPath = treasuryLedgerSqlPaths.FirstOrDefault(File.Exists);
                if (treasuryLedgerSqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(treasuryLedgerSqlPath));
                }

                // Ensure Serial & Warranty Lifecycle Automation schema upgrades are idempotently applied
                string[] serialLifecycleSqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "19_serial_warranty_lifecycle.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "19_serial_warranty_lifecycle.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "19_serial_warranty_lifecycle.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "19_serial_warranty_lifecycle.sql")
                };
                var serialLifecycleSqlPath = serialLifecycleSqlPaths.FirstOrDefault(File.Exists);
                if (serialLifecycleSqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(serialLifecycleSqlPath));
                }

                // Ensure Purchase Invoice Treasury Deduction & Supplier Settlement schema upgrades are idempotently applied
                string[] purchaseTreasurySqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "20_purchase_treasury_and_supplier_payments.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "20_purchase_treasury_and_supplier_payments.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "20_purchase_treasury_and_supplier_payments.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "20_purchase_treasury_and_supplier_payments.sql")
                };
                var purchaseTreasurySqlPath = purchaseTreasurySqlPaths.FirstOrDefault(File.Exists);
                if (purchaseTreasurySqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(purchaseTreasurySqlPath));
                }

                // Ensure Warehouse Shelves schema is applied idempotently (migration 22)
                string[] warehouseShelvesScriptPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "22_warehouse_shelves.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "22_warehouse_shelves.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "22_warehouse_shelves.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "22_warehouse_shelves.sql")
                };
                var warehouseShelvesScriptPath = warehouseShelvesScriptPaths.FirstOrDefault(File.Exists);
                if (warehouseShelvesScriptPath != null)
                {
                    try { dbContext.Database.ExecuteSqlRaw(File.ReadAllText(warehouseShelvesScriptPath)); }
                    catch (Exception ex) { logger.LogWarning(ex, "Warehouse shelves migration script warning."); }
                }

                // Ensure Treasury Vouchers & Flexible CashBox AccountType schema upgrades are idempotently applied
                string[] treasuryAccountsSqlPaths =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "21_treasury_vouchers_and_accounts.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "21_treasury_vouchers_and_accounts.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "21_treasury_vouchers_and_accounts.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "21_treasury_vouchers_and_accounts.sql")
                };
                var treasuryAccountsSqlPath = treasuryAccountsSqlPaths.FirstOrDefault(File.Exists);
                if (treasuryAccountsSqlPath != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(treasuryAccountsSqlPath));
                }
            }

            // Always ensure warehouse_shelves table exists (runs regardless of DB init state)
            try
            {
                string[] wsScriptPaths2 =
                {
                    Path.Combine(AppContext.BaseDirectory, "database", "scripts", "22_warehouse_shelves.sql"),
                    Path.Combine(AppContext.BaseDirectory, "..", "database", "scripts", "22_warehouse_shelves.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "database", "scripts", "22_warehouse_shelves.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "database", "scripts", "22_warehouse_shelves.sql")
                };
                var wsScriptPath2 = wsScriptPaths2.FirstOrDefault(File.Exists);
                if (wsScriptPath2 != null)
                {
                    dbContext.Database.ExecuteSqlRaw(File.ReadAllText(wsScriptPath2));
                }
                else
                {
                    // Fallback: inline SQL if script file not found (e.g. on Render.com after publish)
                    dbContext.Database.ExecuteSqlRaw(@"
                        -- Fix warehouse_stock: add product_id, tenant_id, shelf_id columns
                        ALTER TABLE IF EXISTS warehouse_stock
                            ADD COLUMN IF NOT EXISTS product_id      UUID          NULL,
                            ADD COLUMN IF NOT EXISTS tenant_id       UUID          NULL,
                            ADD COLUMN IF NOT EXISTS shelf_id        UUID          NULL,
                            ADD COLUMN IF NOT EXISTS shelf_location  VARCHAR(100)  NULL,
                            ADD COLUMN IF NOT EXISTS last_counted_at TIMESTAMPTZ   NULL;

                        -- Backfill product_id from item_id
                        UPDATE warehouse_stock SET product_id = item_id
                            WHERE product_id IS NULL AND item_id IS NOT NULL;

                        -- Create warehouse_shelves table
                        CREATE TABLE IF NOT EXISTS warehouse_shelves (
                            id UUID PRIMARY KEY,
                            tenant_id UUID NULL,
                            warehouse_id UUID NOT NULL,
                            name VARCHAR(150) NOT NULL,
                            code VARCHAR(50) NULL,
                            notes TEXT NULL,
                            max_capacity INT NULL,
                            is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NULL,
                            created_by VARCHAR(150) NULL
                        );

                        CREATE INDEX IF NOT EXISTS ix_warehouse_shelves_tenant_wh
                            ON warehouse_shelves (tenant_id, warehouse_id);
                    ");
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Warehouse shelves always-run DDL warning (non-fatal).");
            }

            // Backfill missing LOY- member codes, card tokens, and normalized phones for existing registered customers
            var loyaltyRewardsService = scope.ServiceProvider.GetRequiredService<ILoyaltyRewardsService>();
            loyaltyRewardsService.BackfillCustomerLoyaltyIdentifiersAsync().GetAwaiter().GetResult();
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

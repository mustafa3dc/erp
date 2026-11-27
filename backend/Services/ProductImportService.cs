using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using ERP.Warehouse.Api.Data;
using ERP.Warehouse.Api.Models;

namespace ERP.Warehouse.Api.Services;

public sealed record BulkProductImportRowDto(
    int RowNumber,
    string Name,
    string Sku,
    string? Barcode,
    string? Category,
    decimal CostPrice,
    decimal SalePrice,
    decimal MinSalePrice,
    decimal OpeningQuantity,
    string? WarehouseCode,
    string? ShelfCode,
    bool IsValid,
    string? ErrorCode,
    string? ErrorField
);

public sealed record BulkProductImportResultDto(
    bool DryRun,
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int ImportedProductsCount,
    int OpeningStockMovementsCount,
    List<BulkProductImportRowDto> Rows
);

public interface IProductImportService
{
    byte[] GenerateTemplateXlsx();
    byte[] GenerateTemplateCsv();
    Task<ApiResponse<BulkProductImportResultDto>> ImportAsync(
        IFormFile? file,
        bool dryRun,
        string actor,
        CancellationToken ct = default);
}

public class ProductImportService : IProductImportService
{
    private static readonly string[] TemplateHeaders =
    {
        "Name",
        "SKU",
        "Barcode",
        "Category",
        "CostPrice",
        "SalePrice",
        "MinSalePrice",
        "OpeningQuantity",
        "WarehouseCode",
        "ShelfCode"
    };

    private readonly AppDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<ProductImportService> _logger;

    public ProductImportService(
        AppDbContext context,
        ITenantProvider tenantProvider,
        IAuditLogService auditLogService,
        ILogger<ProductImportService> logger)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public byte[] GenerateTemplateCsv()
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", TemplateHeaders));
        var preamble = Encoding.UTF8.GetPreamble();
        var body = Encoding.UTF8.GetBytes(sb.ToString());
        var result = new byte[preamble.Length + body.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(body, 0, result, preamble.Length, body.Length);
        return result;
    }

    public byte[] GenerateTemplateXlsx()
    {
        using var ms = new MemoryStream();
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            WriteZipEntry(archive, "[Content_Types].xml",
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>
                """);

            WriteZipEntry(archive, "_rels/.rels",
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """);

            WriteZipEntry(archive, "xl/workbook.xml",
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="ProductsImport" sheetId="1" r:id="rId1"/>
                  </sheets>
                </workbook>
                """);

            WriteZipEntry(archive, "xl/_rels/workbook.xml.rels",
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """);

            WriteZipEntry(archive, "xl/styles.xml",
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="2">
                    <font><sz val="11"/><name val="Calibri"/></font>
                    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
                  </fonts>
                  <fills count="3">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
                  </fills>
                  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="2">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
                  </cellXfs>
                </styleSheet>
                """);

            var cellsXml = new StringBuilder();
            for (int i = 0; i < TemplateHeaders.Length; i++)
            {
                var colRef = ColumnIndexToLetter(i) + "1";
                var escaped = System.Security.SecurityElement.Escape(TemplateHeaders[i]);
                cellsXml.Append($"<c r=\"{colRef}\" t=\"inlineStr\" s=\"1\"><is><t>{escaped}</t></is></c>");
            }

            WriteZipEntry(archive, "xl/worksheets/sheet1.xml",
                $"""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <cols>
                    <col min="1" max="1" width="28" customWidth="1"/>
                    <col min="2" max="4" width="18" customWidth="1"/>
                    <col min="5" max="10" width="16" customWidth="1"/>
                  </cols>
                  <sheetData>
                    <row r="1">{cellsXml}</row>
                  </sheetData>
                </worksheet>
                """);
        }

        return ms.ToArray();
    }

    public async Task<ApiResponse<BulkProductImportResultDto>> ImportAsync(
        IFormFile? file,
        bool dryRun,
        string actor,
        CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
        {
            return ApiResponse<BulkProductImportResultDto>.Fail("ERR_IMPORT_EMPTY_FILE", "INVENTORY");
        }

        var ext = Path.GetExtension(file.FileName ?? string.Empty).ToLowerInvariant();
        if (ext != ".csv" && ext != ".xlsx")
        {
            return ApiResponse<BulkProductImportResultDto>.Fail("ERR_IMPORT_INVALID_FORMAT", "INVENTORY");
        }

        List<string[]> rawRows;
        try
        {
            await using var stream = file.OpenReadStream();
            rawRows = ext == ".csv"
                ? await ParseCsvRowsAsync(stream, ct)
                : ParseXlsxRows(stream);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse uploaded import file {FileName}", file.FileName);
            return ApiResponse<BulkProductImportResultDto>.Fail("ERR_IMPORT_INVALID_FORMAT", "INVENTORY");
        }

        if (rawRows.Count <= 1)
        {
            return ApiResponse<BulkProductImportResultDto>.Fail("ERR_IMPORT_EMPTY_FILE", "INVENTORY");
        }

        var headerMap = BuildHeaderIndexMap(rawRows[0]);
        if (!headerMap.ContainsKey("name") || !headerMap.ContainsKey("sku") || !headerMap.ContainsKey("saleprice"))
        {
            return ApiResponse<BulkProductImportResultDto>.Fail("ERR_IMPORT_INVALID_FORMAT", "INVENTORY");
        }

        var tenantId = _tenantProvider.CurrentTenantId ?? _context.CurrentTenantId;

        var existingSkus = new HashSet<string>(
            await _context.Products
                .AsNoTracking()
                .Where(p => !tenantId.HasValue || p.TenantId == tenantId.Value)
                .Select(p => p.Sku)
                .ToListAsync(ct),
            StringComparer.OrdinalIgnoreCase);

        var warehouses = await _context.Warehouses
            .AsNoTracking()
            .Where(w => w.IsActive && (!tenantId.HasValue || w.TenantId == tenantId.Value))
            .OrderBy(w => w.CreatedAt)
            .ToListAsync(ct);

        var shelves = await _context.WarehouseShelves
            .AsNoTracking()
            .Where(s => s.IsActive && (!tenantId.HasValue || s.TenantId == tenantId.Value))
            .ToListAsync(ct);

        var categories = await _context.Categories
            .Where(c => !tenantId.HasValue || c.TenantId == tenantId.Value)
            .ToListAsync(ct);

        var seenFileSkus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var evaluatedRows = new List<BulkProductImportRowDto>();
        var pendingCreations = new List<(
            BulkProductImportRowDto Row,
            ERP.Warehouse.Api.Models.Warehouse? TargetWarehouse,
            WarehouseShelf? TargetShelf)>();

        for (int i = 1; i < rawRows.Count; i++)
        {
            var cells = rawRows[i];
            if (cells.All(string.IsNullOrWhiteSpace))
            {
                continue;
            }

            var rowNumber = i + 1;
            var name = GetCell(cells, headerMap, "name").Trim();
            var sku = GetCell(cells, headerMap, "sku").Trim();
            var barcode = NullIfEmpty(GetCell(cells, headerMap, "barcode"));
            var categoryName = NullIfEmpty(GetCell(cells, headerMap, "category"));
            var costRaw = GetCell(cells, headerMap, "costprice").Trim();
            var saleRaw = GetCell(cells, headerMap, "saleprice").Trim();
            var minSaleRaw = GetCell(cells, headerMap, "minsaleprice").Trim();
            var qtyRaw = GetCell(cells, headerMap, "openingquantity").Trim();
            var warehouseCode = NullIfEmpty(GetCell(cells, headerMap, "warehousecode"));
            var shelfCode = NullIfEmpty(GetCell(cells, headerMap, "shelfcode"));

            decimal costPrice = 0m;
            decimal salePrice = 0m;
            decimal minSalePrice = 0m;
            decimal openingQty = 0m;
            string? errorCode = null;
            string? errorField = null;

            if (string.IsNullOrWhiteSpace(name))
            {
                errorCode = "ERR_IMPORT_MISSING_NAME";
                errorField = "Name";
            }
            else if (string.IsNullOrWhiteSpace(sku))
            {
                errorCode = "ERR_IMPORT_MISSING_SKU";
                errorField = "SKU";
            }
            else if (existingSkus.Contains(sku) || !seenFileSkus.Add(sku))
            {
                errorCode = "ERR_IMPORT_DUPLICATE_SKU";
                errorField = "SKU";
            }

            if (errorCode == null)
            {
                if (!TryParseDecimal(costRaw, defaultIfEmpty: 0m, out costPrice) || costPrice < 0m)
                {
                    errorCode = "ERR_IMPORT_INVALID_PRICE";
                    errorField = "CostPrice";
                }
                else if (!TryParseDecimal(saleRaw, defaultIfEmpty: -1m, out salePrice) || salePrice <= 0m)
                {
                    errorCode = "ERR_IMPORT_INVALID_PRICE";
                    errorField = "SalePrice";
                }
                else if (!TryParseDecimal(minSaleRaw, defaultIfEmpty: 0m, out minSalePrice) || minSalePrice < 0m || minSalePrice > salePrice)
                {
                    errorCode = "ERR_IMPORT_INVALID_PRICE";
                    errorField = "MinSalePrice";
                }
            }

            if (errorCode == null)
            {
                if (!TryParseDecimal(qtyRaw, defaultIfEmpty: 0m, out openingQty) || openingQty < 0m || openingQty != Math.Truncate(openingQty))
                {
                    errorCode = "ERR_IMPORT_INVALID_QUANTITY";
                    errorField = "OpeningQuantity";
                }
            }

            ERP.Warehouse.Api.Models.Warehouse? matchedWarehouse = null;
            WarehouseShelf? matchedShelf = null;

            if (errorCode == null)
            {
                if (!string.IsNullOrWhiteSpace(warehouseCode))
                {
                    matchedWarehouse = warehouses.FirstOrDefault(w =>
                        string.Equals(w.Code, warehouseCode, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(w.Name, warehouseCode, StringComparison.OrdinalIgnoreCase));
                    if (matchedWarehouse == null)
                    {
                        errorCode = "ERR_IMPORT_WAREHOUSE_NOT_FOUND";
                        errorField = "WarehouseCode";
                    }
                }
                else if (openingQty > 0m)
                {
                    matchedWarehouse = warehouses.FirstOrDefault();
                    if (matchedWarehouse == null)
                    {
                        errorCode = "ERR_IMPORT_WAREHOUSE_NOT_FOUND";
                        errorField = "WarehouseCode";
                    }
                }

                if (errorCode == null && matchedWarehouse != null && !string.IsNullOrWhiteSpace(shelfCode))
                {
                    matchedShelf = shelves.FirstOrDefault(s =>
                        s.WarehouseId == matchedWarehouse.Id &&
                        (string.Equals(s.Code, shelfCode, StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(s.Name, shelfCode, StringComparison.OrdinalIgnoreCase)));
                }
            }

            costPrice = Math.Round(costPrice, 4, MidpointRounding.AwayFromZero);
            salePrice = Math.Round(salePrice, 4, MidpointRounding.AwayFromZero);
            minSalePrice = Math.Round(minSalePrice, 4, MidpointRounding.AwayFromZero);
            openingQty = Math.Round(openingQty, 4, MidpointRounding.AwayFromZero);

            var rowDto = new BulkProductImportRowDto(
                RowNumber: rowNumber,
                Name: name,
                Sku: sku,
                Barcode: barcode,
                Category: categoryName,
                CostPrice: costPrice,
                SalePrice: salePrice,
                MinSalePrice: minSalePrice,
                OpeningQuantity: openingQty,
                WarehouseCode: matchedWarehouse?.Code ?? warehouseCode,
                ShelfCode: matchedShelf?.Code ?? shelfCode,
                IsValid: errorCode == null,
                ErrorCode: errorCode,
                ErrorField: errorField
            );

            evaluatedRows.Add(rowDto);
            if (errorCode == null)
            {
                pendingCreations.Add((rowDto, matchedWarehouse, matchedShelf));
            }
        }

        if (evaluatedRows.Count == 0)
        {
            return ApiResponse<BulkProductImportResultDto>.Fail("ERR_IMPORT_EMPTY_FILE", "INVENTORY");
        }

        var validCount = evaluatedRows.Count(r => r.IsValid);
        var invalidCount = evaluatedRows.Count - validCount;

        if (dryRun)
        {
            var previewResult = new BulkProductImportResultDto(
                DryRun: true,
                TotalRows: evaluatedRows.Count,
                ValidRows: validCount,
                InvalidRows: invalidCount,
                ImportedProductsCount: 0,
                OpeningStockMovementsCount: 0,
                Rows: evaluatedRows);
            return ApiResponse<BulkProductImportResultDto>.Ok(previewResult);
        }

        if (invalidCount > 0)
        {
            return ApiResponse<BulkProductImportResultDto>.Fail(
                "ERR_IMPORT_VALIDATION_FAILED",
                "INVENTORY",
                new Dictionary<string, object>
                {
                    ["totalRows"] = evaluatedRows.Count,
                    ["validRows"] = validCount,
                    ["invalidRows"] = invalidCount,
                    ["rows"] = evaluatedRows.Where(r => !r.IsValid).ToList()
                });
        }

        var now = DateTime.UtcNow;
        int movementsCreated = 0;

        await using var transaction = await _context.Database.BeginTransactionAsync(ct);
        try
        {
            var categoryCache = categories
                .GroupBy(c => c.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            foreach (var item in pendingCreations)
            {
                var r = item.Row;
                Guid? categoryId = null;

                if (!string.IsNullOrWhiteSpace(r.Category))
                {
                    if (!categoryCache.TryGetValue(r.Category, out var cat))
                    {
                        cat = new Category
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            Name = r.Category.Length > 150 ? r.Category[..150] : r.Category,
                            Code = $"CAT-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
                            CreatedAt = now,
                            UpdatedAt = now
                        };
                        _context.Categories.Add(cat);
                        categoryCache[r.Category] = cat;
                    }
                    categoryId = cat.Id;
                }

                var product = new Product
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = r.Name.Length > 255 ? r.Name[..255] : r.Name,
                    Sku = r.Sku.Length > 100 ? r.Sku[..100] : r.Sku,
                    Barcode = r.Barcode,
                    CategoryId = categoryId,
                    CostPrice = r.CostPrice,
                    SellingPrice = r.SalePrice,
                    MinSellingPrice = r.MinSalePrice,
                    UnitOfMeasure = "قطعة (Piece)",
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                _context.Products.Add(product);

                if (r.OpeningQuantity > 0m && item.TargetWarehouse != null)
                {
                    var qtyInt = (int)r.OpeningQuantity;
                    _context.WarehouseStocks.Add(new WarehouseStock
                    {
                        TenantId = tenantId,
                        WarehouseId = item.TargetWarehouse.Id,
                        ProductId = product.Id,
                        Quantity = qtyInt,
                        ReservedQuantity = 0,
                        ShelfId = item.TargetShelf?.Id,
                        ShelfLocation = item.TargetShelf?.Code ?? item.TargetShelf?.Name ?? r.ShelfCode,
                        LastCountedAt = now
                    });

                    var movementNumber = $"MOV-IMP-{now:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
                    _context.StockMovements.Add(new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        MovementNumber = movementNumber,
                        MovementType = "Inbound",
                        FromWarehouseId = null,
                        ToWarehouseId = item.TargetWarehouse.Id,
                        ReferenceNumber = r.Sku,
                        ReferenceType = "BULK_EXCEL_IMPORT",
                        Notes = $"Opening stock bulk import ({r.Name})",
                        CreatedBy = actor,
                        MovementDate = now,
                        Items = new List<StockMovementItem>
                        {
                            new StockMovementItem
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                ProductId = product.Id,
                                Quantity = qtyInt,
                                UnitCost = r.CostPrice
                            }
                        }
                    });

                    _context.InventoryTransactions.Add(new InventoryTransaction
                    {
                        TransactionId = Guid.NewGuid(),
                        TenantId = tenantId,
                        ProductId = product.Id,
                        WarehouseId = item.TargetWarehouse.Id,
                        QuantityChange = qtyInt,
                        TransactionType = "OPENING_STOCK",
                        Reason = "Bulk Excel Import",
                        ReferenceUserId = actor,
                        Notes = r.ShelfCode,
                        CreatedAt = now
                    });

                    movementsCreated++;
                }
            }

            _auditLogService.QueueLog(
                action: "BULK_PRODUCT_IMPORT",
                entityName: "products",
                entityId: file.FileName ?? "import",
                oldValues: null,
                newValues: new
                {
                    FileName = file.FileName,
                    ImportedProductsCount = pendingCreations.Count,
                    OpeningStockMovementsCount = movementsCreated
                },
                tenantIdOverride: tenantId,
                usernameOverride: actor);

            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            var result = new BulkProductImportResultDto(
                DryRun: false,
                TotalRows: evaluatedRows.Count,
                ValidRows: validCount,
                InvalidRows: 0,
                ImportedProductsCount: pendingCreations.Count,
                OpeningStockMovementsCount: movementsCreated,
                Rows: evaluatedRows);

            return ApiResponse<BulkProductImportResultDto>.Ok(result);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Bulk product import failed during database transaction");
            return ApiResponse<BulkProductImportResultDto>.Fail("ERR_IMPORT_TRANSACTION_FAILED", "INVENTORY");
        }
    }

    private static void WriteZipEntry(ZipArchive archive, string entryName, string content)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content.TrimStart());
    }

    private static string ColumnIndexToLetter(int index)
    {
        var sb = new StringBuilder();
        var n = index;
        while (n >= 0)
        {
            sb.Insert(0, (char)('A' + (n % 26)));
            n = (n / 26) - 1;
        }
        return sb.ToString();
    }

    private static int ColumnLettersToIndex(string cellRef)
    {
        int col = 0;
        foreach (char ch in cellRef)
        {
            if (char.IsLetter(ch))
            {
                col = col * 26 + (char.ToUpperInvariant(ch) - 'A' + 1);
            }
            else
            {
                break;
            }
        }
        return Math.Max(0, col - 1);
    }

    private static async Task<List<string[]>> ParseCsvRowsAsync(Stream stream, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var content = await reader.ReadToEndAsync(ct);
        var rows = new List<string[]>();
        var currentRow = new List<string>();
        var currentField = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < content.Length; i++)
        {
            char c = content[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < content.Length && content[i + 1] == '"')
                    {
                        currentField.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    currentField.Append(c);
                }
            }
            else
            {
                if (c == '"')
                {
                    inQuotes = true;
                }
                else if (c == ',')
                {
                    currentRow.Add(currentField.ToString());
                    currentField.Clear();
                }
                else if (c == '\r')
                {
                    if (i + 1 < content.Length && content[i + 1] == '\n') i++;
                    currentRow.Add(currentField.ToString());
                    currentField.Clear();
                    rows.Add(currentRow.ToArray());
                    currentRow.Clear();
                }
                else if (c == '\n')
                {
                    currentRow.Add(currentField.ToString());
                    currentField.Clear();
                    rows.Add(currentRow.ToArray());
                    currentRow.Clear();
                }
                else
                {
                    currentField.Append(c);
                }
            }
        }

        if (currentField.Length > 0 || currentRow.Count > 0)
        {
            currentRow.Add(currentField.ToString());
            rows.Add(currentRow.ToArray());
        }

        return rows;
    }

    private static List<string[]> ParseXlsxRows(Stream stream)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);

        var sharedStrings = new List<string>();
        var sstEntry = archive.GetEntry("xl/sharedStrings.xml");
        if (sstEntry != null)
        {
            using var sstStream = sstEntry.Open();
            var sstDoc = XDocument.Load(sstStream);
            XNamespace ns = sstDoc.Root?.GetDefaultNamespace() ?? XNamespace.None;
            foreach (var si in sstDoc.Descendants(ns + "si"))
            {
                var text = string.Concat(si.Descendants(ns + "t").Select(t => t.Value));
                sharedStrings.Add(text);
            }
        }

        var sheetEntry = archive.GetEntry("xl/worksheets/sheet1.xml")
            ?? archive.Entries.FirstOrDefault(e =>
                e.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase) &&
                e.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase));

        if (sheetEntry == null)
        {
            throw new InvalidDataException("Worksheet not found in XLSX archive.");
        }

        using var sheetStream = sheetEntry.Open();
        var sheetDoc = XDocument.Load(sheetStream);
        XNamespace sNs = sheetDoc.Root?.GetDefaultNamespace() ?? XNamespace.None;

        var rows = new List<string[]>();
        foreach (var rowEl in sheetDoc.Descendants(sNs + "row"))
        {
            var dict = new Dictionary<int, string>();
            int maxCol = -1;
            int fallbackCol = 0;

            foreach (var cellEl in rowEl.Elements(sNs + "c"))
            {
                var cellRef = cellEl.Attribute("r")?.Value;
                int colIdx = !string.IsNullOrWhiteSpace(cellRef) ? ColumnLettersToIndex(cellRef) : fallbackCol;
                fallbackCol = colIdx + 1;
                if (colIdx > maxCol) maxCol = colIdx;

                var typeAttr = cellEl.Attribute("t")?.Value;
                string value = string.Empty;

                if (typeAttr == "s")
                {
                    var vText = cellEl.Element(sNs + "v")?.Value;
                    if (int.TryParse(vText, out int sstIdx) && sstIdx >= 0 && sstIdx < sharedStrings.Count)
                    {
                        value = sharedStrings[sstIdx];
                    }
                }
                else if (typeAttr == "inlineStr")
                {
                    value = string.Concat(cellEl.Descendants(sNs + "t").Select(t => t.Value));
                }
                else
                {
                    value = cellEl.Element(sNs + "v")?.Value ?? string.Empty;
                }

                dict[colIdx] = value;
            }

            if (maxCol >= 0)
            {
                var rowArr = new string[maxCol + 1];
                for (int c = 0; c <= maxCol; c++)
                {
                    rowArr[c] = dict.TryGetValue(c, out var val) ? val : string.Empty;
                }
                rows.Add(rowArr);
            }
        }

        return rows;
    }

    private static Dictionary<string, int> BuildHeaderIndexMap(string[] headerRow)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headerRow.Length; i++)
        {
            var clean = (headerRow[i] ?? string.Empty).Trim().Replace(" ", "").Replace("_", "").ToLowerInvariant();
            if (!string.IsNullOrEmpty(clean) && !map.ContainsKey(clean))
            {
                map[clean] = i;
            }
        }
        return map;
    }

    private static string GetCell(string[] row, Dictionary<string, int> map, string key)
    {
        if (map.TryGetValue(key, out int idx) && idx >= 0 && idx < row.Length)
        {
            return row[idx] ?? string.Empty;
        }
        return string.Empty;
    }

    private static string? NullIfEmpty(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static bool TryParseDecimal(string raw, decimal defaultIfEmpty, out decimal value)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            value = defaultIfEmpty;
            return defaultIfEmpty >= 0m;
        }

        return decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out value)
            || decimal.TryParse(raw, NumberStyles.Number, CultureInfo.CurrentCulture, out value);
    }
}

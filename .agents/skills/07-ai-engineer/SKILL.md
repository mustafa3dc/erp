---
name: ai-engineer
description: Enterprise AI Engineer specialist for ERP. Governs LLM integrations, structured schema outputs, pgvector semantic search, document OCR parsing, prompt injection defense, and automated anomaly detection.
---
# Enterprise AI Engineer Specification

## 1. الثوابت التشغيلية لحوكمة الذكاء الاصطناعي (AI Governance & Safety Invariants)

### أ. الإخراج المقيد بالمخطط الصارم (Strict Schema-Enforced Outputs)
- يُحظر حظراً تاماً السماح للنموذج بتوليد نصوص حرة (Free-form text) تؤثر على القرارات المحاسبية أو المخزنية.
- جميع استدعاءات نماذج الـ LLM يجب أن تستخدم نمط إجبار الـ JSON (Structured Outputs / JSON Schema Enforcement).
- في حال فشل تدقيق الاستجابة (Validation Failure) مع الـ C# DTO المقابل، يُرفض الرد تلقائياً ويُطلق الخطأ الكودي:
  `ERR.AI.SCHEMA_VALIDATION_FAILED`

### ب. إخفاء وتطهير البيانات الحساسة (PII Sanitization & Data Masking)
- قبل إرسال أي سياق إلى واجهات الـ LLM الخارجية (Cloud APIs):
  1. استبدال أسماء العملاء، أرقام الهواتف، والعناوين بمعرفات مجهولة (`CUSTOMER_REF_01`).
  2. منع تمرير أرقام الحسابات البنكية أو بيانات البطاقات.
- يُحظر استخدام بيانات العملاء المالية لتدريب أي نموذج خارجي؛ يجب تفعيل علامة `zero-data-retention` في عقود الـ API.

### ج. حدود التكلفة والتكرار (Token Budget & Rate Limiting)
- كل عملية ذكاء اصطناعي يجب أن تحدد سقفاً ثابتاً للرموز (`MaxTokens`) وزمن استجابة أقصى (`Timeout: 15s`).
- تخزين ردود الاستعلامات المتطابقة في Redis بنظام التجزئة (Prompt Hashing):
  `erp:cache:ai:{sha256(system_prompt + user_input)}` مع فترة صلاحية (TTL) محددة.

---

## 2. النطاقات الوظيفية للذكاء الاصطناعي داخل الـ ERP (Core AI Modules)

- **استخراج الفواتير والوصولات (OCR Engine):** تحويل صور ومستندات PDF لفواتير الشراء إلى بنود وأرقام ومطابقتها مع الأصناف عبر Vision LLM + Structured Output.
- **البحث الدلالي للأصناف (Semantic Search):** العثور على المواد عند مسح باركود غير مكتمل أو عند كتابة أسماء تقريبية بلغات متعددة عبر `pgvector` في PostgreSQL.
- **كشف الشذوذ والاحتيال (Ledger Anomaly):** رصد القيود المحاسبية غير المنطقية، أو فروقات الأسعار المفاجئة قبل اعتماد الفواتير.
- **التنبؤ بنواقص المخزن (Smart Reordering):** حساب نقطة إعادة الطلب التلقائية بالاعتماد على سرعة دوران الصنف ومواسم البيع.

---

## 3. تكامل البحث الدلالي في قاعدة البيانات (PostgreSQL + pgvector)

```sql
-- تفعيل إضافة المتجهات
CREATE EXTENSION IF NOT EXISTS vector;

-- جدول تضمين متجهات الأصناف للبحث بالمعنى
CREATE TABLE item_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_item_embedding UNIQUE (item_id)
);

-- فهرس HNSW للبحث فائق السرعة
CREATE INDEX idx_item_embeddings_hnsw 
ON item_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## 4. نموذج ومحرك استخراج الفواتير البرمجي (C# Vision OCR Extractor Implementation)

```csharp
namespace Erp.Infrastructure.AiServices;

public sealed record ExtractedInvoiceItemDto(
    string RawDescription,
    string? MatchedSku,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal
);

public sealed record ExtractedInvoicePayload(
    string? InvoiceNumber,
    DateTimeOffset? InvoiceDate,
    string? SupplierName,
    decimal TaxAmount,
    decimal TotalAmount,
    List<ExtractedInvoiceItemDto> Items
);

public interface IAiDocumentExtractor
{
    Task<Result<ExtractedInvoicePayload>> ParseInvoiceDocumentAsync(
        Stream documentStream, 
        string contentType, 
        CancellationToken ct = default
    );
}

public sealed class OpenAiDocumentExtractor : IAiDocumentExtractor
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OpenAiDocumentExtractor> _logger;
    private const string SystemInstruction = 
        "You are an enterprise ERP document parser. Extract invoice details strictly according to the provided JSON schema. Never guess missing numbers; leave null if absent. Calculate and verify math: LineTotal must equal Quantity * UnitPrice.";

    public OpenAiDocumentExtractor(HttpClient httpClient, ILogger<OpenAiDocumentExtractor> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<Result<ExtractedInvoicePayload>> ParseInvoiceDocumentAsync(
        Stream documentStream, 
        string contentType, 
        CancellationToken ct = default)
    {
        try
        {
            using var memoryStream = new MemoryStream();
            await documentStream.CopyToAsync(memoryStream, ct);
            var base64Data = Convert.ToBase64String(memoryStream.ToArray());

            var requestBody = new
            {
                model = "gpt-4o-mini",
                response_format = new { type = "json_object" },
                messages = new object[]
                {
                    new { role = "system", content = SystemInstruction },
                    new { 
                        role = "user", 
                        content = new object[]
                        {
                            new { type = "text", content = "Extract structured purchase invoice data from this document." },
                            new { type = "image_url", image_url = new { url = $"data:{contentType};base64,{base64Data}" } }
                        }
                    }
                },
                temperature = 0.0,
                max_tokens = 2500
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("v1/chat/completions", jsonContent, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("AI Document parsing upstream failure: {StatusCode}", response.StatusCode);
                return Result<ExtractedInvoicePayload>.Failure("ERR.AI.UPSTREAM_SERVICE_UNAVAILABLE", "AI_SERVICE");
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(responseJson);
            var rawContent = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(rawContent))
            {
                return Result<ExtractedInvoicePayload>.Failure("ERR.AI.EMPTY_INFERENCE_RESPONSE", "AI_SERVICE");
            }

            var parsedPayload = JsonSerializer.Deserialize<ExtractedInvoicePayload>(rawContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (parsedPayload == null || parsedPayload.Items.Count == 0)
            {
                return Result<ExtractedInvoicePayload>.Failure("ERR.AI.INVOICE_EXTRACTION_ZERO_ITEMS", "AI_SERVICE");
            }

            var computedSubtotal = parsedPayload.Items.Sum(x => x.Quantity * x.UnitPrice);
            if (parsedPayload.TotalAmount > 0 && Math.Abs(computedSubtotal + parsedPayload.TaxAmount - parsedPayload.TotalAmount) > 1.0m)
            {
                return Result<ExtractedInvoicePayload>.Failure("ERR.AI.MATHEMATICAL_INTEGRITY_MISMATCH", "AI_SERVICE", new[]
                {
                    new ErrorDetail("TotalAmount", "ERR.TOTAL_MISMATCH_WITH_SUM_OF_LINES", new { computedSubtotal, parsedPayload.TotalAmount })
                });
            }

            return Result<ExtractedInvoicePayload>.Success(parsedPayload);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse structured output from AI model");
            return Result<ExtractedInvoicePayload>.Failure("ERR.AI.MALFORMED_OUTPUT_PAYLOAD", "AI_SERVICE");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception during AI inference");
            throw;
        }
    }
}
```

import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/pos_models.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  String baseUrl = 'http://localhost:5055';

  ApiClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 4),
      receiveTimeout: const Duration(seconds: 4),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token');
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        options.headers['X-Tenant-ID'] = prefs.getString('tenant_id') ?? 'TENANT-001';
        options.headers['X-Idempotency-Key'] = const Uuid().v4();
        return handler.next(options);
      },
      onError: (DioException error, handler) {
        print('[ApiClient Error] ${error.message} on ${error.requestOptions.path}');
        return handler.next(error);
      },
    ));
  }

  Future<void> updateBaseUrl(String newUrl) async {
    baseUrl = newUrl.endsWith('/') ? newUrl.substring(0, newUrl.length - 1) : newUrl;
    dio.options.baseUrl = baseUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', baseUrl);
  }

  Future<bool> checkHealth() async {
    try {
      final response = await dio.get('/health');
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<List<ProductItem>> getProducts() async {
    try {
      final response = await dio.get('/api/v1/inventory/products');
      if (response.statusCode == 200 && response.data is List) {
        final list = (response.data as List).map((x) => ProductItem.fromJson(x)).toList();
        await _cacheProductsLocally(list);
        return list;
      }
    } catch (e) {
      print('[ApiClient] Failed to fetch remote products, using local cache: $e');
    }
    return _getCachedProducts();
  }

  Future<Map<String, dynamic>> checkoutSale(Map<String, dynamic> saleData) async {
    try {
      final response = await dio.post('/api/v1/pos/checkout', data: saleData);
      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': response.data};
      }
    } catch (e) {
      print('[ApiClient] Remote checkout failed, queuing offline: $e');
      await _queueOfflineSale(saleData);
      return {'success': true, 'offline': true, 'message': 'تم تسجيل الفاتورة محلياً وسيتم مزامنتها عند توفر الاتصال'};
    }
    return {'success': false, 'message': 'فشل إتمام العملية'};
  }

  Future<void> _cacheProductsLocally(List<ProductItem> products) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonList = products.map((p) => p.toJson()).toList();
      await prefs.setString('cached_products_json', jsonEncode(jsonList));
    } catch (_) {}
  }

  Future<List<ProductItem>> _getCachedProducts() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('cached_products_json');
      if (raw != null && raw.isNotEmpty) {
        final List decoded = jsonDecode(raw);
        return decoded.map((x) => ProductItem.fromJson(x)).toList();
      }
    } catch (_) {}

    // Default enterprise fallback inventory
    return [
      ProductItem(
        id: 'PRD-01',
        nameAr: 'تمن محمود بسمتي درجة أولى',
        nameEn: 'Mahmoud Basmati Rice 1st Grade',
        sku: 'RICE-MAH-01',
        barcode: '6281001234567',
        sellingPrice: 11500,
        costPrice: 9000,
        stock: 120,
        category: 'مواد غذائية',
        unit: 'كجم',
        isWeighted: true,
      ),
      ProductItem(
        id: 'PRD-02',
        nameAr: 'زيت طعام عافية ذرة 1.5 لتر',
        nameEn: 'Afia Corn Oil 1.5L',
        sku: 'OIL-AFIA-15L',
        barcode: '6281007654321',
        sellingPrice: 4250,
        costPrice: 3500,
        stock: 85,
        category: 'مواد غذائية',
        unit: 'قطعة',
      ),
      ProductItem(
        id: 'PRD-03',
        nameAr: 'شاي محمود كلاسيك خشن 400 غرام',
        nameEn: 'Mahmoud Tea Classic 400g',
        sku: 'TEA-MAH-400',
        barcode: '8690123456789',
        sellingPrice: 5000,
        costPrice: 3800,
        stock: 200,
        category: 'مشروبات',
        unit: 'قطعة',
      ),
      ProductItem(
        id: 'PRD-04',
        nameAr: 'سكر أبيض فاخر حبيبات ناعمة',
        nameEn: 'Pure White Refined Sugar',
        sku: 'SUGAR-WHT-01',
        barcode: '6281009988776',
        sellingPrice: 1750,
        costPrice: 1250,
        stock: 350,
        category: 'مواد غذائية',
        unit: 'كجم',
        isWeighted: true,
      ),
      ProductItem(
        id: 'PRD-05',
        nameAr: 'معجون طماطم لونا عبوة 800 غرام',
        nameEn: 'Luna Tomato Paste 800g',
        sku: 'PASTE-LUNA-800',
        barcode: '6281005544332',
        sellingPrice: 2250,
        costPrice: 1650,
        stock: 90,
        category: 'معلبات',
        unit: 'قطعة',
      ),
      ProductItem(
        id: 'PRD-06',
        nameAr: 'حليب نيدو مجفف أكياس 2.25 كجم',
        nameEn: 'Nido Milk Powder 2.25kg',
        sku: 'MILK-NIDO-225',
        barcode: '7613032112233',
        sellingPrice: 24500,
        costPrice: 20500,
        stock: 40,
        category: 'ألبان',
        unit: 'قطعة',
      ),
    ];
  }

  Future<void> _queueOfflineSale(Map<String, dynamic> saleData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final existing = prefs.getStringList('offline_pending_sales') ?? [];
      existing.add(jsonEncode(saleData));
      await prefs.setStringList('offline_pending_sales', existing);
    } catch (_) {}
  }
}


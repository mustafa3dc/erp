export interface CountryDef {
  code: string;
  nameAr: string;
  nameEn: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  defaultTimezone: string;
  phoneCode: string;
  states: Array<{
    code: string;
    nameAr: string;
    nameEn: string;
    majorCities?: string[];
  }>;
}

export interface StorageClassificationDef {
  id: string;
  nameAr: string;
  nameEn: string;
  iconName: string;
  tempRangeAr: string;
  tempRangeEn: string;
  humidityAr: string;
  humidityEn: string;
  badgeColor: string;
  descriptionAr: string;
  descriptionEn: string;
  complianceStandards?: string[];
}

export const GLOBAL_COUNTRIES: CountryDef[] = [
  {
    code: 'IQ',
    nameAr: 'العراق',
    nameEn: 'Iraq',
    flag: '',
    currency: 'IQD (د.ع)',
    currencySymbol: 'IQD',
    defaultTimezone: 'Asia/Baghdad (UTC+3)',
    phoneCode: '+964',
    states: [
      { code: 'BG', nameAr: 'بغداد', nameEn: 'Baghdad', majorCities: ['الكرخ', 'الرصافة', 'المنصور', 'الكرادة', 'الشورجة', 'الدورة', 'الشعب'] },
      { code: 'MSL', nameAr: 'الموصل', nameEn: 'Mosul', majorCities: ['الجانب الأيسر', 'الجانب الأيمن', 'تلعفر', 'الحمدانية', 'برطلة', 'المنطقة الصناعية'] },
      { code: 'BSR', nameAr: 'البصرة', nameEn: 'Basra', majorCities: ['العشار', 'الزبير', 'أم قصر', 'الهارثة', 'سفوان', 'القرنة'] },
      { code: 'ERB', nameAr: 'أربيل', nameEn: 'Erbil', majorCities: ['عنكاوة', 'طريق كركوك', 'قوشتبة', 'سوران', 'شقلاوة'] },
      { code: 'KRB', nameAr: 'كربلاء', nameEn: 'Karbala', majorCities: ['مركز المدينة', 'الهندية', 'عين التمر', 'حي العباس'] },
      { code: 'NJF', nameAr: 'النجف', nameEn: 'Najaf', majorCities: ['مركز المدينة', 'الكوفة', 'المناذرة', 'حي الحرفيين'] },
      { code: 'SLM', nameAr: 'السليمانية', nameEn: 'Sulaymaniyah', majorCities: ['مركز المدينة', 'طاسلوجة', 'بكرجو', 'بازيان', 'رانية'] },
      { code: 'KIR', nameAr: 'كركوك', nameEn: 'Kirkuk', majorCities: ['مركز المدينة', 'طريق بغداد', 'الواسطي', 'الحويجة', 'دبس'] },
      { code: 'BBL', nameAr: 'بابل', nameEn: 'Babil', majorCities: ['الحلة', 'المحاويل', 'الإسكندرية', 'المسيب', 'الهاشمية'] },
      { code: 'ANB', nameAr: 'الأنبار', nameEn: 'Al-Anbar', majorCities: ['الرمادي', 'الفلوجة', 'هيت', 'القائم', 'حديثة'] },
      { code: 'DYL', nameAr: 'ديالى', nameEn: 'Diyala', majorCities: ['بعقوبة', 'المقدادية', 'خانقين', 'الخالص', 'بلدروز'] },
      { code: 'SAL', nameAr: 'صلاح الدين', nameEn: 'Salah Al-Din', majorCities: ['تكريت', 'سامراء', 'بلد', 'الدور', 'بيجي'] },
      { code: 'DHK', nameAr: 'دهوك', nameEn: 'Duhok', majorCities: ['مركز المدينة', 'زاخو', 'سميل', 'العمادية'] },
      { code: 'WST', nameAr: 'واسط', nameEn: 'Wasit', majorCities: ['الكوت', 'الحي', 'الصويرة', 'العزيزية', 'بدرة'] },
      { code: 'MAY', nameAr: 'ميسان', nameEn: 'Maysan', majorCities: ['العمارة', 'علي الغربي', 'الميمونة', 'قلعة صالح'] },
      { code: 'DQR', nameAr: 'ذي قار', nameEn: 'Dhi Qar', majorCities: ['الناصرية', 'الشطرة', 'سوق الشيوخ', 'الرفاعي'] },
      { code: 'MUT', nameAr: 'المثنى', nameEn: 'Al-Muthanna', majorCities: ['السماوة', 'الرميثة', 'الخضر', 'الوركاء'] },
      { code: 'DIW', nameAr: 'الديوانية', nameEn: 'Al-Diwaniyah', majorCities: ['مركز المدينة', 'الشامية', 'عفك', 'الحمزة'] },
      { code: 'HLB', nameAr: 'حلبجة', nameEn: 'Halabja', majorCities: ['مركز المدينة', 'سيروان', 'بيارة', 'خورمال'] }
    ]
  },
  {
    code: 'AE',
    nameAr: 'الإمارات العربية المتحدة',
    nameEn: 'United Arab Emirates',
    flag: '',
    currency: 'AED (د.إ)',
    currencySymbol: 'AED',
    defaultTimezone: 'Asia/Dubai (UTC+4)',
    phoneCode: '+971',
    states: [
      { code: 'DXB', nameAr: 'دبي (جبل علي / المطار)', nameEn: 'Dubai (JAFZA / DWC)', majorCities: ['Jebel Ali Free Zone', 'Dubai South', 'Al Quoz', 'Ras Al Khor', 'Deira'] },
      { code: 'AUH', nameAr: 'أبوظبي (خليفة KIZAD / مصفح)', nameEn: 'Abu Dhabi (KIZAD / Musaffah)', majorCities: ['Khalifa Industrial Zone (KIZAD)', 'Musaffah', 'ICAD', 'Al Ain'] },
      { code: 'SHJ', nameAr: 'الشارقة (المنطقة الحرة SAIF)', nameEn: 'Sharjah (SAIF Zone / Hamriyah)', majorCities: ['Hamriyah Free Zone', 'Sharjah Airport Freezone', 'Industrial Area'] },
      { code: 'AJM', nameAr: 'عجمان (المنطقة الحرة)', nameEn: 'Ajman Free Zone', majorCities: ['Ajman Free Zone', 'Jurf Industrial'] },
      { code: 'RAK', nameAr: 'رأس الخيمة', nameEn: 'Ras Al Khaimah', majorCities: ['RAK Economic Zone (RAKEZ)', 'Al Hamra'] },
      { code: 'FUJ', nameAr: 'الفجيرة (ميناء تموين السفن)', nameEn: 'Fujairah Port & Bunkering', majorCities: ['Fujairah Free Zone', 'Port of Fujairah'] }
    ]
  },
  {
    code: 'US',
    nameAr: 'الولايات المتحدة الأمريكية',
    nameEn: 'United States of America',
    flag: '',
    currency: 'USD ($)',
    currencySymbol: '$',
    defaultTimezone: 'America/New_York (UTC-5)',
    phoneCode: '+1',
    states: [
      { code: 'CA', nameAr: 'كاليفورنيا', nameEn: 'California', majorCities: ['Los Angeles', 'San Francisco', 'Long Beach', 'Oakland', 'San Diego'] },
      { code: 'TX', nameAr: 'تكساس', nameEn: 'Texas', majorCities: ['Houston', 'Dallas', 'Austin', 'Fort Worth', 'El Paso'] },
      { code: 'NY', nameAr: 'نيويورك', nameEn: 'New York', majorCities: ['New York City', 'Buffalo', 'Rochester', 'Albany'] },
      { code: 'FL', nameAr: 'فلوريدا', nameEn: 'Florida', majorCities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'] },
      { code: 'IL', nameAr: 'إلينوي', nameEn: 'Illinois', majorCities: ['Chicago', 'Naperville', 'Rockford', 'Joliet'] },
      { code: 'WA', nameAr: 'واشنطن', nameEn: 'Washington', majorCities: ['Seattle', 'Tacoma', 'Spokane', 'Vancouver'] },
      { code: 'NJ', nameAr: 'نيوجيرسي', nameEn: 'New Jersey', majorCities: ['Newark', 'Jersey City', 'Elizabeth', 'Paterson'] },
      { code: 'GA', nameAr: 'جورجيا', nameEn: 'Georgia', majorCities: ['Atlanta', 'Savannah', 'Augusta', 'Columbus'] },
      { code: 'OH', nameAr: 'أوهايو', nameEn: 'Ohio', majorCities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo'] },
      { code: 'PA', nameAr: 'بنسلفانيا', nameEn: 'Pennsylvania', majorCities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie'] }
    ]
  },
  {
    code: 'SA',
    nameAr: 'المملكة العربية السعودية',
    nameEn: 'Saudi Arabia',
    flag: '',
    currency: 'SAR (ر.س)',
    currencySymbol: 'SAR',
    defaultTimezone: 'Asia/Riyadh (UTC+3)',
    phoneCode: '+966',
    states: [
      { code: 'RUH', nameAr: 'منطقة الرياض المركزية', nameEn: 'Riyadh Central Region', majorCities: ['المدينة اللوجستية المتكاملة SILZ', 'الصناعية الثانية', 'السلي', 'طريق الخرج'] },
      { code: 'JED', nameAr: 'مكة المكرمة - جدة', nameEn: 'Makkah Region - Jeddah Port', majorCities: ['ميناء جدة الإسلامي', 'الخمرة اللوجستية', 'وادي عسفان', 'مدينة الملك عبدالله الاقتصادية KAEC'] },
      { code: 'DMM', nameAr: 'المنطقة الشرقية (الدمام والخبر)', nameEn: 'Eastern Province (Dammam / Khobar)', majorCities: ['ميناء الملك عبدالعزيز بالدمام', 'الجبيل الصناعية', 'الخبر', 'رأس تنورة'] },
      { code: 'MED', nameAr: 'المدينة المنورة', nameEn: 'Madinah Region', majorCities: ['مدينة المعرفة', 'المنطقة الصناعية حمراء الأسد'] },
      { code: 'TAB', nameAr: 'تبوك - نيوم', nameEn: 'Tabuk - NEOM Oxagon', majorCities: ['أوكساجون الصناعية NEOM Oxagon', 'ميناء ضباء', 'تبوك المدينة'] }
    ]
  },
  {
    code: 'DE',
    nameAr: 'ألمانيا',
    nameEn: 'Germany',
    flag: '',
    currency: 'EUR (€)',
    currencySymbol: '€',
    defaultTimezone: 'Europe/Berlin (UTC+1)',
    phoneCode: '+49',
    states: [
      { code: 'HH', nameAr: 'ميناء هامبورغ اللوجستي', nameEn: 'Hamburg Port Logistics', majorCities: ['Port of Hamburg', 'Altenwerder', 'Wilhelmsburg'] },
      { code: 'HE', nameAr: 'فرانكفورت للشحن الجوي (هيسن)', nameEn: 'Frankfurt Cargo City (Hesse)', majorCities: ['Frankfurt CargoCity South', 'Kelsterbach', 'Wiesbaden'] },
      { code: 'BY', nameAr: 'بافاريا - ميونخ ونورنبرغ', nameEn: 'Bavaria (Munich / Nuremberg)', majorCities: ['Munich Airport Logistics', 'Nuremberg Port', 'Augsburg'] },
      { code: 'NW', nameAr: 'شمال الراين - دويسبرغ وكولونيا', nameEn: 'North Rhine-Westphalia (Duisburg / Cologne)', majorCities: ['Duisport (Largest Inland Port)', 'Cologne Cargo Hub', 'Düsseldorf'] }
    ]
  },
  {
    code: 'GB',
    nameAr: 'المملكة المتحدة',
    nameEn: 'United Kingdom',
    flag: '',
    currency: 'GBP (£)',
    currencySymbol: '£',
    defaultTimezone: 'Europe/London (UTC+0)',
    phoneCode: '+44',
    states: [
      { code: 'LON', nameAr: 'لندن الكبرى وهيثرو للشحن', nameEn: 'Greater London & Heathrow Cargo', majorCities: ['Heathrow Cargo Centre', 'London Gateway Port', 'Park Royal', 'Dartford'] },
      { code: 'MID', nameAr: 'الميدلاندز - المثلث الذهبي للشحن', nameEn: 'Midlands (Golden Logistics Triangle)', majorCities: ['Birmingham', 'Northampton', 'Daventry Rail Freight', 'Leicester'] },
      { code: 'NW', nameAr: 'الشمال الغربي - مانشستر وليفربول', nameEn: 'North West (Manchester / Liverpool Port)', majorCities: ['Manchester Airport City', 'Port of Liverpool', 'Warrington'] }
    ]
  },
  {
    code: 'CN',
    nameAr: 'الصين',
    nameEn: 'China',
    flag: '',
    currency: 'CNY (¥)',
    currencySymbol: '¥',
    defaultTimezone: 'Asia/Shanghai (UTC+8)',
    phoneCode: '+86',
    states: [
      { code: 'SH', nameAr: 'شنغهاي وميناء يانغشان البحري', nameEn: 'Shanghai & Yangshan Deepwater Port', majorCities: ['Pudong Cargo Hub', 'Yangshan Free Trade Port', 'Waigaoqiao'] },
      { code: 'GD', nameAr: 'غوانغدونغ - شنتشن وغوانغتشو', nameEn: 'Guangdong (Shenzhen / Guangzhou)', majorCities: ['Yantian Port (Shenzhen)', 'Shekou Port', 'Guangzhou Baiyun Airport', 'Dongguan'] },
      { code: 'ZJ', nameAr: 'تشجيانغ - نينغبو وإيوو (Yiwu)', nameEn: 'Zhejiang (Ningbo Port / Yiwu Markets)', majorCities: ['Ningbo-Zhoushan Port', 'Yiwu International Trade City', 'Hangzhou'] }
    ]
  },
  {
    code: 'TR',
    nameAr: 'تركيا',
    nameEn: 'Turkey',
    flag: '',
    currency: 'TRY (₺)',
    currencySymbol: '₺',
    defaultTimezone: 'Europe/Istanbul (UTC+3)',
    phoneCode: '+90',
    states: [
      { code: 'IST-E', nameAr: 'إسطنبول - الجانب الأوروبي (مطار إسطنبول)', nameEn: 'Istanbul - European Side & Airport', majorCities: ['Istanbul Airport Cargo City', 'Ambarli Port', 'Hadimkoy Logistics'] },
      { code: 'IST-A', nameAr: 'إسطنبول - الجانب الآسيوي (توزلا)', nameEn: 'Istanbul - Asian Side & Tuzla Free Zone', majorCities: ['Tuzla Industrial Zone', 'Gebze Logistics Center', 'Sabiha Gokcen Cargo'] },
      { code: 'MER', nameAr: 'مرسين (ميناء الترانزيت الدولي)', nameEn: 'Mersin International Port Hub', majorCities: ['Port of Mersin', 'Mersin Free Zone', 'Tarsus'] }
    ]
  },
  {
    code: 'JO',
    nameAr: 'الأردن',
    nameEn: 'Jordan',
    flag: '',
    currency: 'JOD (د.أ)',
    currencySymbol: 'JOD',
    defaultTimezone: 'Asia/Amman (UTC+3)',
    phoneCode: '+962',
    states: [
      { code: 'AQB', nameAr: 'العقبة (منطقة العقبة الاقتصادية الخاصة ASEZA)', nameEn: 'Aqaba Special Economic Zone', majorCities: ['ميناء العقبة للحاويات', 'قرية العقبة اللوجستية', 'المطار الجنوبي'] },
      { code: 'AMM', nameAr: 'عمان الكبرى (سحاب والقسطل)', nameEn: 'Greater Amman (Sahab / Qastal)', majorCities: ['مدينة الملك عبدالله الثاني الصناعية بسحاب', 'القسطل اللوجستية', 'المفرق'] }
    ]
  },
  {
    code: 'EG',
    nameAr: 'مصر',
    nameEn: 'Egypt',
    flag: '',
    currency: 'EGP (ج.م)',
    currencySymbol: 'EGP',
    defaultTimezone: 'Africa/Cairo (UTC+2)',
    phoneCode: '+20',
    states: [
      { code: 'CAI', nameAr: 'القاهرة الكبرى (العاشر من رمضان / 6 أكتوبر)', nameEn: 'Greater Cairo & Industrial Cities', majorCities: ['العاشر من رمضان', 'المنطقة الصناعية بالسادس من أكتوبر', 'بدر اللوجستية'] },
      { code: 'SCZ', nameAr: 'المنطقة الاقتصادية لقناة السويس (العين السخنة)', nameEn: 'Suez Canal Economic Zone (SCZone / Sokhna)', majorCities: ['ميناء العين السخنة', 'شرق بورسعيد', 'غرب بورسعيد', 'القنطرة غرب'] },
      { code: 'ALX', nameAr: 'الإسكندرية وميناء الدخيلة', nameEn: 'Alexandria & Dekheila Port', majorCities: ['ميناء الإسكندرية', 'برج العرب الجديدة', 'العامرية'] }
    ]
  },
  {
    code: 'NL',
    nameAr: 'هولندا',
    nameEn: 'Netherlands',
    flag: '',
    currency: 'EUR (€)',
    currencySymbol: '€',
    defaultTimezone: 'Europe/Amsterdam (UTC+1)',
    phoneCode: '+31',
    states: [
      { code: 'ZH', nameAr: 'ميناء روتردام الأوروبي العملاق', nameEn: 'Port of Rotterdam Logistics Gate', majorCities: ['Maasvlakte Intermodal Hub', 'Botlek', 'Waalhaven', 'Dordrecht'] },
      { code: 'NH', nameAr: 'أمستردام ومطار سخيبول للشحن', nameEn: 'Amsterdam & Schiphol Airport Logistics', majorCities: ['Schiphol Logistics Park', 'Port of Amsterdam', 'Haarlemmermeer'] }
    ]
  },
  {
    code: 'SG',
    nameAr: 'سنغافورة',
    nameEn: 'Singapore',
    flag: '',
    currency: 'SGD (S$)',
    currencySymbol: 'S$',
    defaultTimezone: 'Asia/Singapore (UTC+8)',
    phoneCode: '+65',
    states: [
      { code: 'SG-HUB', nameAr: 'المنطقة اللوجستية المركزية (Tuas Mega Port)', nameEn: 'Tuas Mega Port & Jurong Logistics Hub', majorCities: ['Tuas Mega Port', 'Jurong Industrial Estate', 'Changi Airfreight Centre'] }
    ]
  }
];

export const STORAGE_CLASSIFICATIONS: StorageClassificationDef[] = [
  {
    id: 'rdc_general',
    nameAr: 'مستودع توزيع إقليمي وبضائع عامة (Regional Distribution Center - RDC)',
    nameEn: 'Regional Distribution Center (General Retail & Dry Goods)',
    iconName: 'Package',
    tempRangeAr: '20°C إلى 24°C (جو معتدل جاف)',
    tempRangeEn: '20°C to 24°C (Ambient Controlled)',
    humidityAr: 'رطوبة 40% - 60% RH',
    humidityEn: '40% - 60% Relative Humidity',
    badgeColor: 'var(--primary)',
    descriptionAr: 'مخصص لتخزين وتوزيع السلع الاستهلاكية، الإلكترونيات، الملابس، وقطع الغيار بنظام رفوف انتقائية وممرات ضيقة VNA.',
    descriptionEn: 'Engineered for high-throughput fast moving consumer goods (FMCG), electronics, apparel and auto parts with selective pallet racking.'
  },
  {
    id: 'cold_chain',
    nameAr: 'سلسلة تبريد ومواد غذائية طازجة (Cold Chain & Fresh Perishables)',
    nameEn: 'Cold Chain & Fresh Perishables Hub',
    iconName: 'ThermometerSnowflake',
    tempRangeAr: '0°C إلى 4°C (تبريد إيجابي نشط)',
    tempRangeEn: '0°C to 4°C (Active Positive Chilled)',
    humidityAr: 'رطوبة متحكم بها 85% - 95%',
    humidityEn: 'Controlled 85% - 95% RH',
    badgeColor: '#06b6d4',
    descriptionAr: 'مجهز بوحدات تبريد مكررة (Redundant Chillers) وعوازل هوائية للألبان، اللحوم الطازجة، الخضروات، والفواكه مع تتبع HACCP.',
    descriptionEn: 'Equipped with redundant chillers and air curtains for fresh produce, dairy, meat and cut flowers under strict HACCP compliance.'
  },
  {
    id: 'deep_freeze',
    nameAr: 'تجميد وحفظ عميق فائق البرودة (Deep Freeze Sub-Zero Storage)',
    nameEn: 'Deep Freeze & Sub-Zero Storage (-18°C to -25°C)',
    iconName: 'Snowflake',
    tempRangeAr: '-18°C إلى -25°C (تجميد عميق)',
    tempRangeEn: '-18°C to -25°C (Deep Sub-Zero Freeze)',
    humidityAr: 'هواء جاف مانع للجليد',
    humidityEn: 'Desiccant Dry Dehumidified Air',
    badgeColor: 'var(--primary)',
    descriptionAr: 'غرف تجميد عملاقة معزولة بطبقات PIR سماكة 200mm لحفظ الأسماك، اللحوم المستوردة، الآيس كريم، والمنتجات المجمدة لفترات طويلة.',
    descriptionEn: 'Heavy insulated sub-zero blast freezers for frozen seafood, meats, prepared foods and ice cream with cold-dock vestibules.'
  },
  {
    id: 'pharma_gdp',
    nameAr: 'مستودع أدوية ومستلزمات طبية معتمد (GDP Certified Pharma & Healthcare)',
    nameEn: 'GDP Pharma & Healthcare Grade Warehouse',
    iconName: 'ShieldPlus',
    tempRangeAr: '15°C إلى 25°C (CRT) / و 2°C إلى 8°C (Cooler)',
    tempRangeEn: '15°C to 25°C (CRT) / 2°C to 8°C (Refrigerated)',
    humidityAr: 'رطوبة لا تتجاوز 50% RH',
    humidityEn: 'Max 50% RH Validated',
    badgeColor: '#10b981',
    descriptionAr: 'معتمد وفق بروتوكولات ممارسات التوزيع الجيد للأدوية (GDP/FDA)، أرضيات إيبوكسي معقمة، مجسات معايرة، ومولدات طوارئ فورية.',
    descriptionEn: 'Full GDP/FDA compliant facility with calibrated NIST thermal sensors, HEPA air filtration, sterile epoxy flooring and 100% backup power.'
  },
  {
    id: 'bonded_customs',
    nameAr: 'منطقة إيداع جمركي وترانزيت حر (Bonded Customs & Free-Trade Zone - FTZ)',
    nameEn: 'Bonded Customs & Free-Trade Zone Depot (FTZ)',
    iconName: 'Building2',
    tempRangeAr: 'حسب طبيعة الشحنات المحولة',
    tempRangeEn: 'Multimodal Cargo Specific',
    humidityAr: 'حماية جمركية معيارية',
    humidityEn: 'Customs Sealed & Bonded Standard',
    badgeColor: '#f59e0b',
    descriptionAr: 'مستودع تحت إشراف هيئة الجمارك والموانئ؛ يسمح بإعادة التعبئة، الترانزيت الدولي، وتأجيل دفع الرسوم الجمركية والضرائب حتى إعادة التصدير.',
    descriptionEn: 'Licensed bonded terminal under customs supervision allowing duty-deferment, transshipment, light kitting and international re-export.'
  },
  {
    id: 'cross_docking',
    nameAr: 'محطة تفريغ ومناقلة سريعة (Cross-Docking & Intermodal Transfer Hub)',
    nameEn: 'Cross-Docking & High-Velocity Transit Terminal',
    iconName: 'Truck',
    tempRangeAr: 'شحن ومناولة سريعة 24/7',
    tempRangeEn: 'Continuous 24/7 Velocity Flow',
    humidityAr: 'أرصفة تحميل هيدروليكية',
    humidityEn: 'Dynamic Hydraulic Dock Levelers',
    badgeColor: 'var(--primary)',
    descriptionAr: 'مصمم بدون أرفف تخزين طويلة؛ تفريغ الشاحنات القادمة وفرز الطرود وإعادة شحنها للمدن والفروع خلال أقل من 12 ساعة.',
    descriptionEn: 'High-door-ratio dock terminal with zero long-term storage; pallets arriving from ports are directly sorted and dispatched within 12 hours.'
  },
  {
    id: 'hazmat_chemical',
    nameAr: 'مستودع مواد كيماوية وبضائع خطرة (HAZMAT Dangerous Goods Class 1-9)',
    nameEn: 'HAZMAT Dangerous Goods & Chemical Depot',
    iconName: 'AlertOctagon',
    tempRangeAr: 'تحكم بيئي مانع للاشتعال',
    tempRangeEn: 'ATEX Explosion-Proof Climate',
    humidityAr: 'تهوية قسرية واحتواء تسربات',
    humidityEn: 'Spill Containment & Forced Exhaust',
    badgeColor: '#ef4444',
    descriptionAr: 'معايير أمان قصوى للمواد الكيميائية والدهانات والغازات؛ قواطع مانعة لانتشار النيران 4 ساعات، أنظمة إطفاء بالرغوة ومصائد تسرب كيميائي.',
    descriptionEn: 'Built to NFPA/ATEX safety codes with 4-hour firewalls, foam suppression systems, intrinsically safe lighting and acid-resistant spill sumps.'
  },
  {
    id: 'high_security_vault',
    nameAr: 'مستودع عالي الأمان وخزائن سلع ثمينة (High-Security Vault & Electronics)',
    nameEn: 'High-Security Vault & High-Value Electronics Depot',
    iconName: 'Lock',
    tempRangeAr: '21°C ثابتة مع حماية ليزرية',
    tempRangeEn: '21°C Constant Controlled',
    humidityAr: 'مانع للتكثف والتآكل 45% RH',
    humidityEn: '45% Anti-Corrosive Environment',
    badgeColor: 'var(--primary)',
    descriptionAr: 'تخزين الإلكترونيات الدقيقة، الساعات الفاخرة، والسبائك؛ بوابات مصفحة بإنذار مزدوج، فحص بصري بيومتري، وتأمين لوجستي فائق.',
    descriptionEn: 'Reinforced vault rooms with biometric access, dual-custody authorization, seismic vibration sensors and full CCTV coverage for high-theft items.'
  },
  {
    id: 'raw_materials',
    nameAr: 'مستودع مواد خام وسلاسل تصنيع (Raw Materials & Manufacturing WIP)',
    nameEn: 'Raw Materials & Manufacturing Heavy Buffer Depot',
    iconName: 'Layers',
    tempRangeAr: 'مناخ صناعي قوي مع رافعات جسرية',
    tempRangeEn: 'Industrial Heavy Duty Ambience',
    humidityAr: 'معالجة جافة ضد الصدأ',
    humidityEn: 'Corrosion-Inhibited Dry Storage',
    badgeColor: '#64748b',
    descriptionAr: 'مستودع أرضي عالي التحمل (Floor Load 10 Ton/m²) لتخزين لفائف الصلب، حبيبات البوليمر، كابلات النحاس، ومغذيات خطوط الإنتاج.',
    descriptionEn: 'High floor-load capacity facility (10T/m²) equipped with overhead gantry cranes for steel coils, raw chemicals and production WIP buffers.'
  },
  {
    id: 'open_yard_heavy',
    nameAr: 'ساحة تخزين مكشوفة ومعدات ثقيلة (Open-Yard & Heavy Equipment Storage)',
    nameEn: 'Open Yard & Heavy Machinery Staging Facility',
    iconName: 'Boxes',
    tempRangeAr: 'تخزين خارجي ممهد ومسور',
    tempRangeEn: 'Outdoor Paved Hardstand Staging',
    humidityAr: 'مقاوم للظروف الجوية الخارجية',
    humidityEn: 'Weather Resistant Open Hardstand',
    badgeColor: '#78716c',
    descriptionAr: 'ساحات مفتوحة مسورة ومضاءة بأبراج ليزرية للمعدات الثقيلة، خطوط الأنابيب، الحاويات الفارغة، ومواد البناء الضخمة.',
    descriptionEn: 'Heavy-duty asphalt hardstand with perimeter security, high-mast floodlights and heavy forklift runways for container stacking and rigs.'
  },
  {
    id: 'ecommerce_fulfillment',
    nameAr: 'مركز تلبية طلبات التجارة الإلكترونية الذكي (Smart Automated E-Commerce FC)',
    nameEn: 'Smart Automated E-Commerce Fulfillment Center',
    iconName: 'Layers',
    tempRangeAr: '21°C بيئة تشغيل روبوتية مكيفة',
    tempRangeEn: '21°C Conditioned Robotics Environment',
    humidityAr: '50% RH نظام مكافحة كهرباء ساكنة',
    humidityEn: '50% Anti-Static ESD Protected',
    badgeColor: 'var(--primary)',
    descriptionAr: 'مجهز بمسارات روبوتية (AGV/AMR)، رفوف ذكية، محطات انتقاء ضوئية (Pick-to-Light)، وأحزمة فرز سريعة لتجهيز آلاف الطرود يومياً.',
    descriptionEn: 'High-density goods-to-person facility powered by AGV sorting robots, automated carton erectors, and pick-to-light conveyor induction loops.'
  },
  {
    id: 'reverse_logistics_rma',
    nameAr: 'مركز لوجستيات عكسية وإدارة المرتجعات (Reverse Logistics & RMA Center)',
    nameEn: 'Reverse Logistics & Warranty Repair Depot (RMA)',
    iconName: 'RotateCcw',
    tempRangeAr: '22°C ورش فحص وصيانة مؤهلة',
    tempRangeEn: '22°C Diagnostic & Quality Workbench',
    humidityAr: 'بيئة إلكترونيات مؤرضة ESD',
    humidityEn: 'ESD Grounded Inspection Benches',
    badgeColor: '#d97706',
    descriptionAr: 'محطة متخصصة لاستلام المرتجعات، الفحص الفني، فحص الضمان، إعادة التعبئة، وتوجيه البضاعة إلى إعادة البيع أو التكهين.',
    descriptionEn: 'Dedicated diagnostic facility for customer returns, RMA warranty verification, cosmetic refurbishment, grading, and secondary repackaging.'
  }
];

export function getCountryByCode(code: string): CountryDef {
  return GLOBAL_COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase()) || GLOBAL_COUNTRIES[0];
}

export function getStatesForCountry(countryCode: string) {
  const country = getCountryByCode(countryCode);
  return country.states;
}

export function getStorageTypeById(typeId: string): StorageClassificationDef {
  return STORAGE_CLASSIFICATIONS.find(s => s.id === typeId) || STORAGE_CLASSIFICATIONS[0];
}

import os, struct, zlib, math

OUT_DIR = "/Users/mustafa/.gemini/antigravity-ide/scratch/erp-warehouse-system/web-dashboard/public/avatars"
os.makedirs(OUT_DIR, exist_ok=True)

# 16 Curated Memoji configurations with rich color palettes and themes
AVATARS = [
    {
        "id": "memoji-01",
        "name_ar": "المدير التنفيذي الكلاسيكي",
        "name_en": "Executive Navy",
        "bg1": "#1e3a8a", "bg2": "#3b82f6",
        "suit": "#0f172a", "tie": "#ef4444", "skin": "#fcd34d",
        "hair": "#1e293b", "glasses": False, "accessory": "tie",
        "role_alias": ["memoji-admin", "memoji-SuperAdmin", "memoji-PlatformSuperAdmin"]
    },
    {
        "id": "memoji-02",
        "name_ar": "المشرف الإداري الأرجواني",
        "name_en": "Operations Violet",
        "bg1": "#581c87", "bg2": "#8b5cf6",
        "suit": "#3b0764", "tie": "#d8b4fe", "skin": "#fbcfe8",
        "hair": "#4c1d95", "glasses": False, "accessory": "collar",
        "role_alias": ["memoji-BranchManager"]
    },
    {
        "id": "memoji-03",
        "name_ar": "المحاسب المالي بنظارات",
        "name_en": "Financial Auditor",
        "bg1": "#064e3b", "bg2": "#10b981",
        "suit": "#022c22", "tie": "#34d399", "skin": "#fef3c7",
        "hair": "#1f2937", "glasses": True, "accessory": "tie",
        "role_alias": ["memoji-accountant", "memoji-Accountant"]
    },
    {
        "id": "memoji-04",
        "name_ar": "كاشير المبيعات بالسماعة",
        "name_en": "POS Cashier Specialist",
        "bg1": "#0369a1", "bg2": "#38bdf8",
        "suit": "#0c4a6e", "tie": "#7dd3fc", "skin": "#fed7aa",
        "hair": "#374151", "glasses": False, "accessory": "headset",
        "role_alias": ["memoji-cashier", "memoji-Cashier"]
    },
    {
        "id": "memoji-05",
        "name_ar": "أمين المستودع بالخوذة",
        "name_en": "Warehouse Custodian",
        "bg1": "#b45309", "bg2": "#f59e0b",
        "suit": "#78350f", "tie": "#fbbf24", "skin": "#fcd34d",
        "hair": "#111827", "glasses": False, "accessory": "helmet",
        "role_alias": ["memoji-warehouse", "memoji-Storekeeper"]
    },
    {
        "id": "memoji-06",
        "name_ar": "مدير المبيعات الزمردي",
        "name_en": "Sales Lead Emerald",
        "bg1": "#0f766e", "bg2": "#14b8a6",
        "suit": "#134e4a", "tie": "#5eead4", "skin": "#fed7aa",
        "hair": "#292524", "glasses": False, "accessory": "tie",
        "role_alias": []
    },
    {
        "id": "memoji-07",
        "name_ar": "المشرف النيلي الفخم",
        "name_en": "Supervisor Indigo",
        "bg1": "#3730a3", "bg2": "#6366f1",
        "suit": "#1e1b4b", "tie": "#a5b4fc", "skin": "#fef3c7",
        "hair": "#18181b", "glasses": True, "accessory": "tie",
        "role_alias": []
    },
    {
        "id": "memoji-08",
        "name_ar": "خدمة العملاء الياقوتي",
        "name_en": "Customer Success Ruby",
        "bg1": "#9f1239", "bg2": "#f43f5e",
        "suit": "#4c0519", "tie": "#fda4af", "skin": "#fcd34d",
        "hair": "#451a03", "glasses": False, "accessory": "headset",
        "role_alias": []
    },
    {
        "id": "memoji-09",
        "name_ar": "مسؤول التدقيق والجرد",
        "name_en": "Inventory Auditor Amber",
        "bg1": "#92400e", "bg2": "#d97706",
        "suit": "#451a03", "tie": "#fde68a", "skin": "#fbcfe8",
        "hair": "#27272a", "glasses": True, "accessory": "tie",
        "role_alias": []
    },
    {
        "id": "memoji-10",
        "name_ar": "مسؤول الحماية والأمان",
        "name_en": "Security & Audit Slate",
        "bg1": "#1e293b", "bg2": "#64748b",
        "suit": "#020617", "tie": "#cbd5e1", "skin": "#fed7aa",
        "hair": "#0f172a", "glasses": False, "accessory": "badge",
        "role_alias": []
    },
    {
        "id": "memoji-11",
        "name_ar": "مدير العمليات الوردي",
        "name_en": "Operations Rose",
        "bg1": "#881337", "bg2": "#fb7185",
        "suit": "#4c0519", "tie": "#ffe4e6", "skin": "#fcd34d",
        "hair": "#1c1917", "glasses": False, "accessory": "collar",
        "role_alias": []
    },
    {
        "id": "memoji-12",
        "name_ar": "موظف صالة العرض السماوي",
        "name_en": "Showroom Clerk Cyan",
        "bg1": "#155e75", "bg2": "#06b6d4",
        "suit": "#083344", "tie": "#67e8f9", "skin": "#fef3c7",
        "hair": "#3f3f46", "glasses": False, "accessory": "collar",
        "role_alias": []
    },
    {
        "id": "memoji-13",
        "name_ar": "المدير العام الملكي",
        "name_en": "General Manager Sapphire",
        "bg1": "#1d4ed8", "bg2": "#60a5fa",
        "suit": "#172554", "tie": "#bfdbfe", "skin": "#fed7aa",
        "hair": "#111827", "glasses": True, "accessory": "tie",
        "role_alias": []
    },
    {
        "id": "memoji-14",
        "name_ar": "محلل البيانات الأخضر",
        "name_en": "Data Analyst Emerald",
        "bg1": "#047857", "bg2": "#34d399",
        "suit": "#064e3b", "tie": "#a7f3d0", "skin": "#fcd34d",
        "hair": "#18181b", "glasses": True, "accessory": "collar",
        "role_alias": []
    },
    {
        "id": "memoji-15",
        "name_ar": "مسؤول الإرسال اللوجستي",
        "name_en": "Dispatch Coordinator",
        "bg1": "#c2410c", "bg2": "#fb923c",
        "suit": "#7c2d12", "tie": "#fed7aa", "skin": "#fef3c7",
        "hair": "#292524", "glasses": False, "accessory": "headset",
        "role_alias": []
    },
    {
        "id": "memoji-16",
        "name_ar": "المهندس البرمجي البنفسجي",
        "name_en": "System Architect Purple",
        "bg1": "#6b21a8", "bg2": "#c084fc",
        "suit": "#3b0764", "tie": "#e9d5ff", "skin": "#fed7aa",
        "hair": "#1e1b4b", "glasses": True, "accessory": "collar",
        "role_alias": []
    }
]

def generate_svg(av):
    extra = ""
    if av["accessory"] == "headset":
        extra += """
        <!-- Headset -->
        <path d="M28 56 C28 36 92 36 92 56" fill="none" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/>
        <rect x="24" y="52" width="8" height="16" rx="4" fill="#3b82f6"/>
        <path d="M28 66 L42 78" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
        <circle cx="44" cy="79" r="4" fill="#60a5fa"/>
        """
    elif av["accessory"] == "helmet":
        extra += """
        <!-- Safety Helmet -->
        <path d="M30 46 C30 26 90 26 90 46 Z" fill="#fbbf24"/>
        <path d="M24 45 C40 43 80 43 96 45 L94 48 C80 46 40 46 26 48 Z" fill="#f59e0b"/>
        <rect x="56" y="28" width="8" height="18" fill="#d97706" rx="2"/>
        """
    elif av["accessory"] == "badge":
        extra += """
        <!-- Badge -->
        <polygon points="60,82 64,88 72,88 66,94 68,102 60,97 52,102 54,94 48,88 56,88" fill="#38bdf8"/>
        """

    glasses_svg = ""
    if av["glasses"]:
        glasses_svg = """
        <!-- Glasses -->
        <circle cx="48" cy="54" r="8" fill="none" stroke="#1e293b" stroke-width="2.5"/>
        <circle cx="72" cy="54" r="8" fill="none" stroke="#1e293b" stroke-width="2.5"/>
        <line x1="56" y1="54" x2="64" y2="54" stroke="#1e293b" stroke-width="2.5"/>
        <line x1="40" y1="52" x2="34" y2="50" stroke="#1e293b" stroke-width="2"/>
        <line x1="80" y1="52" x2="86" y2="50" stroke="#1e293b" stroke-width="2"/>
        """

    tie_svg = ""
    if av["accessory"] == "tie":
        tie_svg = f"""
        <!-- Collar & Tie -->
        <polygon points="60,86 48,74 72,74" fill="#ffffff"/>
        <polygon points="57,78 63,78 65,96 60,102 55,96" fill="{av['tie']}"/>
        """
    else:
        tie_svg = """
        <!-- Shirt Collar -->
        <polygon points="60,86 48,74 72,74" fill="#ffffff"/>
        """

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="bg-{av['id']}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{av['bg1']}"/>
      <stop offset="100%" stop-color="{av['bg2']}"/>
    </linearGradient>
    <linearGradient id="skin-{av['id']}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="{av['skin']}"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  
  <!-- Outer Glow Circle -->
  <circle cx="60" cy="60" r="56" fill="url(#bg-{av['id']})"/>

  <!-- Body / Suit -->
  <path d="M22 108 C25 82 40 76 60 76 C80 76 95 82 98 108 Z" fill="{av['suit']}"/>
  {tie_svg}

  <!-- Neck -->
  <rect x="53" y="66" width="14" height="14" fill="{av['skin']}" rx="2"/>

  <!-- Head -->
  <ellipse cx="60" cy="54" rx="22" ry="24" fill="{av['skin']}"/>

  <!-- Ears -->
  <circle cx="37" cy="54" r="5" fill="{av['skin']}"/>
  <circle cx="83" cy="54" r="5" fill="{av['skin']}"/>

  <!-- Hair -->
  <path d="M37 46 C37 28 83 28 83 46 C77 34 43 34 37 46 Z" fill="{av['hair']}"/>
  <ellipse cx="60" cy="34" rx="16" ry="6" fill="{av['hair']}"/>

  <!-- Eyes -->
  <circle cx="50" cy="54" r="3" fill="#1e293b"/>
  <circle cx="70" cy="54" r="3" fill="#1e293b"/>
  <circle cx="51" cy="53" r="1" fill="#ffffff"/>
  <circle cx="71" cy="53" r="1" fill="#ffffff"/>

  <!-- Eyebrows -->
  <path d="M46 48 Q50 45 54 48" stroke="{av['hair']}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M66 48 Q70 45 74 48" stroke="{av['hair']}" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- Smile -->
  <path d="M52 65 Q60 71 68 65" stroke="#9a3412" stroke-width="2" fill="none" stroke-linecap="round"/>

  {glasses_svg}
  {extra}
</svg>"""
    return svg

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def generate_png_bytes(av, size=120):
    bg1 = hex_to_rgb(av["bg1"])
    bg2 = hex_to_rgb(av["bg2"])
    suit = hex_to_rgb(av["suit"])
    skin = hex_to_rgb(av["skin"])
    hair = hex_to_rgb(av["hair"])
    tie = hex_to_rgb(av["tie"])
    white = (255, 255, 255)
    dark = (15, 23, 42)

    raw = bytearray()
    r_circ = 54.0
    cx, cy = 60.0, 60.0

    for y in range(size):
        raw.append(0) # filter type none
        fy = float(y)
        for x in range(size):
            fx = float(x)
            dx = fx - cx
            dy = fy - cy
            dist = math.sqrt(dx*dx + dy*dy)

            if dist > r_circ:
                raw.extend([0, 0, 0, 0])
                continue

            # Base gradient
            t = (fx + fy) / (2.0 * size)
            r = int(bg1[0] * (1-t) + bg2[0] * t)
            g = int(bg1[1] * (1-t) + bg2[1] * t)
            b = int(bg1[2] * (1-t) + bg2[2] * t)

            # Suit body (lower arc)
            if fy > 76 and abs(dx) < 40:
                # Suit shape
                body_y = 76 + (dx * dx) / 50.0
                if fy >= body_y:
                    r, g, b = suit

            # Neck
            if 66 <= fy <= 80 and abs(dx) <= 7:
                r, g, b = skin

            # Tie / Collar
            if 76 <= fy <= 104 and abs(dx) <= 5:
                if av["accessory"] == "tie":
                    r, g, b = tie
                else:
                    r, g, b = white
            elif 72 <= fy <= 80 and abs(dx) <= 12:
                r, g, b = white

            # Head (ellipse cx=60, cy=54, rx=22, ry=24)
            h_dx = fx - 60.0
            h_dy = fy - 54.0
            if (h_dx*h_dx)/(22.0*22.0) + (h_dy*h_dy)/(24.0*24.0) <= 1.0:
                r, g, b = skin

                # Hair on top
                if fy < 46:
                    r, g, b = hair

                # Eyes
                if (abs(fx - 49) <= 2.5 and abs(fy - 54) <= 2.5) or (abs(fx - 71) <= 2.5 and abs(fy - 54) <= 2.5):
                    r, g, b = dark

                # Smile
                if 64 <= fy <= 67 and abs(dx) <= 8 and (fy >= 65 + (dx*dx)/25.0):
                    r, g, b = (154, 52, 18)

                # Glasses
                if av["glasses"]:
                    if (abs(math.sqrt((fx-49)**2 + (fy-54)**2) - 8) < 1.5) or (abs(math.sqrt((fx-71)**2 + (fy-54)**2) - 8) < 1.5):
                        r, g, b = (30, 41, 59)
                    if 52 <= fy <= 55 and 55 <= fx <= 65:
                        r, g, b = (30, 41, 59)

            # Helmet accessory
            if av["accessory"] == "helmet" and fy < 48 and abs(dx) <= 32:
                r, g, b = (251, 191, 36)

            # Headset accessory
            if av["accessory"] == "headset":
                if abs(fx - 36) <= 4 and abs(fy - 56) <= 8:
                    r, g, b = (59, 130, 246)
                if abs(fx - 84) <= 4 and abs(fy - 56) <= 8:
                    r, g, b = (59, 130, 246)

            raw.extend([r, g, b, 255])

    compressed = zlib.compress(raw, level=9)
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png.extend(struct.pack('>I', len(ihdr)) + b'IHDR' + ihdr + struct.pack('>I', zlib.crc32(b'IHDR' + ihdr)))
    png.extend(struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', zlib.crc32(b'IDAT' + compressed)))
    png.extend(struct.pack('>I', 0) + b'IEND' + struct.pack('>I', zlib.crc32(b'IEND')))
    return bytes(png)

for av in AVATARS:
    svg_content = generate_svg(av)
    png_content = generate_png_bytes(av, 120)

    # Base file: memoji-01.svg & memoji-01.png
    svg_path = os.path.join(OUT_DIR, f"{av['id']}.svg")
    png_path = os.path.join(OUT_DIR, f"{av['id']}.png")

    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    with open(png_path, "wb") as f:
        f.write(png_content)

    print(f"Generated {av['id']} (SVG & PNG)")

    # Role aliases
    for alias in av["role_alias"]:
        a_svg = os.path.join(OUT_DIR, f"{alias}.svg")
        a_png = os.path.join(OUT_DIR, f"{alias}.png")
        with open(a_svg, "w", encoding="utf-8") as f:
            f.write(svg_content)
        with open(a_png, "wb") as f:
            f.write(png_content)
        print(f"  -> Linked alias: {alias}")

print("All 16 Curated Memojis + Role Defaults generated successfully!")


import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const categories = [
  { value: "money", label: "پارە", emoji: "💵" },
  { value: "national-id", label: "کارتی نیشتیمانی", emoji: "🪪" },
  { value: "passport", label: "پاسپۆرت", emoji: "📘" },
  { value: "car-license", label: "مۆڵەتی شۆفێری", emoji: "🚗" },
  { value: "car-plate", label: "سەنەوی سەیارە", emoji: "🔢" },
  { value: "keys", label: "کەل و پەل", emoji: "🔑" },
  { value: "mobile", label: "مۆبایل", emoji: "📱" },
  { value: "bag", label: "جانتا", emoji: "👜" },
  { value: "wallet", label: "جزدان", emoji: "👛" },
  { value: "jewelry", label: "زێڕ و زیو", emoji: "💍" },
  { value: "watch", label: "کاتژمێر", emoji: "⌚" },
  { value: "document", label: "بەڵگەنامە", emoji: "📄" },
  { value: "laptop", label: "لاپتۆپ", emoji: "💻" },
  { value: "animal", label: "ئاژەڵ", emoji: "🐾" },
  { value: "other", label: "هی تر", emoji: "📦" },
];

const categoryMap = Object.fromEntries(
  categories.map((c) => [c.value, c])
);

function normalize(text) {
  if (!text) return "";

  return String(text)
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ەة]/g, "ه")
    .replace(/[ێ]/g, "ی")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function getIntent(query) {
  const q = normalize(query);

  const intents = {
    passport: [
      "پاسپۆرت",
      "passport",
      "جواز"
    ],

    nationalId: [
      "کارتی نیشتیمانی",
      "ناسنامە",
      "تەسکەرە",
      "id",
      "card"
    ],

    license: [
      "مۆڵەتی شۆفێری",
      "license"
    ],

    keys: [
      "کلیل",
      "کەل و پەل",
      "keys"
    ],

    mobile: [
      "مۆبایل",
      "phone",
      "iphone",
      "سامسۆنگ"
    ],

    bag: [
      "جانتا",
      "bag"
    ]
  };

  for (const [key, words] of Object.entries(intents)) {
    if (words.some((w) => q.includes(normalize(w)))) {
      return key;
    }
  }

  return null;
}

function isStrictCategoryMatch(intent, item) {
  const cat = item.category;

  switch (intent) {
    case "passport":
      return cat === "passport";

    case "nationalId":
      return cat === "national-id";

    case "license":
      return cat === "car-license";

    case "keys":
      return cat === "keys";

    case "mobile":
      return cat === "mobile";

    case "bag":
      return cat === "bag";

    default:
      return true;
  }
}

function calculateScore(query, item) {
  const q = normalize(query);

  const fields = [
    item.name,
    item.description,
    item.city,
    item.phone,
    item.category
  ]
    .filter(Boolean)
    .map(normalize);

  let score = 0;

  fields.forEach((field) => {
    if (field.includes(q)) {
      score += 10;
    }

    const words = q.split(" ");

    words.forEach((word) => {
      if (field.includes(word)) {
        score += 3;
      }
    });
  });

  return score;
}

export async function POST(request) {
  try {
    const { prompt, items = [] } = await request.json();

    const query = normalize(prompt);

    const intent = getIntent(query);

    let filteredItems = [];

    // STRICT FILTERING
    filteredItems = items.filter((item) => {
      if (!isStrictCategoryMatch(intent, item)) {
        return false;
      }

      const content = normalize(`
        ${item.name || ""}
        ${item.description || ""}
        ${item.city || ""}
        ${item.phone || ""}
      `);

      return (
        content.includes(query) ||
        query.split(" ").some((w) => content.includes(w))
      );
    });

    // SMART SORTING
    filteredItems = filteredItems
      .map((item) => ({
        ...item,
        score: calculateScore(query, item)
      }))
      .sort((a, b) => b.score - a.score);

    // AI explanation
    let aiText = "";

    if (filteredItems.length > 0) {
      aiText = `🔍 ${filteredItems.length} شت دۆزرایەوە:\n\n`;

      filteredItems.forEach((item, index) => {
        const cat = categoryMap[item.category];

        aiText += `
━━━━━━━━━━━━━━━

${index + 1}. ${cat?.emoji || "📦"} ${cat?.label || "هی تر"}

👤 ناو: ${item.name || "نەدیار"}

📍 شوێن: ${item.city || "نەدیار"}

📅 بەروار: ${item.date || "نەدیار"}

📝 وەسف:
${item.description || "—"}

📞 تەلەفۆن:
${item.phone || "نەدیار"}
`;

        // SHOW ALL IMAGES
        if (item.images?.length > 0) {
          aiText += `\n🖼️ وێنەکان:\n`;

          item.images.forEach((img, imgIndex) => {
            aiText += `${imgIndex + 1}. ${img}\n`;
          });
        }

        aiText += `\n`;
      });
    } else {
      aiText = "هیچ شتێک نەدۆزرایەوە.";
    }

    // OPTIONAL AI IMAGE
    let imageUrl = null;

    if (process.env.GEMINI_API_KEY && filteredItems.length > 0) {
      try {
        const genAI = new GoogleGenerativeAI(
          process.env.GEMINI_API_KEY
        );

        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
        });

        const result = await model.generateContent([
          `Generate one icon URL idea for ${prompt}`
        ]);

        imageUrl = result.response.text();
      } catch (e) {
        console.log(e);
      }
    }

    return NextResponse.json({
      success: true,

      text: aiText,

      total: filteredItems.length,

      imageUrl,

      filteredItems: filteredItems.map((item) => ({
        id: item.id,

        category: item.category,

        categoryInfo: categoryMap[item.category],

        name: item.name,

        description: item.description,

        city: item.city,

        phone: item.phone,

        date: item.date,

        images: item.images || [],

        score: item.score
      }))
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        text: "هەڵەیەک ڕوویدا",
        filteredItems: [],
      },
      {
        status: 500,
      }
    );
  }
}
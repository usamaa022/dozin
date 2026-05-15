import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
  try {
    const { prompt, items } = await request.json();

    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Debug logs
    console.log("=== DOZIN DEBUG START ===");
    console.log("1. Environment Keys Loaded:", {
      MISTRAL: MISTRAL_API_KEY ? "✅ LOADED" : "❌ MISSING",
      GEMINI: GEMINI_API_KEY ? "✅ LOADED" : "❌ MISSING"
    });
    console.log("2. Prompt Received:", prompt);
    console.log("3. Items Received From Frontend (Firebase):", items ? items.length : 0, "items");
    console.log("=== DOZIN DEBUG END ===");

    // Validate API keys
    if (!MISTRAL_API_KEY || !GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API keys not configured in .env.local" },
        { status: 500 }
      );
    }

    // Format items for Mistral's context
    const context = !items || items.length === 0
      ? "هیچ شتێکی تۆمارکراو نییە لە ئێستادا."
      : items.map((it, i) => {
          const cat = it.category || "هی تر";
          return [
            `#${i + 1}`,
            `جۆر: ${cat}`,
            `شار: ${it.city || "نەدیار"}`,
            `بەروار: ${it.date || "نەدیار"}`,
            `وەسف: ${it.description || "—"}`,
            it.name ? `ناو: ${it.name}` : null,
            `تەلەفۆن: ${it.phone || "نەدیار"}`,
          ].filter(Boolean).join(" | ");
        }).join("\n");

    // Call Mistral AI
    const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `تۆ یارمەتیدەری زیرەکی ئەپی "دۆزین" یت.
- هەمیشە بە کوردیی سۆرانی وەڵام بدەرەوە.
- ئەگەر بەکارهێنەر لەبارەی شتێکی ونبوو پرسی، لە لیستەکەدا بگەڕێ و شتە هاوشێوەکان پیشان بدە.
- ژمارەی تەلەفۆن و شاری هەر شتێکی دۆزراوە پیشان بدە.
- وەڵامەکەت بەسوود و ڕوون بێت.
- تەنها شتەکان پێداکراو پیشان بدە، هەر چەندەک وەک پێیامەک بێت.`
          },
          {
            role: "user",
            content: `لیستی شتە دۆزراوەکان:\n${context}\n\nپرسیاری بەکارهێنەر: ${prompt}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })
    });

    if (!mistralResponse.ok) {
      throw new Error(`Mistral API returned status: ${mistralResponse.status}`);
    }

    const mistralData = await mistralResponse.json();
    const aiText = mistralData.choices?.[0]?.message?.content?.trim() || "";

    // Generate image using Google Generative AI (if items are found)
    let imageUrl = null;
    if (aiText && !aiText.includes("نەدۆزرایەوە") && !aiText.includes("هیچ")) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([
          `Generate a simple icon-style image for a lost and found app in Kurdish context. The query was: ${prompt}. The found items are: ${aiText.substring(0, 500)}.`,
          "Return only the image URL, no text."
        ]);
        const response = await result.response;
        imageUrl = response.text().trim();
      } catch (imgError) {
        console.error("Image generation error:", imgError);
      }
    }

    return NextResponse.json({
      text: aiText,
      imageUrl: imageUrl || null
    });

  } catch (error) {
    console.error("AI Route Error Handler caught:", error);
    return NextResponse.json(
      { error: "کێشەیەک ڕویدا دووبارە هەوڵبدە" },
      { status: 500 }
    );
  }
}
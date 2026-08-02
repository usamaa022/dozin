'use client'
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPhoneAlt, FaPlus, FaTimes, FaMapMarkerAlt, FaCalendarAlt,
  FaCamera, FaChevronLeft, FaChevronRight, FaMicrophone,
  FaMicrophoneSlash, FaRobot, FaPaperPlane, FaCheck, FaSearch,
  FaTrash, FaGoogle // Added new icons
} from "react-icons/fa";
import { db, auth } from "@/firebase"; // Added auth
import { collection, addDoc, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";

// --- Design Tokens ---
const colors = {
  primary: "#2dd4bf",
  primaryDark: "#0d9488",
  secondary: "#3b82f6",
  dark: "#0f172a",
  light: "#f8fafc",
  white: "#ffffff",
  muted: "#94a3b8",
  border: "#e2e8f0",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b"
};

// --- Constants ---
const cities = [
  "سلێمانی", "عەربەت", "چەمچەماڵ", "هەڵەبجەی تازە",
  "هەڵەبجەی شەهید", "کۆیە", "کەلار", "ڕانیە", "قەڵادزێ",
  "هەولێر", "دهۆک", "زاخۆ"
];

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
  { value: "document", label: "مامەڵە / بەڵگەنامە", emoji: "📄" },
  { value: "laptop", label: "لاپتۆپ", emoji: "💻" },
  { value: "animal", label: "ئاژەڵ", emoji: "🐾" },
  { value: "other", label: "هی تر...", emoji: "📦" },
];

const categoryMap = Object.fromEntries(categories.map((c) => [c.value, c]));
const SIZE_LIMIT = 1 * 1024 * 1024; // 1MB

// --- Image Helpers ---
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
  });

const toGrayscaleBase64 = (file) =>
  new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const gray = 0.299 * data.data[i] + 0.587 * data.data[i+1] + 0.114 * data.data[i+2];
        data.data[i] = data.data[i+1] = data.data[i+2] = gray;
      }
      ctx.putImageData(data, 0, 0);
      URL.revokeObjectURL(url);
      res(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = rej;
    img.src = url;
  });

const processImageFile = async (file) => {
  if (file.size > SIZE_LIMIT) {
    return { preview: await toGrayscaleBase64(file), grayscale: true };
  }
  return { preview: await fileToBase64(file), grayscale: false };
};

// --- Lightbox ---
function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85 }}
        className="relative max-w-[95vw] max-h-[85vh] w-full bg-white/10 rounded-3xl p-2 backdrop-blur-md border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[idx]}
          alt=""
          className="w-full h-full object-contain rounded-2xl"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all backdrop-blur-sm"
            >
              <FaChevronLeft size={16} />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all backdrop-blur-sm"
            >
              <FaChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/80 text-indigo-900 px-3 py-1 rounded-full text-xs font-medium">
              {idx + 1} / {images.length}
            </div>
          </>
        )}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-all"
        >
          <FaTimes size={14} />
        </button>
      </motion.div>
    </motion.div>
  );
}

// --- Item Card (Updated with Delete functionality) ---
function ItemCard({ item, currentUser, onImageClick }) {
  const cat = categoryMap[item.category] || { label: item.category, emoji: "📦" };
  const imgs = (item.images || []).filter(Boolean);

  const handleDelete = async () => {
    if (window.confirm("دڵنیایت لە سڕینەوەی ئەم پۆستە؟")) {
      try {
        await deleteDoc(doc(db, "items", item.id));
      } catch (err) {
        console.error("Error deleting document:", err);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col"
    >
      {imgs.length > 0 ? (
        <div
          className="relative h-40 md:h-48 overflow-hidden bg-gray-50 cursor-pointer flex-shrink-0"
          onClick={() => onImageClick(imgs, 0)}
        >
          <img
            src={imgs[0]}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {imgs.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onImageClick(imgs, 1);
              }}
              className="absolute bottom-2 right-2 bg-white/90 text-indigo-900 text-xs font-medium px-2 py-1 rounded-full hover:bg-white transition-all"
            >
              +{imgs.length - 1} وێنە
            </button>
          )}
          <span className="absolute top-2 right-2 text-2xl drop-shadow-lg">{cat.emoji}</span>
        </div>
      ) : (
        <div className="h-20 md:h-24 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 text-4xl">
          {cat.emoji}
        </div>
      )}

      <div className="p-4 md:p-5 space-y-2 flex-1 flex flex-col justify-between">
        <div>
          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700 mb-1">
            {cat.label}
          </span>
          {item.name && <p className="font-bold text-base md:text-lg text-gray-900">{item.name}</p>}
          <p className="text-gray-600 text-xs md:text-sm leading-relaxed line-clamp-2 mt-1 mb-2">{item.description}</p>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500 mb-3">
            <span className="flex items-center gap-1">
              <FaMapMarkerAlt className="text-teal-500" /> {item.city}
            </span>
            <span className="flex items-center gap-1">
              <FaCalendarAlt className="text-teal-500" /> {item.date}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
          <span className="text-xs text-gray-500 font-mono">{item.phone}</span>
          <div className="flex items-center gap-2">
            {/* Show delete button only if current user owns the post */}
            {currentUser && currentUser.uid === item.ownerId && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDelete}
                className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 font-medium h-7 w-7 rounded-full transition-all text-xs"
                title="سڕینەوە"
              >
                <FaTrash size={11} />
              </motion.button>
            )}
            
            <motion.a
              href={`tel:${item.phone}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-medium py-1.5 px-3 rounded-full transition-all shadow-lg shadow-teal-500/30 text-xs"
            >
              <FaPhoneAlt size={12} /> پەیوەندی
            </motion.a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Upload Zone (Mobile-Optimized) ---
function UploadZone({ images, onAdd, onRemove, onView }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setUploading(true);
    const processed = await Promise.all(imgs.map(processImageFile));
    setUploading(false);
    onAdd(processed);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-4 md:p-6 text-center cursor-pointer transition-all duration-300 ${
          dragging
            ? "border-teal-400 bg-teal-50/50"
            : "border-gray-200 hover:border-teal-300 hover:bg-teal-50/20"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-teal-50 flex items-center justify-center">
            <FaCamera className="text-xl md:text-2xl text-teal-500" />
          </div>
          {uploading ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="animate-spin rounded-full h-5 w-5 border-3 border-teal-300 border-t-teal-600"></div>
              <p className="text-teal-600 font-medium text-sm">بارکردن...</p>
            </div>
          ) : (
            <>
              <p className="text-gray-700 font-medium text-sm md:text-base">وێنەیەک دابنێ</p>
              <p className="text-gray-500 text-xs">بۆ زۆرتر وێنە، بکەنەوە لەسەر ئەوەیەکە</p>
            </>
          )}
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden shadow-md">
              <img
                src={img.preview}
                alt=""
                className={`w-full h-full object-cover cursor-pointer ${
                  img.grayscale ? "grayscale brightness-90" : ""
                }`}
                onClick={() => onView(i)}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              {img.grayscale && (
                <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  گرێ
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all"
              >
                <FaTimes size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Filter Badge ---
function FilterBadge({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-teal-100 text-teal-700 shadow-sm"
          : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

// --- AI Panel ---
function AIPanel({ items, onClose, onFilterItems }) {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "سڵاو! من یارمەتیدەری زیرەکتم. پرسیارت بکە لەبارەی شتێکی ونبووت — دەتوانم لە لیستی شتە دۆزراوەکاندا بگەڕێم بۆت.",
      imageUrl: null,
      filteredItems: []
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;

    setInput("");
    setMessages((p) => [...p, { role: "user", text: q, imageUrl: null, filteredItems: [] }]);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mistral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          items: items.map((it) => ({
            id: it.id,
            category: categoryMap[it.category]?.label || it.category,
            city: it.city,
            date: it.date,
            description: it.description,
            name: it.name,
            phone: it.phone,
            images: it.images
          }))
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.text.includes("نەدۆزرایەوە") || data.text.includes("هیچ") || data.filteredItems.length === 0) {
        setMessages((p) => [...p, {
          role: "ai",
          text: data.text,
          imageUrl: null,
          filteredItems: []
        }]);
        onFilterItems([]);
      } else {
        setMessages((p) => [...p, {
          role: "ai",
          text: data.text,
          imageUrl: data.imageUrl,
          filteredItems: data.filteredItems
        }]);
        onFilterItems(data.filteredItems);
      }

    } catch (err) {
      console.error("AI Error:", err);
      setError("کێشەیەک ڕویدا دووبارە هەوڵبدە");
      setMessages((p) => [...p, {
        role: "ai",
        text: "ببورە، کێشەیەک ڕویدا. تکایە دووبارە هەوڵ بدە.",
        imageUrl: null,
        filteredItems: []
      }]);
      onFilterItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("بروزەری تۆ پشتگیری دەنگ ناکات.");
      return;
    }

    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = "ku-IQ";
    rec.interimResults = false;
    rec.onresult = (e) => {
      setListening(false);
      send(e.results[0][0].transcript);
    };
    rec.onerror = rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      className="fixed inset-x-2 bottom-2 z-50 flex flex-col rounded-3xl overflow-hidden bg-white shadow-2xl md:max-w-md md:mx-auto md:bottom-4 md:left-auto md:right-auto"
      style={{ maxHeight: "85vh" }}
    >
      {/* AI Panel content remains exactly the same as your code */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center">
            <FaRobot className="text-teal-600 text-lg" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">یارمەتیدەری زیرەک</p>
            <p className="text-xs text-gray-500">{items.length} شتی تۆمارکراو</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
        >
          <FaTimes size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-white" dir="rtl">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl whitespace-pre-wrap text-xs md:text-sm ${
                m.role === "user"
                  ? "bg-teal-50 text-teal-800 rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
              style={{ lineHeight: 1.5 }}
            >
              {m.text}
              {m.imageUrl && (
                <div className="mt-2 rounded-xl overflow-hidden shadow-md">
                  <img
                    src={m.imageUrl}
                    alt="Generated image"
                    className="w-full max-h-32 object-cover rounded-lg"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
              )}
              {m.filteredItems && m.filteredItems.length > 0 && (
                <div className="mt-2 p-2 bg-white rounded-lg shadow-sm">
                  <p className="text-xs font-medium text-teal-600 mb-1">
                    {m.filteredItems.length} شت دۆزرایەوە:
                  </p>
                  <div className="space-y-1">
                    {m.filteredItems.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="text-xs p-1 bg-gray-50 rounded">
                        <p className="font-medium">{item.name || categoryMap[item.category]?.label || 'نەدیار'}</p>
                        <p className="text-gray-500">{item.city} - {item.phone}</p>
                      </div>
                    ))}
                    {m.filteredItems.length > 3 && (
                      <p className="text-xs text-gray-500">+{m.filteredItems.length - 3} شتەکەی تر...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="px-3 py-2 bg-gray-100 rounded-2xl rounded-br-sm flex gap-1">
              {[0, 1, 2].map((d) => (
                <motion.div
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-teal-500"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.65, delay: d * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-red-50 text-red-600 rounded-2xl rounded-bl-sm text-xs">
              {error}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-white">
        <div className="flex gap-1.5" dir="rtl">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="پرسیارت بنووسە..."
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all text-sm"
            style={{ background: "#f8fafc", color: "#1e293b" }}
          />
          <button
            onClick={toggleVoice}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              listening
                ? "bg-red-100 text-red-500 border border-red-200"
                : "bg-teal-50 text-teal-600 border border-teal-200"
            }`}
          >
            {listening ? <FaMicrophoneSlash size={16} /> : <FaMicrophone size={16} />}
          </button>
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              !input.trim() || loading
                ? "bg-teal-100 text-teal-400 cursor-not-allowed"
                : "bg-teal-500 text-white hover:bg-teal-600"
            }`}
          >
            <FaPaperPlane size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- Post Form (Updated to attach ownerId) ---
function PostForm({ onDone, onCancel }) {
  const [formData, setFormData] = useState({
    category: "",
    city: "",
    description: "",
    phone: "",
    name: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [localImages, setLocalImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const set = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!formData.category) e.category = "جۆری شتەکە پێویستە";
    if (!formData.city) e.city = "شار دیاری بکە";
    if (!formData.description || formData.description.length < 10)
      e.description = "تکایە زانیاری زیاتر بنووسە";
    if (!formData.phone || formData.phone.length < 10)
      e.phone = "ژمارەی تەلەفۆنی خۆت پێویستە";
    if (!formData.date) e.date = "بەرواری پێویستە";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Get the user from Firebase Auth
      const currentUser = auth.currentUser;
      
      await addDoc(collection(db, "items"), {
        ...formData,
        images: localImages.map((i) => i.preview),
        createdAt: new Date().toISOString(),
        ownerId: currentUser ? currentUser.uid : null // <--- Bind post to User ID
      });
      onDone();
    } catch (err) {
      console.error(err);
      alert("کێشەیەک ڕویدا دووبارە هەوڵبدە");
    } finally {
      setLoading(false);
    }
  };

  const previews = localImages.map((i) => i.preview).filter(Boolean);

  const inputStyle = (hasError) => ({
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    fontSize: "14px",
    background: hasError ? "#fef2f2" : "#f8fafc",
    border: `1px solid ${hasError ? colors.error : colors.border}`,
    color: "#1e293b",
    outline: "none",
    fontFamily: "inherit",
    transition: "all 0.2s ease"
  });

  return (
    <>
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {/* Category */}
        <div>
          {errors.category && (
            <p className="text-red-500 text-xs mb-1.5">{errors.category}</p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => set("category", cat.value)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                  formData.category === cat.value
                    ? "border-teal-400 bg-teal-50"
                    : "border-gray-200 hover:border-teal-200 bg-white"
                }`}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-xs font-medium text-center text-gray-600">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* City */}
        <div>
          {errors.city && <p className="text-red-500 text-xs mb-1.5">{errors.city}</p>}
          <select
            value={formData.city}
            onChange={(e) => set("city", e.target.value)}
            style={inputStyle(errors.city)}
          >
            <option value="" className="text-gray-500 text-sm">
              شار دیاری بکە
            </option>
            {cities.map((c) => (
              <option key={c} value={c} className="text-gray-800 text-sm">
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          {errors.date && <p className="text-red-500 text-xs mb-1.5">{errors.date}</p>}
          <input
            type="date"
            value={formData.date}
            onChange={(e) => set("date", e.target.value)}
            style={inputStyle(errors.date)}
          />
        </div>

        {/* Name */}
        <input
          type="text"
          value={formData.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="ناوێک یان زانیاریەک هەیە؟ (ئارەزوومەندانە)"
          style={inputStyle(false)}
        />

        {/* Description */}
        <div>
          {errors.description && (
            <p className="text-red-500 text-xs mb-1.5">{errors.description}</p>
          )}
          <textarea
            value={formData.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="وەسفی شتی دۆزراوە (کوێ دۆزیتەوە، چ جۆرە...)"
            rows={3}
            style={{ ...inputStyle(errors.description), resize: "none" }}
          />
        </div>

        {/* Phone */}
        <div>
          {errors.phone && <p className="text-red-500 text-xs mb-1.5">{errors.phone}</p>}
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="ژمارەی تەلەفۆن"
            style={inputStyle(errors.phone)}
          />
        </div>

        {/* Images */}
        <div className="pt-1">
          <p className="text-gray-700 font-medium mb-2 text-sm">وێنەکان</p>
          <UploadZone
            images={localImages}
            onAdd={(n) => setLocalImages((p) => [...p, ...n])}
            onRemove={(i) => setLocalImages((p) => p.filter((_, idx) => idx !== i))}
            onView={(i) => setLightbox(i)}
          />
        </div>

        <div className="flex gap-3 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all text-sm"
          >
            پاشگەزبوونەوە
          </button>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                بارکردن...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <FaCheck size={12} /> تۆمارکردن
              </span>
            )}
          </motion.button>
        </div>
      </motion.form>

      <AnimatePresence>
        {lightbox !== null && previews.length > 0 && (
          <Lightbox
            images={previews}
            startIndex={Math.min(lightbox, previews.length - 1)}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// --- Splash Screen (Updated with Word-by-Word Animation) ---
function Splash({ onSelect }) {
  // Stagger configurations for the Arabic verse
  const verseContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15, // Delay between each word appearing
        delayChildren: 0.3,
      }
    }
  };

  const verseWord = {
    hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: "easeOut" } 
    }
  };

  // Splitting the verses into arrays of words
  const line1 = ["﴿", "إِنَّ", "اللَّهَ", "يَأْمُرُكُمْ", "أَن", "تُؤَدُّوا"];
  const line2 = ["الْأَمَانَاتِ", "إِلَىٰ", "أَهْلِهَا", "﴾"];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      dir="rtl"
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
      }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(45, 212, 191, 0.1) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ x: [0, -15, 0], y: [0, 10, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0, 0, 0, 0.02) 1px, transparent 1px)",
            backgroundSize: "25px 25px"
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center max-w-sm w-full space-y-6"
      >
        {/* Quran Verse with Word-by-word animation */}
        <div className="rounded-3xl p-4 bg-white/80 backdrop-blur-sm border border-teal-100 shadow-lg">
          <div className="flex items-center gap-1.5 mb-3 justify-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-teal-200" />
            <span className="text-teal-400 text-lg">✦</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-teal-200" />
          </div>
          
          <motion.div
            variants={verseContainer}
            initial="hidden"
            animate="visible"
            className="text-teal-700 text-2xl md:text-3xl leading-[2] font-medium flex flex-col items-center justify-center gap-2"
            style={{ fontFamily: "'Amiri', serif", direction: "rtl" }}
          >
            <div className="flex flex-wrap justify-center gap-x-2">
              {line1.map((word, i) => (
                <motion.span key={`l1-${i}`} variants={verseWord}>{word}</motion.span>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-x-2">
              {line2.map((word, i) => (
                <motion.span key={`l2-${i}`} variants={verseWord}>{word}</motion.span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2, duration: 1 }} // Appears after Arabic finishes
          >
            <p className="text-teal-500/80 text-xs md:text-sm mt-3">— سورة النساء: ٥٨ —</p>
            <p
              className="text-teal-600 text-xs md:text-sm mt-2 font-medium"
              style={{ fontFamily: "'NRT', sans-serif" }}
            >
              بێگومان خودا فەرمانتان پێدەکات کە ئەمانەتەکان بگێڕنەوە بۆ خاوەنەکانیان
            </p>
          </motion.div>
        </div>

        {/* Logo & Title */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.0, type: "spring", stiffness: 200 }}
        >
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-3xl flex items-center justify-center mb-3 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 shadow-lg">
            <span className="text-4xl">🔍</span>
          </div>
          <h1 className="font-black text-gray-900 mb-1" style={{ fontSize: 48, letterSpacing: "-0.02em" }}>
            دۆزین
          </h1>
          <p className="text-gray-600 text-sm md:text-base">بڵاوکردنەوەی شتی دۆزراوە · گەڕان بۆ شتی ونبوو</p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 8px 25px rgba(45, 212, 191, 0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect("find")}
            className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-2xl text-base md:text-lg transition-all shadow-lg shadow-teal-500/30"
          >
            📦 شتێکم دۆزیوەتەوە
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 8px 25px rgba(59, 130, 246, 0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect("lost")}
            className="flex-1 bg-white border-2 border-cyan-200 text-cyan-700 font-bold py-4 px-6 rounded-2xl text-base md:text-lg transition-all hover:bg-cyan-50"
          >
            🔎 شتێکم ونکردوە
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

// --- Main Component ---
export default function Home() {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchCategory, setSearchCategory] = useState("");
  const [searchCities, setSearchCities] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);
  
  // --- Auth State ---
  const [user, setUser] = useState(null);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsub; // Clean up listener on unmount
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  // Items Listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const toggleCity = (city) =>
    setSearchCities((p) => p.includes(city) ? p.filter((c) => c !== city) : [...p, city]);

  const handleAIFilter = (filteredItems) => {
    setFilteredItems(filteredItems);
    setSearchCategory("");
    setSearchCities([]);
  };

  const displayedItems = filteredItems.length > 0
    ? filteredItems
    : items.filter(
        (it) => (!searchCategory || it.category === searchCategory) &&
                (searchCities.length === 0 || searchCities.includes(it.city))
      );

  if (!mode) return <Splash onSelect={setMode} />;

  return (
    <div
      className="min-h-screen py-4 md:py-6"
      dir="rtl"
      style={{ background: "#f8fafc", fontFamily: "'NRT', sans-serif" }}
    >
      <div className="w-full md:w-[80%] max-w-6xl mx-auto px-2 md:px-0">
        
        {/* Header - Updated with Login/Logout logic */}
        <header className="sticky top-4 z-40 mb-4 md:mb-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-100 p-3 md:p-4">
            <div className="flex items-center justify-between">
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setMode(null); setShowForm(false); setFilteredItems([]); }}
                  className="text-xl md:text-2xl font-black text-gray-900 tracking-tight hover:text-teal-600 transition-colors"
                >
                  دۆزین
                </button>

                {/* Login Status & Buttons */}
                {user ? (
                  <button 
                    onClick={() => signOut(auth)}
                    className="text-xs font-medium text-gray-500 hover:text-red-500 transition-colors px-2 py-1"
                  >
                    چوونە دەرەوە
                  </button>
                ) : (
                  <button 
                    onClick={handleLogin}
                    className="flex items-center gap-1.5 text-xs font-bold bg-teal-50 text-teal-600 px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors"
                  >
                    <FaGoogle size={10} /> چوونە ژوورەوە
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 md:gap-2">
                <button
                  onClick={() => {
                    setMode("find");
                    setShowForm(false);
                    setFilteredItems([]);
                  }}
                  className={`px-3 py-1 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${
                    mode === "find"
                      ? "bg-teal-500 text-white shadow-lg shadow-teal-500/30"
                      : "bg-white text-gray-600 border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                  }`}
                >
                  📦 شتێکم دۆزیوەتەوە
                </button>
                <button
                  onClick={() => {
                    setMode("lost");
                    setShowForm(false);
                    setFilteredItems([]);
                  }}
                  className={`px-3 py-1 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${
                    mode === "lost"
                      ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                      : "bg-white text-gray-600 border-2 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50"
                  }`}
                >
                  🔎 شتێکم ونکردوە
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="space-y-4 md:space-y-6">
          {/* Post new item */}
          {mode === "find" && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              <AnimatePresence mode="wait">
                {showForm ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 md:p-6"
                  >
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FaPlus className="text-teal-500" /> تۆمارکردنی شتێکی دۆزراوە
                    </h2>
                    <PostForm
                      onDone={() => {
                        setShowForm(false);
                        setSuccess(true);
                        setTimeout(() => setSuccess(false), 4000);
                      }}
                      onCancel={() => setShowForm(false)}
                    />
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                      // Require Login to open the post form
                      if (user) {
                        setShowForm(true);
                      } else {
                        // Prompt login first
                        handleLogin();
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 md:py-5 text-teal-600 font-semibold text-base md:text-lg transition-all hover:bg-teal-50"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <FaPlus size={16} /> {user ? "تۆمارکردنی شتێکی دۆزراوە" : "چوونە ژوورەوە بۆ تۆمارکردن"}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Success toast */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full font-bold bg-teal-500 text-white shadow-lg text-sm"
              >
                <FaCheck size={14} /> بە سەرکەوتوویی تۆمار کرا!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters - only in lost mode */}
          {mode === "lost" && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-100 p-4 md:p-6 space-y-4">
              <div>
                <p className="font-bold text-base md:text-lg text-gray-900 mb-2 flex items-center gap-2">
                  <FaSearch className="text-teal-500" /> جۆری شت
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterBadge active={!searchCategory} onClick={() => setSearchCategory("")}>
                    ھەموو
                  </FilterBadge>
                  {categories.map((c) => (
                    <FilterBadge
                      key={c.value}
                      active={searchCategory === c.value}
                      onClick={() => setSearchCategory(c.value)}
                    >
                      {c.emoji} {c.label}
                    </FilterBadge>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100" />

              <div>
                <p className="font-bold text-base md:text-lg text-gray-900 mb-2">شار</p>
                <div className="flex flex-wrap gap-1.5">
                  {cities.map((city) => (
                    <FilterBadge
                      key={city}
                      active={searchCities.includes(city)}
                      onClick={() => toggleCity(city)}
                    >
                      {city}
                    </FilterBadge>
                  ))}
                </div>
              </div>

              {/* Active filters */}
              {(searchCategory || searchCities.length > 0 || filteredItems.length > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-2 items-center">
                  {filteredItems.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
                      <FaRobot size={10} /> {filteredItems.length} شت پێداکراو
                      <button onClick={() => setFilteredItems([])}>
                        <FaTimes size={10} className="text-cyan-500 hover:text-cyan-700" />
                      </button>
                    </span>
                  )}
                  {searchCategory && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                      {categoryMap[searchCategory]?.emoji} {categoryMap[searchCategory]?.label}
                      <button onClick={() => setSearchCategory("")}>
                        <FaTimes size={10} className="text-teal-500 hover:text-teal-700" />
                      </button>
                    </span>
                  )}
                  {searchCities.map((c) => (
                    <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                      {c}
                      <button onClick={() => toggleCity(c)}>
                        <FaTimes size={10} className="text-teal-500 hover:text-teal-700" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => { setSearchCategory(""); setSearchCities([]); setFilteredItems([]); }}
                    className="px-3 py-1 rounded-full text-xs font-medium text-red-500 hover:bg-red-50 border border-red-200 transition-colors"
                  >
                    پاككردنەوە
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stats + AI Button */}
          <div className="flex items-center justify-between px-1">
            <p className="text-gray-600 font-medium text-sm md:text-base">
              {displayedItems.length} شت {filteredItems.length > 0 ? "پێداکراو" : "دۆزرایەوە"}
            </p>
            {mode === "lost" && (
              <button
                onClick={() => setShowAI(true)}
                className="flex items-center gap-1.5 font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-full transition-all shadow-sm text-sm"
              >
                <FaRobot size={14} /> یارمەتی AI
              </button>
            )}
          </div>

          {/* Items Grid */}
          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
              {displayedItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currentUser={user} // Pass the currently logged-in user down to the card
                  onImageClick={(imgs, idx) => setLightbox({ images: imgs.filter(Boolean), idx })}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 md:py-20">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 rounded-3xl bg-teal-50 flex items-center justify-center">
                <span className="text-4xl">📭</span>
              </div>
              <p className="text-gray-500 text-base md:text-xl">
                {filteredItems.length > 0 ? "ببورە نەدۆزرایەوە" : "هیچ شتێک نییە"}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && lightbox.images.length > 0 && (
          <Lightbox
            images={lightbox.images}
            startIndex={Math.min(lightbox.idx, lightbox.images.length - 1)}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      {/* AI Panel */}
      <AnimatePresence>
        {showAI && (
          <AIPanel
            items={items}
            onClose={() => {
              setShowAI(false);
              setFilteredItems([]);
            }}
            onFilterItems={handleAIFilter}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
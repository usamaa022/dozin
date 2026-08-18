'use client'
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPhoneAlt, FaPlus, FaTimes, FaMapMarkerAlt, FaCalendarAlt,
  FaCamera, FaChevronLeft, FaChevronRight, FaCheck, FaSearch,
  FaTrash, FaGoogle, FaEdit, FaUser
} from "react-icons/fa";
import { db, auth } from "@/firebase";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy, limit } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";

// --- Design Tokens ---
const colors = {
  primary: "#2dd4bf",
  primaryDark: "#0d9488",
  secondary: "#3b82f6",
  dark: "#0f172a",
  light: "#f8fafc",
  white: "#ffffff",
  border: "#e2e8f0",
  success: "#22c55e",
  error: "#ef4444",
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

// --- Image Helpers (Compression for fast upload) ---
const processImageFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ preview: canvas.toDataURL("image/jpeg", 0.6), grayscale: false });
      };
    };
    reader.onerror = (error) => reject(error);
  });
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
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        className="relative max-w-full max-h-full w-full p-1 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={images[idx]} alt="" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
        {images.length > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 p-2 rounded-full backdrop-blur-md">
            <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white active:scale-90 transition-all">
              <FaChevronLeft size={16} />
            </button>
            <span className="text-white text-sm font-medium px-2">{idx + 1} / {images.length}</span>
            <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white active:scale-90 transition-all">
              <FaChevronRight size={16} />
            </button>
          </div>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-red-500 text-white shadow-lg active:scale-90 transition-all">
          <FaTimes size={16} />
        </button>
      </motion.div>
    </motion.div>
  );
}

// --- Item Card (Responsive for all screens) ---
function ItemCard({ item, currentUser, onImageClick, onEdit }) {
  const cat = categoryMap[item.category] || { label: item.category, emoji: "📦" };
  const imgs = (item.images || []).filter(Boolean);

  const handleDelete = async () => {
    if (window.confirm("دڵنیایت لە سڕینەوەی ئەم پۆستە؟")) {
      try { await deleteDoc(doc(db, "items", item.id)); } 
      catch (err) { console.error(err); }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100 flex flex-col h-full"
    >
      {imgs.length > 0 ? (
        <div className="relative h-48 md:h-56 w-full bg-gray-50 cursor-pointer shrink-0" onClick={() => onImageClick(imgs, 0)}>
          <img src={imgs[0]} alt="" className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          {imgs.length > 1 && (
            <span className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full pointer-events-none">
              +{imgs.length - 1} وێنە
            </span>
          )}
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-xl px-2 py-1 rounded-xl shadow-sm pointer-events-none">{cat.emoji}</span>
        </div>
      ) : (
        <div className="h-48 md:h-56 flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 text-6xl shrink-0">
          {cat.emoji}
        </div>
      )}

      <div className="p-4 md:p-5 flex flex-col flex-grow gap-2">
        <div className="flex justify-between items-start">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
            {cat.label}
          </span>
          <span className="text-xs text-gray-400 font-mono">{item.phone}</span>
        </div>
        
        {item.name && <h3 className="font-extrabold text-lg text-gray-900 leading-tight">{item.name}</h3>}
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">{item.description}</p>
        
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500 mt-1 mb-2">
          <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
            <FaMapMarkerAlt className="text-teal-500" /> {item.city}
          </span>
          <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
            <FaCalendarAlt className="text-teal-500" /> {item.date}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-3 mt-auto border-t border-gray-50">
          {currentUser && currentUser.uid === item.ownerId && (
            <div className="flex gap-2">
              <button onClick={() => onEdit(item)} className="h-11 w-11 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 active:scale-95 transition-all">
                <FaEdit size={16} />
              </button>
              <button onClick={handleDelete} className="h-11 w-11 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 active:scale-95 transition-all">
                <FaTrash size={14} />
              </button>
            </div>
          )}
          <a
            href={`tel:${item.phone}`}
            className="flex-1 flex items-center justify-center gap-2 h-11 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-md shadow-teal-500/30"
          >
            <FaPhoneAlt size={14} /> پەیوەندی کردن
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// --- Upload Zone ---
function UploadZone({ images, onAdd, onRemove, onView }) {
  const fileRef = useRef(null);
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
        onClick={() => fileRef.current?.click()}
        className="w-full border-2 border-dashed border-teal-200 bg-teal-50/30 hover:bg-teal-50 rounded-3xl p-6 text-center cursor-pointer active:scale-[0.98] transition-all"
      >
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600">
            <FaCamera size={24} />
          </div>
          {uploading ? (
            <p className="text-teal-600 font-bold text-sm mt-2 animate-pulse">ئامادەکردنی وێنەکان...</p>
          ) : (
            <p className="text-gray-700 font-bold text-sm mt-2">زیادکردنی وێنە</p>
          )}
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-gray-100 group">
              <img src={img.preview} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => onView(i)} />
              <button type="button" onClick={() => onRemove(i)} className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white active:scale-90 hover:bg-red-500 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <FaTimes size={12} />
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
      className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
        active
          ? "bg-teal-500 text-white shadow-md shadow-teal-500/30"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

// --- Post Form ---
function PostForm({ onDone, onCancel, editItem }) {
  const [formData, setFormData] = useState({
    category: editItem?.category || "",
    city: editItem?.city || "",
    description: editItem?.description || "",
    phone: editItem?.phone || "",
    name: editItem?.name || "",
    date: editItem?.date || new Date().toISOString().split("T")[0],
  });
  
  const [localImages, setLocalImages] = useState(
    editItem?.images ? editItem.images.map(img => ({ preview: img, grayscale: false })) : []
  );
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const set = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!formData.category) e.category = "جۆری شتەکە پێویستە";
    if (!formData.city) e.city = "شار دیاری بکە";
    if (!formData.description || formData.description.length < 10) e.description = "تکایە زانیاری زیاتر بنووسە";
    if (!formData.phone || formData.phone.length < 10) e.phone = "ژمارەی تەلەفۆن پێویستە";
    if (!formData.date) e.date = "بەرواری پێویستە";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      const dataToSave = {
        ...formData,
        images: localImages.map((i) => i.preview),
        updatedAt: new Date().toISOString()
      };
      if (editItem) {
        await updateDoc(doc(db, "items", editItem.id), dataToSave);
      } else {
        await addDoc(collection(db, "items"), {
          ...dataToSave,
          createdAt: new Date().toISOString(),
          ownerId: currentUser ? currentUser.uid : null
        });
      }
      onDone();
    } catch (err) {
      alert("کێشەیەک ڕویدا دووبارە هەوڵبدە");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasErr) => `w-full px-4 py-3.5 rounded-2xl text-sm transition-all outline-none border ${
    hasErr ? "bg-red-50 border-red-300 text-red-900" : "bg-gray-50 border-transparent hover:bg-gray-100 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/10 text-gray-800"
  }`;

  return (
    <>
      <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-5">
        
        <div>
          {errors.category && <p className="text-red-500 text-xs font-bold mb-2">{errors.category}</p>}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value} type="button" onClick={() => set("category", cat.value)}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 transition-all active:scale-95 ${
                  formData.category === cat.value ? "border-teal-500 bg-teal-50" : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-[10px] sm:text-xs font-bold text-center text-gray-700">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {errors.city && <p className="text-red-500 text-xs font-bold mb-1.5">{errors.city}</p>}
            <select value={formData.city} onChange={(e) => set("city", e.target.value)} className={inputClass(errors.city)}>
              <option value="">شار دیاری بکە...</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            {errors.date && <p className="text-red-500 text-xs font-bold mb-1.5">{errors.date}</p>}
            <input type="date" value={formData.date} onChange={(e) => set("date", e.target.value)} className={inputClass(errors.date)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {errors.phone && <p className="text-red-500 text-xs font-bold mb-1.5">{errors.phone}</p>}
            <input type="tel" value={formData.phone} onChange={(e) => set("phone", e.target.value)} placeholder="ژمارەی تەلەفۆن بۆ پەیوەندی" className={inputClass(errors.phone)} dir="ltr" style={{textAlign: 'right'}} />
          </div>
          
          <div>
            <input type="text" value={formData.name} onChange={(e) => set("name", e.target.value)} placeholder="ناونیشانی کورت (ئارەزوومەندانە)" className={inputClass(false)} />
          </div>
        </div>

        <div>
          {errors.description && <p className="text-red-500 text-xs font-bold mb-1.5">{errors.description}</p>}
          <textarea value={formData.description} onChange={(e) => set("description", e.target.value)} placeholder="زانیاری تەواو (ڕەنگ، شوێن، جۆر...)" rows={4} className={`${inputClass(errors.description)} resize-none`} />
        </div>

        <UploadZone images={localImages} onAdd={(n) => setLocalImages((p) => [...p, ...n])} onRemove={(i) => setLocalImages((p) => p.filter((_, idx) => idx !== i))} onView={(i) => setLightbox(i)} />

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCancel} className="w-1/3 py-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold active:scale-95 transition-all text-sm md:text-base">
            لابردن
          </button>
          <button type="submit" disabled={loading} className="w-2/3 py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold active:scale-95 transition-all disabled:opacity-70 text-sm md:text-base shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2">
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> : (editItem ? <FaEdit size={16} /> : <FaCheck size={16} />)}
            {editItem ? "نوێکردنەوە" : "بڵاوکردنەوە"}
          </button>
        </div>
      </motion.form>

      <AnimatePresence>
        {lightbox !== null && previews.length > 0 && <Lightbox images={previews} startIndex={Math.min(lightbox, previews.length - 1)} onClose={() => setLightbox(null)} />}
      </AnimatePresence>
    </>
  );
}

// --- Splash Screen ---
function Splash({ onSelect }) {
  const line1 = ["﴿", "إِنَّ", "اللَّهَ", "يَأْمُرُكُمْ", "أَن", "تُؤَدُّوا"];
  const line2 = ["الْأَمَانَاتِ", "إِلَىٰ", "أَهْلِهَا", "﴾"];
  
  const vContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } } };
  const vWord = { hidden: { opacity: 0, y: 10, filter: "blur(2px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5 } } };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-teal-50/50" dir="rtl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8">
        
        <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] border border-white shadow-xl shadow-teal-900/5">
          {/* Arabic Verse */}
          <motion.div variants={vContainer} initial="hidden" animate="visible" className="text-teal-800 text-2xl md:text-3xl leading-[2] text-center font-bold flex flex-col gap-2" style={{ fontFamily: "'Amiri', serif" }}>
            <div className="flex flex-wrap justify-center gap-1.5">{line1.map((w, i) => <motion.span key={i} variants={vWord}>{w}</motion.span>)}</div>
            <div className="flex flex-wrap justify-center gap-1.5">{line2.map((w, i) => <motion.span key={i} variants={vWord}>{w}</motion.span>)}</div>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
            className="flex items-center justify-center gap-3 my-5 md:my-6"
          >
            <div className="h-[2px] w-12 bg-gradient-to-r from-transparent to-teal-300 rounded-full"></div>
            <span className="text-teal-400 text-sm">✦</span>
            <div className="h-[2px] w-12 bg-gradient-to-l from-transparent to-teal-300 rounded-full"></div>
          </motion.div>

          {/* Kurdish Translation */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.8 }}
            className="text-center space-y-2.5"
          >
            <p className="text-slate-700 text-sm md:text-base font-bold leading-relaxed">
              بێگومان خودا فەرمانتان پێدەکات کە ئەمانەتەکان بگەڕێننەوە بۆ خاوەنەکانیان
            </p>
            <p className="text-teal-600/70 text-[11px] md:text-xs font-medium tracking-wide">
              — سوورەتی النساء، ئایەتی ٥٨ —
            </p>
          </motion.div>
        </div>

        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 2.0, type: "spring" }} className="text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-teal-400 to-cyan-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-teal-500/40 mb-4 text-white text-4xl">
            🔍
          </div>
          <h1 className="font-black text-slate-800 text-4xl mb-2 tracking-tight">دۆزین</h1>
          <p className="text-slate-900 text-md  font-medium">پلاتفۆرمی دۆزین، پردێکە بۆ گەیاندنەوەی شتە ونبووەکان بە خاوەنەکانیان 

</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }} className="flex flex-col gap-3">
          <button onClick={() => onSelect("find")} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20 text-lg">
            📦 شتێکم دۆزیوەتەوە
          </button>
          <button onClick={() => onSelect("lost")} className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-4 rounded-2xl active:scale-[0.98] transition-all shadow-lg border border-slate-100 text-lg">
            🔎 شتێکم ونکردوە
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

// --- Main App Component ---
export default function Home() {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState(null); 
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [searchCategory, setSearchCategory] = useState("");
  const [searchCities, setSearchCities] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (error) { console.error("Login failed", error); }
  };

  useEffect(() => {
    const q = query(collection(db, "items"), orderBy("createdAt", "desc"), limit(60));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const toggleCity = (city) =>
    setSearchCities((p) => p.includes(city) ? p.filter((c) => c !== city) : [...p, city]);

  let baseItems = items;
  if (mode === "my_posts" && user) {
    baseItems = items.filter(it => it.ownerId === user.uid);
  }

  const displayedItems = baseItems.filter(
    (it) => (!searchCategory || it.category === searchCategory) &&
            (searchCities.length === 0 || searchCities.includes(it.city))
  );

  const handleEdit = (item) => {
    setEditingItem(item);
    setMode("find");
    setShowForm(true);
  };

  if (!mode) return <Splash onSelect={setMode} />;

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl" style={{ fontFamily: "'NRT', sans-serif" }}>
      <div className="w-full max-w-7xl mx-auto pb-20">
        
        {/* Top App Bar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 px-4 py-3 md:py-4 flex justify-between items-center">
          <button onClick={() => { setMode(null); setShowForm(false); setEditingItem(null); }} className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">
            دۆزین
          </button>
          
          {user ? (
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={() => { setMode("my_posts"); setShowForm(false); setEditingItem(null); }}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all ${mode === "my_posts" ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                <FaUser className="inline ml-1" /> پۆستەکانم
              </button>
              <button onClick={() => { signOut(auth); setMode("lost"); }} className="p-2 text-slate-400 hover:text-red-500 text-sm md:text-base font-medium">
                چوونە دەرەوە
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-2 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-full shadow-md active:scale-95 transition-all">
              <FaGoogle size={14} /> چوونە ژوورەوە
            </button>
          )}
        </header>

        {/* Floating Action Tabs */}
        <div className="px-4 py-4 sticky top-[60px] md:top-[72px] z-30 bg-slate-50/95 backdrop-blur-md">
          <div className="flex max-w-sm mx-auto bg-slate-200/50 p-1 rounded-2xl">
            <button
              onClick={() => { setMode("find"); setShowForm(false); setEditingItem(null); }}
              className={`flex-1 py-2.5 rounded-xl text-sm md:text-base font-bold transition-all ${mode === "find" ? "bg-white text-teal-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              دۆزیوەتەوە
            </button>
            <button
              onClick={() => { setMode("lost"); setShowForm(false); setEditingItem(null); }}
              className={`flex-1 py-2.5 rounded-xl text-sm md:text-base font-bold transition-all ${mode === "lost" ? "bg-white text-cyan-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              ونبووەکان
            </button>
          </div>
        </div>

        <main className="px-4 space-y-6">
          
          {/* Form Container */}
          {mode === "find" && (
            <div className="max-w-3xl mx-auto mb-8">
              <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <AnimatePresence mode="wait">
                  {showForm ? (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 md:p-8">
                      <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                        {editingItem ? <FaEdit className="text-teal-500" size={24} /> : <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600"><FaPlus size={14} /></div>} 
                        {editingItem ? "دەستکاریکردنی پۆست" : "تۆمارکردنی شتی نوێ"}
                      </h2>
                      <PostForm editItem={editingItem} onCancel={() => { setShowForm(false); setEditingItem(null); }} onDone={() => { setShowForm(false); setEditingItem(null); setSuccess(true); setTimeout(() => setSuccess(false), 3000); }} />
                    </motion.div>
                  ) : (
                    <motion.button
                      key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => { user ? setShowForm(true) : handleLogin(); }}
                      className="w-full flex items-center justify-center gap-3 py-8 text-teal-600 font-bold text-lg md:text-xl active:bg-teal-50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center"><FaPlus size={20} /></div>
                      {user ? "زیادکردنی شتی نوێ" : "چوونە ژوورەوە بۆ زیادکردن"}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Success Toast */}
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full font-bold bg-slate-900 text-white shadow-2xl text-sm md:text-base">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white"><FaCheck size={10} /></div>
                سەرکەوتوو بوو!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          {(mode === "lost" || mode === "my_posts") && (
            <div className="space-y-4 pt-2">
              {mode === "my_posts" && <h3 className="text-xl md:text-2xl font-black text-slate-800 px-1 mb-4">پۆستەکانم</h3>}
              
              <div>
                <div className="flex overflow-x-auto md:flex-wrap md:justify-center gap-2 pb-2 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <FilterBadge active={!searchCategory} onClick={() => setSearchCategory("")}>ھەموو</FilterBadge>
                  {categories.map((c) => (
                    <FilterBadge key={c.value} active={searchCategory === c.value} onClick={() => setSearchCategory(c.value)}>
                      {c.emoji} {c.label}
                    </FilterBadge>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex overflow-x-auto md:flex-wrap md:justify-center gap-2 pb-2 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {cities.map((city) => (
                    <FilterBadge key={city} active={searchCities.includes(city)} onClick={() => toggleCity(city)}>{city}</FilterBadge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Items Grid */}
          <div className="pt-4">
            <p className="text-slate-500 font-bold text-sm md:text-base px-1 mb-4 md:mb-6">{displayedItems.length} شت دۆزرایەوە</p>
            
            {displayedItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {displayedItems.map((item) => (
                  <ItemCard key={item.id} item={item} currentUser={user} onEdit={handleEdit} onImageClick={(imgs, idx) => setLightbox({ images: imgs.filter(Boolean), idx })} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-slate-200 flex items-center justify-center text-5xl">📭</div>
                <p className="text-slate-400 font-medium text-xl">هیچ شتێک نەدۆزرایەوە</p>
              </div>
            )}
          </div>

        </main>
      </div>

      <AnimatePresence>
        {lightbox && lightbox.images.length > 0 && (
          <Lightbox images={lightbox.images} startIndex={Math.min(lightbox.idx, lightbox.images.length - 1)} onClose={() => setLightbox(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPhoneAlt } from "react-icons/fa";
import { db, storage } from "@/firebase";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// List of cities in Kurdish
const cities = [
  "سلێمانی",
  "چەمچەماڵ",
  "هەڵەبجەی تازە",
  "هەڵەبجەی شەهید",
  "هەولێر",
  "دهۆک",
  "ڕانیە",
  "قەڵادزێ",
  "کۆیە",
  "زاخۆ",
];

// Categories in Kurdish
const categories = [
  { value: "money", label: "پارە" },
  { value: "national-id", label: "کارتی نیشتیمانی" },
  { value: "passport", label: "پاسپۆرت" },
  { value: "car-license", label: "مۆڵەتی شۆفێری" },
  { value: "keys", label: "کەل و پەل" },
  { value: "mobile", label: "مۆبایل" },
  { value: "bag", label: "جانتا" },
  { value: "other", label: "هی تر..." },
];

export default function Home() {
  const [items, setItems] = useState([]);
  const [searchCategory, setSearchCategory] = useState("");
  const [searchCities, setSearchCities] = useState([]);
  const [formData, setFormData] = useState({
    category: "",
    city: "",
    description: "",
    phone: "",
    name: "",
    date: new Date().toISOString().split('T')[0],
    images: [],
  });
  const [errors, setErrors] = useState({});
  const [mode, setMode] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch items from Firebase with real-time updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "items"), (querySnapshot) => {
      const itemsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(itemsData);
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle image selection with size validation
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    let hasInvalidFile = false;

    for (const file of files) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit
        alert(`فایل "${file.name}" گەورەیە لە ۱ مەگابایت. تکایە فایلی کەمتر دیاری بکە.`);
        hasInvalidFile = true;
      } else {
        validFiles.push(file);
      }
    }

    if (!hasInvalidFile && validFiles.length > 0) {
      setFormData({ ...formData, images: validFiles });
    } else if (validFiles.length === 0) {
      // If all files were invalid, reset the images array
      setFormData({ ...formData, images: [] });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove an image
  const removeImage = (index) => {
    const updatedImages = [...formData.images];
    updatedImages.splice(index, 1);
    setFormData({ ...formData, images: updatedImages });
  };

  // Open full-screen image
  const openFullScreenImage = (image) => {
    setSelectedImage(image);
  };

  // Close full-screen image
  const closeFullScreenImage = () => {
    setSelectedImage(null);
  };

  // Toggle search city selection
  const toggleSearchCity = (city) => {
    const updatedCities = searchCities.includes(city)
      ? searchCities.filter((c) => c !== city)
      : [...searchCities, city];
    setSearchCities(updatedCities);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    if (!formData.category) newErrors.category = "جۆری شتەکە پێویستە";
    if (!formData.city) newErrors.city = "شار پێویستە";
    if (!formData.description || formData.description.length < 10)
      newErrors.description = "وەسف پێویستە (کەمەیەک ۱۰ پیت بێت)";
    if (!formData.phone || formData.phone.length < 10)
      newErrors.phone = "ژمارەی تەلەفۆن پێویستە";
    if (!formData.date) newErrors.date = "بەرواری دۆزینەوە پێویستە";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        // Upload images to Firebase Storage
        let imageUrls = [];
        if (formData.images.length > 0) {
          // Create an array of promises for each image upload
          const uploadPromises = formData.images.map(async (image) => {
            const storageRef = ref(storage, `images/${Date.now()}_${image.name}`);
            await uploadBytes(storageRef, image);
            const url = await getDownloadURL(storageRef);
            return url;
          });

          // Wait for all uploads to complete
          imageUrls = await Promise.all(uploadPromises);
        }

        // Add item to Firestore
        await addDoc(collection(db, "items"), {
          category: formData.category,
          city: formData.city,
          description: formData.description,
          phone: formData.phone,
          name: formData.name,
          date: formData.date,
          images: imageUrls,
        });

        // Reset form
        setFormData({
          category: "",
          city: "",
          description: "",
          phone: "",
          name: "",
          date: new Date().toISOString().split('T')[0],
          images: [],
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        alert("شتێکەکەت بە سەرکەوتوویی تۆمار کرا!");
        setShowForm(false);
      } catch (error) {
        console.error("Error adding item: ", error);
        let errorMessage = "هەڵەیەک ڕۆیدا. تکایە دووبارە هەوڵ بدە.";
        if (error.message.includes("too large")) {
          errorMessage = error.message;
        }
        alert(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Filter items
  const filteredItems = items.filter(
    (item) =>
      (!searchCategory || item.category === searchCategory) &&
      (searchCities.length === 0 || searchCities.includes(item.city))
  );

  // Toggle mode
  const toggleMode = (selectedMode) => {
    setMode(selectedMode);
    setShowForm(false);
  };

  // Render splash screen if no mode is selected
  if (mode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-800 mb-6" style={{ fontFamily: "'NRT', sans-serif" }}>
            دۆزین
          </h1>
          <p className="text-gray-600 mb-8" style={{ fontFamily: "'NRT', sans-serif" }}>
            بڵاوکردنەوەی شتی دۆزراوە - گەڕان بۆ شتی ونبوو
          </p>
          <div className="flex flex-col gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleMode("find")}
              className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium shadow hover:bg-blue-700 transition"
              style={{ fontFamily: "'NRT', sans-serif" }}
            >
              شتێکم دۆزیوەتەوە
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleMode("lost")}
              className="bg-gray-600 text-white py-3 px-6 rounded-lg font-medium shadow hover:bg-gray-700 transition"
              style={{ fontFamily: "'NRT', sans-serif" }}
            >
              شتێکم ونکردوە
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 relative" dir="rtl" style={{ fontFamily: "'NRT', sans-serif" }}>
      {/* Floating mode toggle button */}
      <motion.button
        onClick={() => toggleMode(mode === "find" ? "lost" : "find")}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{ fontFamily: "'NRT', sans-serif" }}
      >
        {mode === "find" ? "شتێکم ون کردوە" : "شتێکم دۆزیوەتەوە"}
      </motion.button>

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {mode === "find" ? "تۆمارکردنی شتێکی دۆزراوە" : "گەڕان بۆ شتێک ونبوو"}
        </h1>
        <p className="text-gray-600">
          {mode === "find"
            ? "پێغەمبەری خوا درودی خوای لەسەر بێت دەفەرموێت:"
            : "پێغەمبەری خوا درودی خوای لەسەر بێ دەفەرموێت:"}
        </p>
      </div>

      {/* Post Form (Find Mode) */}
      {mode === "find" && (
        <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md mb-8">
          <AnimatePresence>
            {showForm ? (
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* Category Dropdown */}
                <div>
                  {errors.category && <p className="text-red-500 text-sm mb-1">{errors.category}</p>}
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.category ? "border-red-500" : "border-gray-300"}`}
                  >
                    <option value="" className="text-gray-500">جۆری شتەکە دیاری بکە</option>
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value} className="text-gray-800">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City Dropdown */}
                <div>
                  {errors.city && <p className="text-red-500 text-sm mb-1">{errors.city}</p>}
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.city ? "border-red-500" : "border-gray-300"}`}
                  >
                    <option value="" className="text-gray-500">شار دیاری بکە</option>
                    {cities.map((city) => (
                      <option key={city} value={city} className="text-gray-800">
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Input */}
                <div>
                  {errors.date && <p className="text-red-500 text-sm mb-1">{errors.date}</p>}
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.date ? "border-red-500" : "border-gray-300"}`}
                  />
                </div>

                {/* Name Input */}
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="ناوی لەسەر شتەک (ئەگەر هەیە)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
                />

                {/* Description Textarea */}
                <div>
                  {errors.description && <p className="text-red-500 text-sm mb-1">{errors.description}</p>}
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="وەسفێک بەخێراوە (مێسۆڵە: لە بەردەم نەخۆشخانەی شار دۆزیمەوە)"
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.description ? "border-red-500" : "border-gray-300"} text-gray-800 placeholder-gray-500`}
                    rows="3"
                  />
                </div>

                {/* Phone Input */}
                <div>
                  {errors.phone && <p className="text-red-500 text-sm mb-1">{errors.phone}</p>}
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="ژمارەی تەلەفۆنەکەت"
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.phone ? "border-red-500" : "border-gray-300"} text-gray-800 placeholder-gray-500`}
                  />
                </div>

                {/* Image Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    multiple
                    accept="image/*"
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <p className="text-gray-600 mb-2">
                      وێنەی شتە دۆزراوەکە دابنێ
                    </p>
                    <p className="text-sm text-gray-500">
                      (دەتوانیت وێنەیەک یان زیاتر بار بکەیت، پێویستە کەمتر لە ۱ مەگابایت بێت)
                    </p>
                  </label>
                  {formData.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={typeof image === 'string' ? image : URL.createObjectURL(image)}
                            alt={`Preview ${index}`}
                            className="w-20 h-20 object-cover rounded-lg cursor-pointer"
                            onClick={() => openFullScreenImage(typeof image === 'string' ? image : URL.createObjectURL(image))}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex gap-4">
                  <motion.button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    پاشگەزبوونەوە
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoading ? "لە چالاکی..." : "تۆمارکردن"}
                  </motion.button>
                </div>
              </motion.form>
            ) : (
              <motion.button
                onClick={() => setShowForm(true)}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium shadow hover:bg-blue-700 transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                + تۆمارکردنی شتێکی دۆزراوە
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Search & Filter (Lost Mode) */}
      {mode === "lost" && (
        <div className="max-w-4xl mx-auto mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            گەڕان بۆ شتێک ونبوو
          </h2>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Category Dropdown */}
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
            >
              <option value="" className="text-gray-500">ھەموو جۆرەکان</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value} className="text-gray-800">
                  {cat.label}
                </option>
              ))}
            </select>

            {/* City Filter */}
            <div className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 flex-1">
              <p className="text-sm text-gray-600 mb-1">
                فێلترکردن لەگەڵ شارەکان:
              </p>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <button
                    type="button"
                    key={city}
                    onClick={() => toggleSearchCity(city)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      searchCities.includes(city)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List of Items */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition"
            >
              {/* Images */}
              <div className="mb-4">
                {item.images && item.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {item.images.slice(0, 2).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Item ${index}`}
                        className="w-full h-24 object-cover rounded-lg cursor-pointer"
                        onClick={() => openFullScreenImage(image)}
                      />
                    ))}
                    {item.images.length > 2 && (
                      <div
                        className="w-full h-24 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer"
                        onClick={() => openFullScreenImage(item.images[0])}
                      >
                        <p className="text-gray-600">
                          +{item.images.length - 2} وێنەی زیاتر
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Item Details */}
              <div className="p-2">
                <h3 className="font-semibold text-lg text-gray-800 capitalize">
                  {categories.find(cat => cat.value === item.category)?.label || item.category}
                </h3>
                {item.name && (
                  <p className="text-gray-700 mb-1">
                    ناو: {item.name}
                  </p>
                )}
                <p className="text-gray-600 mb-1">
                  شار: {item.city}
                </p>
                <p className="text-gray-600 mb-1">
                  بەرواری دۆزینەوە: {item.date}
                </p>
                <p className="text-gray-700 mb-3">
                  {item.description}
                </p>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    پەیوەندی: {item.phone}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="bg-blue-600 text-white text-sm py-1 px-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
                  >
                    <FaPhoneAlt /> پەیوەندی
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <p className="text-gray-600 text-center col-span-full">هیچ شتێکەک نییە.</p>
        )}
      </div>

      {/* Full-screen image modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={closeFullScreenImage}
        >
          <motion.img
            src={selectedImage}
            alt="Full screen"
            className="max-w-full max-h-full object-contain"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          />
        </div>
      )}
    </div>
  );
}

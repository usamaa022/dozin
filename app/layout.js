// app/layout.js
import "./globals.css";

export const metadata = {
  title: "دۆزین - Dozin",
  description: "بڵاوکردنەوەی شتی دۆزراوە · گەڕان بۆ شتی ونبوو",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ku" dir="rtl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
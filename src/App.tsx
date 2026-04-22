/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Scissors, 
  CheckCircle2, 
  ChevronRight, 
  Loader2, 
  User, 
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// UI Constants - Bright & Optimistic Aesthetic
const THEME = {
  bg: 'bg-[#F8FAFC]', // Light slate background
  card: 'bg-white',
  accent: 'text-[#0EA5E9]', // Bright blue
  accentBg: 'bg-[#0EA5E9]',
  muted: 'text-[#64748B]',
  border: 'border-[#E2E8F0]',
  fontSans: 'font-sans',
  fontDisplay: 'font-sans font-extrabold tracking-tight',
  body: 'text-[#1E293B]',
};

interface Hairstyle {
  name: string;
  description: string;
  reason: string;
  imageUrl?: string;
}

type Gender = 'male' | 'female';

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Hairstyle[]>([]);
  const [activeStyleIndex, setActiveStyleIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [faceAnalysis, setFaceAnalysis] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>('male');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setResults([]);
        setFaceAnalysis(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startAnalysis = async () => {
    if (!image) return;

    setAnalyzing(true);
    setError(null);

    const count = 5;

    try {
      const base64Data = image.split(',')[1];

      // Step 1: Analyze face and suggest top styles
      const analysisResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
            { text: `Ты эксперт-парикмахер и стилист. Проанализируй фото это${gender === 'female' ? 'й женщины' : 'го мужчины'}. 
            Учти форму головы, лица, текущую длину и тип волос. Предложи ТОП-${count} идеальных ${gender === 'female' ? 'женских' : 'мужских'} причесок.
            Важно: мы хотим видеть ПОЛНУЮ голову и прическу, а не только лицо крупным планом. 
            Верни ответ строго в формате JSON:
            {
              "analysis": "краткое описание формы лица и особенностей",
              "styles": [
                {
                  "name": "Название прически на русском",
                  "description": "Краткое описание стиля",
                  "reason": "Почему она подходит именно это${gender === 'female' ? 'й женщине' : 'му человеку'}"
                }
              ]
            }` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: { type: Type.STRING },
              styles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const analysisData = JSON.parse(analysisResponse.text || '{}');
      setFaceAnalysis(analysisData.analysis);
      const suggestedStyles = (analysisData.styles || []).slice(0, count);

      // Step 2: Generate visual previews for each style in parallel
      const stylesWithImages = await Promise.all(suggestedStyles.map(async (style: any) => {
        try {
          const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
                { text: `Apply the hairstyle "${style.name}" to the person in the photo. 
                CRITICAL: Show the ENTIRE HEAD, hair and shoulders. Do not crop to just the face. 
                Maintain the person's exact identity and facial features. 
                The hairstyle must be ${gender === 'female' ? 'feminine' : 'masculine'}.
                The shot should be a medium portrait showing the full haircut/style correctly positioned on their head. 
                Natural, bright daytime lighting in a clean modern beauty salon.` }
              ]
            }
          });

          let styleImageUrl = "";
          for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              styleImageUrl = `data:image/png;base64,${part.inlineData.data}`;
            }
          }

          return {
            ...style,
            imageUrl: styleImageUrl || "https://picsum.photos/seed/hair/800/800"
          };
        } catch (imgErr) {
          console.error("Image generation failed for style", style.name, imgErr);
          return {
            ...style,
            imageUrl: `https://picsum.photos/seed/${style.name}/800/800`
          };
        }
      }));

      setResults(stylesWithImages);
      setActiveStyleIndex(0);
    } catch (err) {
      console.error(err);
      setError("Произошла ошибка при анализе. Пожалуйста, попробуйте другое фото.");
    } finally {
      setAnalyzing(false);
    }
  };

  const activeStyle = results[activeStyleIndex];

  return (
    <div className={`min-h-screen ${THEME.bg} ${THEME.body} ${THEME.fontSans} selection:bg-sky-200 overflow-x-hidden`}>
      {/* Navbar */}
      <nav className={`h-16 bg-white border-b ${THEME.border} px-6 flex items-center justify-between sticky top-0 z-50`}>
        <div className="flex items-center gap-2">
          <div className={`${THEME.accentBg} p-1.5 rounded-lg`}>
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Barber<span className={THEME.accent}>Style</span></span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setResults([]); setImage(null); }}
            className={`flex items-center gap-2 text-sm font-semibold ${THEME.accent} hover:bg-sky-50 px-4 py-2 rounded-full transition-colors`}
          >
            <RefreshCw className="w-4 h-4" /> Начать заново
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!results.length && !analyzing ? (
          <div className="max-w-3xl mx-auto text-center space-y-12">
            <div>
              <h1 className={`${THEME.fontDisplay} text-4xl md:text-5xl lg:text-7xl mb-6`}>
                Твой новый стиль <br /> начинается <span className={THEME.accent}>здесь</span>
              </h1>
              <p className={`${THEME.muted} text-lg max-w-xl mx-auto`}>
                Загрузи фото, выбери свой пол, и наш ИИ продемонстрирует идеальные варианты стрижек и укладок.
              </p>
            </div>

            {/* Gender Selector */}
            <div className="flex justify-center gap-4 p-2 bg-white rounded-3xl border border-slate-200 w-fit mx-auto shadow-sm">
              <button 
                onClick={() => setGender('male')}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold transition-all ${gender === 'male' ? 'bg-sky-500 text-white shadow-lg shadow-sky-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Мужчина
              </button>
              <button 
                onClick={() => setGender('female')}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold transition-all ${gender === 'female' ? 'bg-pink-500 text-white shadow-lg shadow-pink-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Женщина
              </button>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative h-96 rounded-[2.5rem] bg-white border-2 border-dashed ${THEME.border} hover:border-sky-400 transition-all cursor-pointer group flex flex-col items-center justify-center overflow-hidden shadow-sm`}
            >
              <AnimatePresence>
                {image ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-full relative"
                  >
                    <img src={image} alt="Upload" className="w-full h-full object-contain p-4" />
                    <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <span className={`font-bold ${gender === 'female' ? 'text-pink-600' : 'text-sky-600'} flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-lg`}>
                         <RefreshCw className="w-5 h-5" /> Сменить фото
                       </span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className={`w-16 h-16 ${gender === 'female' ? 'bg-pink-50' : 'bg-sky-50'} rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform`}>
                      {gender === 'female' ? <Sparkles className="w-8 h-8 text-pink-500" /> : <Camera className={`w-8 h-8 ${THEME.accent}`} />}
                    </div>
                    <div>
                      <p className="text-xl font-bold">Загрузите фото</p>
                      <p className={THEME.muted}>Для подбора ТОП-5 причесок</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
            </div>

            {image && (
              <button 
                onClick={startAnalysis}
                className={`py-5 px-12 rounded-full font-bold text-lg transition-all flex items-center gap-3 mx-auto ${gender === 'female' ? 'bg-pink-500 text-white shadow-xl shadow-pink-200' : 'bg-sky-500 text-white shadow-xl shadow-sky-200'} hover:scale-105 active:scale-95`}
              >
                <Sparkles className="w-6 h-6" /> Подобрать прически
              </button>
            )}
          </div>
        ) : null}

        {analyzing && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 border-4 border-sky-100 border-t-sky-500 rounded-full"
              />
              <Scissors className="w-8 h-8 text-sky-500 absolute inset-0 m-auto animate-bounce" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Стрижем нейросетью...</h2>
              <p className={THEME.muted}>Анализируем форму головы и черты лица</p>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 flex items-center gap-3 shadow-sm">
            <Info className="w-5 h-5" /> {error}
          </div>
        )}

        {results.length > 0 && !analyzing && activeStyle && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* Header Result */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-4xl font-black tracking-tight">{activeStyle.name}</h2>
                <p className={`${THEME.accent} font-semibold uppercase text-xs tracking-widest mt-1`}>Топ-5 лучших вариантов</p>
              </div>
              <div className="bg-white px-6 py-4 rounded-3xl border border-sky-100 shadow-sm max-w-lg">
                <p className="text-sm italic leading-relaxed text-slate-600">
                  <span className="font-bold text-sky-500">Анализ:</span> {faceAnalysis}
                </p>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[500px]">
              <div className="relative rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 shadow-2xl group">
                <img src={image!} alt="Original" className="w-full h-full object-contain p-4" />
                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur px-4 py-1.5 rounded-full shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#64748B]">ДО</span>
                </div>
              </div>
              <div className="relative rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 shadow-2xl group ring-4 ring-sky-500/20">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={activeStyle.imageUrl}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    src={activeStyle.imageUrl} 
                    alt="After" 
                    className="w-full h-full object-contain p-4"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>
                <div className="absolute top-6 left-6 bg-sky-500 px-4 py-1.5 rounded-full shadow-sm text-white">
                  <span className="text-xs font-bold uppercase tracking-widest">ПОСЛЕ</span>
                </div>
                <div className="absolute bottom-10 right-10 bg-white/90 backdrop-blur p-6 rounded-3xl shadow-xl border border-sky-50 max-w-xs">
                  <p className="text-sm font-bold text-slate-800 mb-1 leading-tight">{activeStyle.description}</p>
                  <p className="text-xs text-slate-500 leading-snug">{activeStyle.reason}</p>
                </div>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="space-y-6">
              <h4 className="text-lg font-bold flex items-center gap-2">
                <Scissors className="w-5 h-5 text-sky-500" /> Другие варианты для Вас
              </h4>
              <div className="flex flex-wrap gap-4">
                {results.map((style, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStyleIndex(idx)}
                    className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all text-left bg-white shadow-sm hover:shadow-md ${activeStyleIndex === idx ? 'border-sky-500 ring-4 ring-sky-500/10' : 'border-[#E2E8F0]'}`}
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                      <img src={style.imageUrl} alt={style.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="pr-4">
                      <p className="font-bold text-sm">{style.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Вариант {idx + 1}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <footer className="py-20 text-center border-t border-slate-100 bg-white mt-20">
        <div className="flex justify-center items-center gap-2 opacity-30 mb-4">
          <Scissors className="w-4 h-4" />
          <span className="font-bold tracking-widest uppercase text-xs">BarberStyle AI</span>
        </div>
        <p className="text-xs text-slate-400">© 2026 Современные технологии стиля</p>
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bus, 
  MapPin, 
  Camera, 
  ShieldAlert, 
  Navigation, 
  Users, 
  Clock, 
  Search, 
  ChevronRight, 
  Info,
  ArrowLeft,
  Map as MapIcon,
  Ticket,
  Languages,
  Layout,
  History,
  Home,
  Bed,
  Star,
  Utensils,
  Route as RouteIcon,
  AlertCircle,
  Video,
  CheckCircle2,
  PhoneCall,
  Lock,
  X,
  User,
  Chrome,
  Facebook,
  Globe,
  Filter,
  ArrowUpDown,
  Trophy,
  Puzzle,
  Gift,
  Crown,
  Gamepad2,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";

import { mockBuses, mockLandmarks, mockRooms, type BusRoute, type Landmark, type Room } from './data/mockData';
import { translations, type Language } from './i18n/translations';
import { generateTouristContent, generateItinerary, getSafetyProtocol } from './services/gemini';

import { NammaRouteLogo } from './components/NammaRouteLogo';
import { cn } from './lib/utils';

type Screen = 'home' | 'bus-details' | 'tourist-mode' | 'itinerary' | 'safety' | 'rooms' | 'auth' | 'offline-maps' | 'puzzle-challenge';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('auth');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Auth State
  const [authStep, setAuthStep] = useState<'mobile' | 'otp' | 'profile'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [showSmsPopup, setShowSmsPopup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [selectedBus, setSelectedBus] = useState<BusRoute | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedLandmark, setScannedLandmark] = useState<Landmark | null>(null);
  const [aiContent, setAiContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [downloadedRegions, setDownloadedRegions] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [touristModeView, setTouristModeView] = useState<'camera' | 'list'>('camera');
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedCityForMap, setSelectedCityForMap] = useState<string | null>(null);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [activeDeck, setActiveDeck] = useState<'lower' | 'upper'>('lower');
  const [busType, setBusType] = useState<'seater' | 'sleeper'>('seater');
  const [filterOrigin, setFilterOrigin] = useState<string | null>(null);
  const [filterDestination, setFilterDestination] = useState<string | null>(null);
  const [sortByEta, setSortByEta] = useState(false);
  
  // Live Location State
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Puzzle Challenge State
  const [unlockedBlocks, setUnlockedBlocks] = useState<number[]>([0, 1, 4, 5, 8, 9, 12, 13, 16, 17]); // Initial unlocked blocks
  const [points, setPoints] = useState(1250);
  const [showRewardClaimed, setShowRewardClaimed] = useState(false);
  const [triviaAnswered, setTriviaAnswered] = useState<string | null>(null);
  const [isLiveAssistantActive, setIsLiveAssistantActive] = useState(false);
  const [isAssistantListening, setIsAssistantListening] = useState(false);

  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  // Safety Report State
  const [safetyReportType, setSafetyReportType] = useState<string | null>(null);
  const [reportMedia, setReportMedia] = useState<string | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const t = translations[language];

  const videoRef = useRef<HTMLVideoElement>(null);

  // Voice Assistant Logic
  const stopLiveAssistant = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsLiveAssistantActive(false);
    setIsAssistantListening(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  const playNextInQueue = async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      return;
    }

    isPlayingRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    
    const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextInQueue();
    };
    source.start();
  };

  const startLiveAssistant = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are Namba Route's accessibility assistant for blind and visually impaired users. 
          Your goal is to help them navigate the app and get real-time transit information.
          Current context:
          - Language: ${language}
          - Current Location: ${currentLocation ? `Lat: ${currentLocation.lat}, Lng: ${currentLocation.lng}` : 'Unknown (using Chennai as default)'}
          - Available buses: ${JSON.stringify(mockBuses.map(b => ({ number: b.number, origin: b.origin, destination: b.destination, eta: b.eta })))}
          - Available landmarks: ${JSON.stringify(mockLandmarks.map(l => l.name))}
          
          Provide clear, concise, and descriptive audio guidance. Use a helpful and calm tone. 
          If they ask about a bus, tell them the ETA and route. 
          If they ask where they are, use their current coordinates if available, otherwise use Chennai.
          Always confirm actions with voice.`,
        },
        callbacks: {
          onopen: () => {
            setIsLiveAssistantActive(true);
            setIsAssistantListening(true);
            
            // Setup audio capture
            const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              session.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'audio/pcm;rate=24000' }
              });
            };
            
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcmData = new Int16Array(bytes.buffer);
              audioQueueRef.current.push(pcmData);
              playNextInQueue();
            }
            
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onclose: () => stopLiveAssistant(),
          onerror: (e) => {
            console.error("Live Assistant Error:", e);
            stopLiveAssistant();
          }
        }
      });

      liveSessionRef.current = session;
    } catch (error) {
      console.error("Failed to start Live Assistant:", error);
      setToast("Microphone access required for voice assistant.");
      setToastType("error");
    }
  };

  useEffect(() => {
    return () => stopLiveAssistant();
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationError(error.message);
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationError("Geolocation not supported");
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const handleScan = async () => {
    setIsLoading(true);
    // Simulate scanning logic - pick a random landmark for demo
    const landmark = mockLandmarks[Math.floor(Math.random() * mockLandmarks.length)];
    setScannedLandmark(landmark);
    const content = await generateTouristContent(landmark.name, language);
    setAiContent(content || '');
    setIsLoading(false);
  };

  const handleSelectLandmark = async (landmark: Landmark) => {
    setIsLoading(true);
    setScannedLandmark(landmark);
    const content = await generateTouristContent(landmark.name, language);
    setAiContent(content || '');
    setIsLoading(false);
    setTouristModeView('camera');
  };

  const handleItinerary = async (city: string) => {
    setIsLoading(true);
    setActiveScreen('itinerary');
    const content = await generateItinerary(city, language);
    setAiContent(content || '');
    setIsLoading(false);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReportMedia(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSafetyAlert = async () => {
    if (confirm("Are you sure you want to send an anonymous safety alert? This will bundle your GPS data and notify local authorities.")) {
      setIsLoading(true);
      const protocol = await getSafetyProtocol({ lat: 13.0827, lng: 80.2707 }, safetyReportType || "General Safety Concern");
      setReportSubmitted(true);
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    if (authStep !== 'profile') {
      showToast("Security check failed. Please verify OTP.", 'error');
      setAuthStep('mobile');
      return;
    }
    if (isForgotPassword) {
      showToast(t.passwordResetSuccess, 'success');
      setIsForgotPassword(false);
    }
    setIsLoggedIn(true);
    setActiveScreen('home');
  };

  const handleSocialLogin = (provider: string) => {
    showToast(`${provider} login is currently unavailable. Please use Mobile OTP for secure access.`, 'error');
  };

  const handleDownloadMap = (region: string) => {
    setIsDownloading(region);
    setTimeout(() => {
      setDownloadedRegions(prev => [...prev, region]);
      setIsDownloading(null);
      showToast(`${t.mapDownloaded} ${region}`, 'success');
    }, 2000);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(null), 3000);
  };

  const verifyOTP = () => {
    if (otp === generatedOtp) {
      showToast(t.otpVerified, 'success');
      if (isForgotPassword) {
        setAuthStep('profile'); // We'll reuse profile step or make a specific reset one
      } else {
        setAuthStep('profile');
      }
    } else {
      showToast(t.invalidOtp, 'error');
      setOtp(''); // Clear input on error
    }
  };

  const handleSendOTP = () => {
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(newOtp);
    showToast(`${t.otpSent} ${mobileNumber}`);
    setAuthStep('otp');
    setResendTimer(60);
    setCanResend(false);
    
    // Show simulated SMS popup after a short delay
    setTimeout(() => {
      setShowSmsPopup(true);
      // Auto hide after 8 seconds
      setTimeout(() => setShowSmsPopup(false), 8000);
    }, 1000);
  };

  const handleResendOTP = () => {
    if (!canResend) return;
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(newOtp);
    showToast(`${t.otpSent} ${mobileNumber}`);
    setResendTimer(60);
    setCanResend(false);
    
    // Show simulated SMS popup after a short delay
    setTimeout(() => {
      setShowSmsPopup(true);
      // Auto hide after 8 seconds
      setTimeout(() => setShowSmsPopup(false), 8000);
    }, 1000);
  };

  const filteredBuses = mockBuses
    .filter(bus => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        bus.number.toLowerCase().includes(query) ||
        bus.origin.toLowerCase().includes(query) ||
        bus.destination.toLowerCase().includes(query) ||
        bus.stops.some(stop => stop.name.toLowerCase().includes(query))
      );

      const matchesOrigin = !filterOrigin || bus.origin === filterOrigin;
      const matchesDestination = !filterDestination || bus.destination === filterDestination;

      return matchesSearch && matchesOrigin && matchesDestination;
    })
    .sort((a, b) => {
      if (!sortByEta) return 0;
      const getMinutes = (eta: string) => parseInt(eta.split(' ')[0]) || 0;
      return getMinutes(a.eta) - getMinutes(b.eta);
    });

  const uniqueOrigins = Array.from(new Set(mockBuses.map(b => b.origin)));
  const uniqueDestinations = Array.from(new Set(mockBuses.map(b => b.destination)));

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative">
      {/* Simulated SMS Popup */}
      <AnimatePresence>
        {showSmsPopup && (
          <motion.div 
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -100 }}
            className="absolute top-0 left-4 right-4 z-[110] pointer-events-auto"
          >
            <div className="bg-white/95 backdrop-blur-md border border-stone-200 p-4 rounded-2xl shadow-2xl flex items-start gap-4">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Messages • now</span>
                  <button onClick={() => setShowSmsPopup(false)} className="text-stone-400 p-1">
                    <ArrowLeft className="w-3 h-3 rotate-45" />
                  </button>
                </div>
                <p className="text-xs font-bold text-stone-800 mb-1">{t.appName}</p>
                <p className="text-sm text-stone-600">
                  {t.yourOtpIs} <span className="font-mono font-black text-brand-primary tracking-widest text-lg">{generatedOtp}</span>. Do not share this with anyone.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-0 left-4 right-4 z-[100] flex justify-center pointer-events-none"
          >
            <div className={cn(
              "px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm text-white",
              toastType === 'success' ? "bg-brand-secondary" : "bg-red-500"
            )}>
              {toastType === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      {activeScreen !== 'auth' && (
        <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {activeScreen !== 'home' && (
              <button onClick={() => {
                if (activeScreen === 'tourist-mode') stopCamera();
                setActiveScreen('home');
              }} className="p-1">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <NammaRouteLogo size={32} />
              <h1 className="text-xl font-display font-bold text-brand-primary">{t.appName}</h1>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {isOffline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-stone-100 rounded-full">
                <Globe className="w-3 h-3 text-stone-400" />
                <span className="text-[8px] font-bold text-stone-400 uppercase">Offline</span>
              </div>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)} 
                className="p-2 bg-stone-100 rounded-full flex items-center gap-1 text-stone-600"
              >
                <Languages className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase">{language}</span>
              </button>
              
              <AnimatePresence>
                {showLangMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-32 bg-white border rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    {(['en', 'ta', 'hi'] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLanguage(lang);
                          setShowLangMenu(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-sm font-medium hover:bg-stone-50 transition-colors",
                          language === lang ? "text-brand-primary bg-brand-primary/5" : "text-stone-600"
                        )}
                      >
                        {lang === 'en' ? 'English' : lang === 'ta' ? 'தமிழ்' : 'हिन्दी'}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => {
                setIsLoggedIn(false);
                setActiveScreen('auth');
                setAuthStep('mobile');
                setMobileNumber('');
                setOtp('');
                setIsForgotPassword(false);
              }} 
              className="p-2 bg-stone-100 rounded-full text-stone-600"
            >
              <Lock className="w-5 h-5" />
            </button>
            <button onClick={() => setActiveScreen('safety')} className="p-2 bg-red-50 rounded-full text-red-600">
              <ShieldAlert className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 overflow-y-auto", activeScreen !== 'auth' && "pb-20")}>
        {/* Voice Assistant Floating Button */}
      {isLoggedIn && activeScreen !== 'auth' && (
        <motion.button
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={isLiveAssistantActive ? stopLiveAssistant : startLiveAssistant}
          className={cn(
            "fixed bottom-24 right-6 z-[60] w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all",
            isLiveAssistantActive 
              ? "bg-red-500 text-white animate-pulse" 
              : "bg-brand-primary text-white"
          )}
          aria-label={t.voiceAssistant}
        >
          {isLiveAssistantActive ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          
          {/* Visual indicator for listening */}
          {isLiveAssistantActive && (
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-red-500 rounded-full -z-10"
            />
          )}
        </motion.button>
      )}

      {/* Voice Assistant Overlay */}
      <AnimatePresence>
        {isLiveAssistantActive && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-white/95 backdrop-blur-xl border-t border-stone-100 p-8 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary relative">
              <Volume2 className="w-10 h-10" />
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 bg-brand-primary rounded-full -z-10"
              />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-display font-black text-stone-800 uppercase tracking-tight">{t.voiceAssistant}</h3>
              <p className="text-brand-primary font-bold animate-pulse">{t.listening}</p>
              <p className="text-stone-500 text-sm max-w-xs mx-auto">{t.howCanIHelp}</p>
            </div>

            <div className="flex gap-4 w-full">
              <button
                onClick={stopLiveAssistant}
                className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold uppercase tracking-widest hover:bg-stone-200 transition-colors"
              >
                {t.stopAssistant}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
          {activeScreen === 'auth' && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen bg-white p-6 flex flex-col justify-center"
            >
              <div className="text-center mb-12">
                <div className="mb-6 flex justify-center">
                  <NammaRouteLogo size={80} className="drop-shadow-xl" />
                </div>
                <h1 className="text-3xl font-display font-bold text-brand-primary mb-2">{t.appName}</h1>
                <p className="text-stone-500">{t.welcome}</p>
              </div>

              <div className="space-y-6">
                {authStep === 'mobile' && (
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-600 ml-1">{t.mobileNumber}</label>
                      <div className="relative">
                        <PhoneCall className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input 
                          type="tel" 
                          placeholder="98765 43210"
                          className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleSendOTP}
                      disabled={!mobileNumber}
                      className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                    >
                      {t.sendOTP}
                    </button>

                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100"></div></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-stone-400">{t.socialLogin}</span></div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <button onClick={() => handleSocialLogin('Google')} className="p-4 bg-stone-50 rounded-2xl flex items-center justify-center hover:bg-stone-100 transition-colors">
                        <Globe className="w-6 h-6 text-blue-500" />
                      </button>
                      <button onClick={() => handleSocialLogin('Facebook')} className="p-4 bg-stone-50 rounded-2xl flex items-center justify-center hover:bg-stone-100 transition-colors">
                        <Facebook className="w-6 h-6 text-blue-700" />
                      </button>
                      <button onClick={() => handleSocialLogin('Chrome')} className="p-4 bg-stone-50 rounded-2xl flex items-center justify-center hover:bg-stone-100 transition-colors">
                        <Chrome className="w-6 h-6 text-stone-600" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {authStep === 'otp' && (
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-600 ml-1">{t.enterOTP}</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input 
                          type="number" 
                          placeholder="1234"
                          className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all tracking-[1em] text-center"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.slice(0, 4))}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={verifyOTP}
                      disabled={otp.length < 4}
                      className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                    >
                      {t.verifyOTP}
                    </button>
                    
                    <div className="flex flex-col items-center gap-4">
                      {resendTimer > 0 ? (
                        <p className="text-sm text-stone-400 font-medium">
                          {t.resendIn} <span className="text-brand-primary font-bold">{resendTimer}{t.seconds}</span>
                        </p>
                      ) : (
                        <button 
                          onClick={handleResendOTP}
                          className="text-sm font-bold text-brand-primary hover:underline"
                        >
                          {t.resendOTP}
                        </button>
                      )}
                      
                      <button 
                        onClick={() => {
                          setAuthStep('mobile');
                          setIsForgotPassword(false);
                        }} 
                        className="text-sm font-bold text-stone-400"
                      >
                        Change Mobile Number
                      </button>
                    </div>
                  </motion.div>
                )}

                {authStep === 'profile' && (
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="space-y-4">
                      {!isForgotPassword && (
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-stone-600 ml-1">{t.username}</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <input 
                              type="text" 
                              className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-600 ml-1">
                          {isForgotPassword ? t.newPassword : t.password}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                          <input 
                            type="password" 
                            className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      {isForgotPassword && (
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-stone-600 ml-1">{t.confirmPassword}</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <input 
                              type="password" 
                              className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={handleLogin}
                      disabled={isForgotPassword ? (!password || password !== confirmPassword) : (!username || !password)}
                      className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                    >
                      {isForgotPassword ? t.resetPassword : t.completeProfile}
                    </button>

                    {!isForgotPassword && (
                      <button 
                        onClick={() => setIsForgotPassword(true)}
                        className="w-full text-sm font-bold text-brand-primary hover:underline mt-2"
                      >
                        {t.forgotPassword}
                      </button>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="mt-auto pt-12 text-center">
                <div className="flex justify-center gap-4">
                  <button onClick={() => setLanguage('en')} className={cn("text-xs font-bold", language === 'en' ? "text-brand-primary" : "text-stone-400")}>ENGLISH</button>
                  <button onClick={() => setLanguage('ta')} className={cn("text-xs font-bold", language === 'ta' ? "text-brand-primary" : "text-stone-400")}>தமிழ்</button>
                  <button onClick={() => setLanguage('hi')} className={cn("text-xs font-bold", language === 'hi' ? "text-brand-primary" : "text-stone-400")}>हिन्दी</button>
                </div>
              </div>
            </motion.div>
          )}

          {activeScreen === 'offline-maps' && (
            <motion.div 
              key="offline-maps"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedCityForMap && (
                    <button onClick={() => setSelectedCityForMap(null)} className="p-2 bg-stone-100 rounded-full">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h2 className="text-2xl font-display font-bold">
                    {selectedCityForMap ? `${selectedCityForMap} ${t.liveTracking}` : t.offlineMaps}
                  </h2>
                </div>
                {!selectedCityForMap && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-400">{t.offlineMode}</span>
                    <button 
                      onClick={() => setIsOffline(!isOffline)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        isOffline ? "bg-brand-primary" : "bg-stone-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        isOffline ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>
                )}
              </div>

              {!selectedCityForMap ? (
                <div className="space-y-4">
                  {['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem'].map((city) => (
                    <div key={city} className="p-4 bg-white border border-stone-100 rounded-2xl flex flex-col gap-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center">
                            <MapIcon className="w-5 h-5 text-stone-400" />
                          </div>
                          <div>
                            <p className="font-bold text-stone-800">{city}</p>
                            <p className="text-[10px] text-stone-400 uppercase font-bold">Tamil Nadu • 45MB</p>
                          </div>
                        </div>
                        
                        {downloadedRegions.includes(city) ? (
                          <div className="flex items-center gap-2 text-brand-secondary">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase">Downloaded</span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleDownloadMap(city)}
                            disabled={isDownloading === city}
                            className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-brand-primary hover:text-white transition-all disabled:opacity-50"
                          >
                            {isDownloading === city ? '...' : t.downloadRegion}
                          </button>
                        )}
                      </div>

                      {downloadedRegions.includes(city) && (
                        <button 
                          onClick={() => setSelectedCityForMap(city)}
                          className="w-full py-3 bg-brand-primary/10 text-brand-primary rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-brand-primary/20 transition-all"
                        >
                          <MapPin className="w-4 h-4" />
                          {t.viewLiveMap}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-square bg-stone-100 rounded-3xl overflow-hidden border border-stone-200 shadow-inner">
                    {/* Stylized SVG Map */}
                    <svg viewBox="0 0 400 400" className="w-full h-full">
                      {/* Roads */}
                      <path d="M0 200 H400 M200 0 V400 M100 0 L300 400 M0 100 L400 300" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                      <path d="M0 200 H400 M200 0 V400" stroke="#ffffff" strokeWidth="4" fill="none" />
                      
                      {/* Stops */}
                      {[
                        { x: 100, y: 100, name: 'Central' },
                        { x: 300, y: 100, name: 'North' },
                        { x: 200, y: 200, name: 'Main' },
                        { x: 100, y: 300, name: 'South' },
                        { x: 300, y: 300, name: 'East' }
                      ].map((stop, i) => (
                        <g key={i}>
                          <circle cx={stop.x} cy={stop.y} r="6" fill="#f27d26" />
                          <text x={stop.x} y={stop.y + 15} textAnchor="middle" className="text-[10px] font-bold fill-stone-400">{stop.name}</text>
                        </g>
                      ))}

                      {/* Moving Buses (Simulated) */}
                      <motion.g
                        animate={{ 
                          x: [0, 100, 200, 100, 0],
                          y: [0, 50, 0, -50, 0]
                        }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      >
                        <circle cx="150" cy="150" r="10" fill="#f27d26" className="shadow-lg" />
                        <Bus className="w-3 h-3 text-white absolute" style={{ transform: 'translate(144px, 144px)' }} />
                      </motion.g>

                      <motion.g
                        animate={{ 
                          x: [0, -100, -200, -100, 0],
                          y: [0, -50, 0, 50, 0]
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      >
                        <circle cx="250" cy="250" r="10" fill="#14b8a6" className="shadow-lg" />
                        <Bus className="w-3 h-3 text-white absolute" style={{ transform: 'translate(244px, 244px)' }} />
                      </motion.g>
                    </svg>

                    {/* Offline Badge */}
                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-full text-[10px] font-bold flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      {isOffline ? 'OFFLINE DATA' : 'LIVE'}
                    </div>

                    {/* Legend */}
                    <div className="absolute bottom-4 left-4 right-4 flex gap-4">
                      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-sm">
                        <div className="w-3 h-3 bg-brand-primary rounded-full" />
                        <span className="text-[10px] font-bold text-stone-600">{t.busPositions}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-sm">
                        <div className="w-3 h-3 bg-stone-300 rounded-full" />
                        <span className="text-[10px] font-bold text-stone-600">{t.stops}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-stone-100 rounded-2xl space-y-3">
                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <Info className="w-4 h-4 text-brand-primary" />
                      {t.nearbyBuses}
                    </h3>
                    <div className="space-y-2">
                      {mockBuses.slice(0, 2).map(bus => (
                        <div key={bus.id} className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-xl transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary">
                              <Bus className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold">#{bus.number}</p>
                              <p className="text-[10px] text-stone-400">{bus.destination}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-brand-secondary">{bus.eta}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isOffline && !selectedCityForMap && (
                <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl flex items-start gap-3">
                  <Info className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-brand-primary">{t.noInternet}</p>
                    <p className="text-xs text-brand-primary/70">{t.accessOffline}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeScreen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-6"
            >
              {/* Search */}
              <div className="space-y-4">
                {currentLocation && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 px-3 py-1 bg-brand-primary/10 rounded-full w-fit"
                  >
                    <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
                      Live: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                    </span>
                  </motion.div>
                )}
                
                <div className="bg-white border-2 border-stone-100 rounded-3xl p-4 shadow-sm space-y-3 relative overflow-hidden">
                  {/* Decorative line */}
                  <div className="absolute left-8 top-12 bottom-12 w-0.5 bg-stone-100" />
                  
                  <div className="relative flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 z-10">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">{t.from}</p>
                      <select 
                        className="w-full bg-transparent text-sm font-bold text-stone-800 outline-none appearance-none"
                        value={filterOrigin || ''}
                        onChange={(e) => setFilterOrigin(e.target.value || null)}
                      >
                        <option value="">{t.currentLocation}</option>
                        {uniqueOrigins.map(origin => (
                          <option key={origin} value={origin}>{origin}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="relative flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 z-10">
                      <MapPin className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">{t.to}</p>
                      <select 
                        className="w-full bg-transparent text-sm font-bold text-stone-800 outline-none appearance-none"
                        value={filterDestination || ''}
                        onChange={(e) => setFilterDestination(e.target.value || null)}
                      >
                        <option value="">{t.allDestinations}</option>
                        {uniqueDestinations.map(dest => (
                          <option key={dest} value={dest}>{dest}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button 
                      onClick={() => {
                        const temp = filterOrigin;
                        setFilterOrigin(filterDestination);
                        setFilterDestination(temp);
                      }}
                      className="p-2 bg-stone-50 rounded-xl text-stone-400 hover:text-brand-primary transition-colors"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-stone-400 group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input 
                    type="text" 
                    placeholder={t.searchPlaceholder}
                    className="w-full pl-10 pr-10 py-4 bg-white border-2 border-stone-100 rounded-2xl focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all shadow-sm text-stone-800 font-medium placeholder:text-stone-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-stone-100 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-200 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              {!searchQuery && (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      setActiveScreen('tourist-mode');
                      startCamera();
                    }}
                    className="p-4 bg-brand-primary/10 rounded-2xl border border-brand-primary/20 flex flex-col items-center gap-2 text-brand-primary"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="font-semibold text-[10px]">{t.touristMode}</span>
                  </button>
                  <button 
                    onClick={() => handleItinerary('Chennai')}
                    className="p-4 bg-brand-secondary/10 rounded-2xl border border-brand-secondary/20 flex flex-col items-center gap-2 text-brand-secondary"
                  >
                    <MapIcon className="w-6 h-6" />
                    <span className="font-semibold text-[10px]">{t.planTrip}</span>
                  </button>
                  <button 
                    onClick={() => setActiveScreen('rooms')}
                    className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col items-center gap-2 text-indigo-600"
                  >
                    <Bed className="w-6 h-6" />
                    <span className="font-semibold text-[10px]">{t.rooms}</span>
                  </button>
                  <button 
                    onClick={() => setActiveScreen('offline-maps')}
                    className="p-4 bg-stone-100 rounded-2xl border border-stone-200 flex flex-col items-center gap-2 text-stone-600"
                  >
                    <Globe className="w-6 h-6" />
                    <span className="font-semibold text-[10px]">{t.offlineMaps}</span>
                  </button>
                  <button 
                    onClick={() => handleItinerary('Chennai Food')}
                    className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col items-center gap-2 text-orange-600"
                  >
                    <Utensils className="w-6 h-6" />
                    <span className="font-semibold text-[10px]">{t.foodDining}</span>
                  </button>
                  <button 
                    onClick={() => setActiveScreen('puzzle-challenge')}
                    className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100 flex flex-col items-center gap-2 text-yellow-600"
                  >
                    <Gamepad2 className="w-6 h-6" />
                    <span className="font-semibold text-[10px]">{t.puzzleChallenge}</span>
                  </button>
                </div>
              )}

              {/* Nearby Buses */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg">
                    {searchQuery ? `${t.searchResults} (${filteredBuses.length})` : t.nearbyBuses}
                  </h2>
                  {!searchQuery && <button className="text-brand-primary text-sm font-semibold">{t.viewAll}</button>}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                  <button 
                    onClick={() => setSortByEta(!sortByEta)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                      sortByEta ? "bg-brand-primary border-brand-primary text-white shadow-lg" : "bg-white border-stone-200 text-stone-500"
                    )}
                  >
                    <ArrowUpDown className="w-3 h-3" /> {t.sortByEta}
                  </button>
                  
                  <div className="h-4 w-px bg-stone-200 shrink-0" />

                  <div className="relative shrink-0">
                    <select 
                      value={filterOrigin || ''} 
                      onChange={(e) => setFilterOrigin(e.target.value || null)}
                      className={cn(
                        "bg-white border text-stone-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full outline-none focus:ring-2 focus:ring-brand-primary/20 appearance-none pr-6",
                        filterOrigin ? "border-brand-primary text-brand-primary" : "border-stone-200"
                      )}
                    >
                      <option value="">{t.allOrigins}</option>
                      {uniqueOrigins.map(origin => (
                        <option key={origin} value={origin}>{origin}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                      <MapPin className="w-2.5 h-2.5 opacity-50" />
                    </div>
                  </div>

                  <div className="relative shrink-0">
                    <select 
                      value={filterDestination || ''} 
                      onChange={(e) => setFilterDestination(e.target.value || null)}
                      className={cn(
                        "bg-white border text-stone-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full outline-none focus:ring-2 focus:ring-brand-primary/20 appearance-none pr-6",
                        filterDestination ? "border-brand-primary text-brand-primary" : "border-stone-200"
                      )}
                    >
                      <option value="">{t.allDestinations}</option>
                      {uniqueDestinations.map(dest => (
                        <option key={dest} value={dest}>{dest}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Navigation className="w-2.5 h-2.5 opacity-50" />
                    </div>
                  </div>

                  {(filterOrigin || filterDestination || sortByEta) && (
                    <button 
                      onClick={() => {
                        setFilterOrigin(null);
                        setFilterDestination(null);
                        setSortByEta(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-stone-800 text-white whitespace-nowrap"
                    >
                      <X className="w-3 h-3" /> {t.clear}
                    </button>
                  )}
                </div>
                
                {filteredBuses.length > 0 ? (
                  filteredBuses.map(bus => (
                    <button 
                      key={bus.id}
                      onClick={() => {
                        setSelectedBus(bus);
                        setActiveScreen('bus-details');
                      }}
                      className="w-full text-left glass-card p-4 rounded-2xl flex items-center justify-between group transition-all hover:border-brand-primary/40"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-brand-primary">
                          <Bus className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">#{bus.number}</span>
                            <span className="text-xs px-2 py-0.5 bg-stone-100 rounded-full text-stone-500">{bus.eta}</span>
                            <div className={cn(
                              "flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                              bus.crowding === 'low' ? "bg-emerald-100 text-emerald-600" :
                              bus.crowding === 'medium' ? "bg-orange-100 text-orange-600" :
                              "bg-red-100 text-red-600"
                            )}>
                              <Users className="w-2.5 h-2.5" />
                              {bus.crowding === 'low' ? t.crowdingLow : bus.crowding === 'medium' ? t.crowdingMedium : t.crowdingHigh}
                            </div>
                          </div>
                          <p className="text-sm text-stone-500">{bus.origin} → {bus.destination}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1 text-[10px] text-stone-400 font-medium">
                              <Clock className="w-3 h-3" /> {bus.departureTime} - {bus.arrivalTime}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-brand-secondary font-bold">
                              {t.rupees}{bus.fare}
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBus(bus);
                                setShowSeatModal(true);
                              }}
                              className="ml-2 px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-md text-[9px] font-black uppercase tracking-tighter hover:bg-brand-primary hover:text-white transition-colors"
                            >
                              {t.viewSeats}
                            </button>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-brand-primary transition-colors" />
                    </button>
                  ))
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="font-bold text-stone-600">{t.noBuses}</p>
                    <p className="text-sm text-stone-400">{t.tryDifferent}</p>
                  </div>
                )}
              </div>

              {/* Featured Itineraries */}
              {!searchQuery && (
                <div className="space-y-4">
                  <h2 className="font-display font-bold text-lg">{t.exploreTN}</h2>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {['Chennai', 'Trichy', 'Madurai', 'Coimbatore'].map(city => (
                      <button 
                        key={city}
                        onClick={() => handleItinerary(city)}
                        className="flex-shrink-0 w-40 h-48 rounded-2xl relative overflow-hidden group"
                      >
                        <img 
                          src={`https://picsum.photos/seed/${city}/400/600`} 
                          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110"
                          alt={city}
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-4 left-4 text-white">
                          <p className="font-bold">{city}</p>
                          <p className="text-xs opacity-80">{t.fullDayTrip}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeScreen === 'bus-details' && selectedBus && (
            <motion.div 
              key="bus-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-6"
            >
              <button 
                onClick={() => setActiveScreen('home')}
                className="flex items-center gap-2 text-stone-500 font-bold hover:text-brand-primary transition-colors mb-2"
              >
                <ArrowLeft className="w-5 h-5" />
                {t.back}
              </button>

              <div className="bg-brand-primary text-white p-6 rounded-3xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <motion.div 
                        animate={{ 
                          y: [0, -2, 0],
                          rotate: [0, 1, -1, 0]
                        }}
                        transition={{ 
                          duration: 0.4, 
                          repeat: Infinity, 
                          ease: "easeInOut" 
                        }}
                        className="p-2 bg-white/20 rounded-xl backdrop-blur-md relative"
                      >
                        <Bus className="w-6 h-6" />
                        {/* Subtle road shadow */}
                        <motion.div 
                          animate={{ scaleX: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                          transition={{ duration: 0.4, repeat: Infinity }}
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-black/20 rounded-full blur-[1px]"
                        />
                      </motion.div>
                      <h2 className="text-3xl font-display font-black">#{selectedBus.number}</h2>
                      {isOffline && (
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-[8px] font-bold uppercase tracking-widest">Offline</span>
                      )}
                    </div>
                    <p className="opacity-90">{selectedBus.origin} to {selectedBus.destination}</p>
                    <div className="flex items-center gap-3 mt-2 opacity-80 text-xs font-medium">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.departure}: {selectedBus.departureTime}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.arrival}: {selectedBus.arrivalTime}</span>
                    </div>
                    <div className="mt-4">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm backdrop-blur-md",
                        selectedBus.crowding === 'low' ? "bg-emerald-500/20 text-white border border-white/20" :
                        selectedBus.crowding === 'medium' ? "bg-orange-500/20 text-white border border-white/20" :
                        "bg-red-500/20 text-white border border-white/20"
                      )}>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          selectedBus.crowding === 'low' ? "bg-emerald-400" :
                          selectedBus.crowding === 'medium' ? "bg-orange-400" :
                          "bg-red-400"
                        )} />
                        {selectedBus.crowding === 'low' ? t.crowdingLow : selectedBus.crowding === 'medium' ? t.crowdingMedium : t.crowdingHigh}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80 uppercase tracking-widest">{t.eta}</p>
                    <p className="text-2xl font-bold">{selectedBus.eta}</p>
                  </div>
                </div>
              </div>

              {/* Seat Availability */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-primary" />
                    {t.busRoutes}
                  </h3>
                  <button 
                    onClick={() => setShowSeatModal(true)}
                    className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-brand-primary hover:text-white transition-all"
                  >
                    <Video className="w-3 h-3" /> {t.viewSeats}
                  </button>
                </div>
                
                <div className="grid grid-cols-6 gap-3">
                  {/* Main Availability Card */}
                  <div className="col-span-6 p-5 bg-brand-primary text-white rounded-[2rem] shadow-lg shadow-brand-primary/20 flex items-center justify-between relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-[10px] uppercase font-black tracking-widest opacity-80 mb-1">{t.availableSeats}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black">
                          {Math.max(0, selectedBus.seats.total - (selectedBus.seats.men + selectedBus.seats.women))}
                        </span>
                        <span className="text-sm opacity-60 font-bold">/ {selectedBus.seats.total} {t.totalSeats}</span>
                      </div>
                    </div>
                    <motion.div 
                      animate={{ 
                        y: [0, -3, 0],
                        rotate: [0, 0.5, -0.5, 0]
                      }}
                      transition={{ 
                        duration: 0.6, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                      className="relative z-10 w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md"
                    >
                      <Bus className="w-8 h-8" />
                      {/* Subtle road shadow */}
                      <motion.div 
                        animate={{ scaleX: [1, 1.3, 1], opacity: [0.2, 0.1, 0.2] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-black/10 rounded-full blur-[2px]"
                      />
                    </motion.div>
                    {/* Decorative background circle */}
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  </div>

                  {/* Gender Breakdown */}
                  <div className="col-span-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-400 uppercase font-black tracking-wider">{t.menSeatsLabel}</span>
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-blue-600">{selectedBus.seats.men}</p>
                  </div>
                  <div className="col-span-3 p-4 bg-pink-50 border border-pink-100 rounded-2xl flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-pink-400 uppercase font-black tracking-wider">{t.womenSeatsLabel}</span>
                      <div className="w-6 h-6 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-pink-600">{selectedBus.seats.women}</p>
                  </div>
                </div>
              </div>

              {/* Upcoming Stops */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-brand-primary" />
                    {t.upcomingStops}
                  </h3>
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                    {selectedBus.stops.filter(s => !s.passed).length} {t.stops} Left
                  </span>
                </div>
                
                <div className="space-y-3">
                  {selectedBus.stops.filter(s => !s.passed).map((stop, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "p-4 rounded-2xl flex items-center justify-between transition-all border",
                        idx === 0 
                          ? "bg-white border-brand-primary/30 shadow-md shadow-brand-primary/5 scale-[1.02]" 
                          : "bg-stone-50 border-stone-100 opacity-70"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          idx === 0 ? "bg-brand-primary text-white" : "bg-stone-200 text-stone-500"
                        )}>
                          {idx === 0 ? <Navigation className="w-5 h-5 animate-pulse" /> : <MapPin className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={cn("font-bold", idx === 0 ? "text-stone-900" : "text-stone-600")}>
                              {stop.name}
                            </p>
                            {idx === 0 && (
                              <span className="px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black uppercase rounded">Next</span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-400 font-medium tracking-wide">Expected arrival at {stop.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-lg font-black", idx === 0 ? "text-brand-primary" : "text-stone-400")}>
                          {stop.time}
                        </p>
                        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-tighter">ETA</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <h3 className="font-display font-bold text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-brand-primary" />
                  {t.liveRoute}
                </h3>
                <div className="space-y-0 pl-4 border-l-2 border-stone-200 ml-2">
                  {selectedBus.stops.map((stop, idx) => (
                    <div key={idx} className="relative pb-8 last:pb-0 pl-6">
                      <div className={cn(
                        "absolute left-[-11px] top-0 w-5 h-5 rounded-full border-4 border-white shadow-sm",
                        stop.passed ? "bg-brand-secondary" : "bg-stone-300"
                      )} />
                      <div className="flex items-center justify-between">
                        <p className={cn("font-medium", stop.passed ? "text-stone-900" : "text-stone-400")}>
                          {stop.name}
                        </p>
                        <p className="text-xs text-stone-400">{stop.time}</p>
                      </div>
                      {stop.name === selectedBus.currentStop && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-brand-secondary/10 text-brand-secondary rounded-full text-xs font-bold animate-pulse">
                          <MapPin className="w-3 h-3" /> {t.currentLocation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-stone-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="w-6 h-6 text-stone-600" />
                  <div>
                    <p className="text-xs text-stone-500 uppercase">{t.fareLabel}</p>
                    <p className="font-bold">{t.rupees}{selectedBus.fare}.00</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-brand-secondary text-white rounded-xl text-sm font-bold">
                  {t.payWithUPI}
                </button>
              </div>
            </motion.div>
          )}

          {activeScreen === 'tourist-mode' && (
            <motion.div 
              key="tourist-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative h-full flex flex-col"
            >
              <div className="absolute inset-0 bg-black">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover opacity-60"
                />
              </div>
              
              <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
                {/* View Toggle */}
                {!scannedLandmark && (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/20">
                    <button 
                      onClick={() => setTouristModeView('camera')}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                        touristModeView === 'camera' ? "bg-brand-primary text-white" : "text-white/60"
                      )}
                    >
                      <Camera className="w-4 h-4 inline mr-1" /> {t.scanButton}
                    </button>
                    <button 
                      onClick={() => setTouristModeView('list')}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                        touristModeView === 'list' ? "bg-brand-primary text-white" : "text-white/60"
                      )}
                    >
                      <History className="w-4 h-4 inline mr-1" /> {t.viewList}
                    </button>
                  </div>
                )}

                {!scannedLandmark ? (
                  touristModeView === 'camera' ? (
                    <div className="space-y-6">
                      <div className="w-72 h-72 relative flex items-center justify-center">
                        {/* Corner Brackets */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-primary rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-primary rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-primary rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-primary rounded-br-xl" />
                        
                        {/* Scanning Line */}
                        <motion.div 
                          animate={{ top: ['10%', '90%', '10%'] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          className="absolute left-[10%] right-[10%] h-0.5 bg-brand-primary shadow-[0_0_15px_rgba(242,125,38,0.8)] z-10"
                        />

                        <div className="w-64 h-64 border border-white/20 rounded-3xl overflow-hidden relative">
                          <div className="absolute inset-0 bg-brand-primary/5 animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-white font-medium text-lg drop-shadow-md">{t.scanLandmark}</p>
                        <div className="flex justify-center gap-4 text-[10px] text-white/60 font-mono uppercase tracking-widest">
                          <span>Lat: {currentLocation ? currentLocation.lat.toFixed(4) : '13.0827'}° N</span>
                          <span>Lng: {currentLocation ? currentLocation.lng.toFixed(4) : '80.2707'}° E</span>
                        </div>
                      </div>
                      <button 
                        onClick={handleScan}
                        disabled={isLoading}
                        className="group relative px-10 py-4 bg-brand-primary text-white rounded-full font-bold shadow-2xl shadow-brand-primary/40 disabled:opacity-50 overflow-hidden transition-all active:scale-95"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-5 h-5" />
                          )}
                          {isLoading ? t.scanning : t.scanButton}
                        </span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                      </button>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-2xl space-y-4 max-h-[70vh] overflow-y-auto"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-display font-bold text-brand-primary">{t.availableLandmarks}</h3>
                      </div>
                      <div className="space-y-3">
                        {mockLandmarks.map((landmark) => (
                          <button 
                            key={landmark.id}
                            onClick={() => handleSelectLandmark(landmark)}
                            className="w-full flex items-center gap-4 p-3 bg-stone-50 rounded-2xl hover:bg-brand-primary/5 transition-colors group text-left"
                          >
                            <img 
                              src={landmark.image} 
                              className="w-16 h-16 rounded-xl object-cover shadow-sm" 
                              alt={landmark.name}
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1">
                              <p className="font-bold text-stone-800 group-hover:text-brand-primary transition-colors">{landmark.name}</p>
                              <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">{landmark.district}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-brand-primary transition-colors" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )
                ) : (
                  <div className="w-full space-y-4">
                    {/* AR Guidance Overlay */}
                    <motion.div 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center gap-4 text-white"
                    >
                      <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(242,125,38,0.5)]">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Navigation className="w-6 h-6 rotate-45" />
                        </motion.div>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold uppercase tracking-wider opacity-70">{t.followArrow}</p>
                        <p className="text-lg font-black">{t.distance}: 150m</p>
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-3xl p-6 max-h-[60vh] overflow-y-auto w-full text-left space-y-4 shadow-2xl"
                    >
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-display font-bold text-brand-primary">{scannedLandmark.name}</h2>
                      <button onClick={() => setScannedLandmark(null)} className="p-2 bg-stone-100 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                    </div>
                    <img 
                      src={scannedLandmark.image} 
                      className="w-full h-48 object-cover rounded-2xl" 
                      alt={scannedLandmark.name}
                      referrerPolicy="no-referrer"
                    />
                    
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-stone-100">
                      <div className="text-center">
                        <p className="text-[10px] text-stone-400 uppercase font-bold">{t.stateLabel}</p>
                        <p className="text-xs font-bold text-stone-700">{scannedLandmark.state}</p>
                      </div>
                      <div className="text-center border-x border-stone-100">
                        <p className="text-[10px] text-stone-400 uppercase font-bold">{t.districtLabel}</p>
                        <p className="text-xs font-bold text-stone-700">{scannedLandmark.district}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-stone-400 uppercase font-bold">{t.villageLabel}</p>
                        <p className="text-xs font-bold text-stone-700">{scannedLandmark.village}</p>
                      </div>
                    </div>

                    <div className="markdown-body">
                      <ReactMarkdown>{aiContent}</ReactMarkdown>
                    </div>
                    <div className="flex gap-2">
                      <a 
                        href={`tel:${scannedLandmark.guideNumber}`}
                        className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-bold flex items-center justify-center gap-2"
                      >
                        <PhoneCall className="w-5 h-5" /> {t.tourGuide}
                      </a>
                      <button className="flex-1 py-3 bg-brand-secondary text-white rounded-xl font-bold flex items-center justify-center gap-2">
                        <History className="w-5 h-5" /> {t.playAR}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          </motion.div>
        )}

          {activeScreen === 'itinerary' && (
            <motion.div 
              key="itinerary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold">{t.tripPlanner}</h2>
                <div className="px-3 py-1 bg-stone-100 rounded-full text-xs font-bold text-stone-50">
                  {t.aiGenerated}
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4 py-12 text-center">
                  <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-stone-500">{t.craftingTrip}</p>
                </div>
              ) : (
                <div className="glass-card rounded-3xl p-6 space-y-4">
                  <div className="markdown-body">
                    <ReactMarkdown>{aiContent}</ReactMarkdown>
                  </div>
                  <button 
                    onClick={() => setActiveScreen('home')}
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg"
                  >
                    {t.findBuses}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeScreen === 'rooms' && (
            <motion.div 
              key="rooms"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-6"
            >
              <h2 className="text-2xl font-display font-bold">{t.nearbyRooms}</h2>
              <div className="grid grid-cols-1 gap-6">
                {mockRooms.map(room => (
                  <div key={room.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 group">
                    <div className="relative h-48">
                      <img 
                        src={room.image} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        alt={room.name}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        {room.rating}
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <h3 className="font-bold text-lg">{room.name}</h3>
                        <p className="text-sm text-stone-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {room.location}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {room.amenities.map(amenity => (
                          <span key={amenity} className="px-2 py-1 bg-stone-100 rounded-lg text-[10px] font-bold text-stone-600 uppercase">
                            {amenity}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-50">
                        <div>
                          <span className="text-xl font-black text-brand-primary">₹{room.rent}</span>
                          <span className="text-xs text-stone-400 ml-1">/{t.perDay}</span>
                        </div>
                        <button className="px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold shadow-md shadow-brand-primary/20">
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeScreen === 'safety' && (
            <motion.div 
              key="safety"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 space-y-6"
            >
              {reportSubmitted ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 border border-green-100 p-8 rounded-3xl text-center space-y-4 shadow-sm"
                >
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
                  <h2 className="text-2xl font-display font-bold text-green-900">{t.reportSuccess}</h2>
                  <p className="text-green-700">{t.reportSuccessDesc}</p>
                  <button 
                    onClick={() => {
                      setReportSubmitted(false);
                      setSafetyReportType(null);
                      setReportMedia(null);
                      setActiveScreen('home');
                    }}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold"
                  >
                    Back to Home
                  </button>
                </motion.div>
              ) : safetyReportType ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSafetyReportType(null)} className="p-2 bg-stone-100 rounded-full text-stone-600">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-bold">{safetyReportType}</h2>
                  </div>

                  <div className="bg-white border-2 border-dashed border-stone-200 rounded-3xl p-8 text-center space-y-4">
                    {reportMedia ? (
                      <div className="relative">
                        <img src={reportMedia} className="w-full h-48 object-cover rounded-2xl" alt="Proof" />
                        <button 
                          onClick={() => setReportMedia(null)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                        >
                          <ArrowLeft className="w-4 h-4 rotate-45" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-400">
                          <Camera className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-bold text-stone-600">{t.uploadProof}</p>
                          <p className="text-xs text-stone-400 mt-1">Photos or videos are encrypted and sent directly to authorities.</p>
                        </div>
                        <div className="flex gap-3">
                          <label className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2 text-stone-700">
                            <Camera className="w-4 h-4" />
                            {t.takePhoto}
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMediaUpload} />
                          </label>
                          <label className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2 text-stone-700">
                            <Video className="w-4 h-4" />
                            {t.recordVideo}
                            <input type="file" accept="video/*" capture="environment" className="hidden" onChange={handleMediaUpload} />
                          </label>
                        </div>
                      </>
                    )}
                  </div>

                  <button 
                    onClick={handleSafetyAlert}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                  >
                    <ShieldAlert className="w-5 h-5" />
                    {t.submitReport}
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-red-500 text-white p-8 rounded-3xl text-center space-y-4 shadow-xl">
                    <ShieldAlert className="w-16 h-16 mx-auto" />
                    <h2 className="text-2xl font-display font-bold">{t.safetyCenter}</h2>
                    <p className="opacity-90">{t.safetyDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => window.open('tel:1091')}
                      className="w-full p-4 bg-pink-50 border border-pink-100 rounded-2xl flex items-center justify-between text-pink-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <PhoneCall className="w-6 h-6" />
                        <span className="font-bold">{t.emergencyCall}</span>
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-lg">{t.quickReports}</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { label: t.womanSafety, icon: <Users className="w-5 h-5 text-pink-500" /> },
                        { label: t.medicalEmergency, icon: <AlertCircle className="w-5 h-5 text-red-500" /> },
                        { label: t.reportHarassment, icon: <ShieldAlert className="w-5 h-5 text-orange-500" /> },
                        { label: t.suspicious, icon: <Search className="w-5 h-5 text-stone-500" /> }
                      ].map(item => (
                        <button 
                          key={item.label}
                          onClick={() => setSafetyReportType(item.label)}
                          className="w-full p-4 bg-white border rounded-2xl flex items-center justify-between hover:border-red-500 hover:bg-red-50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            {item.icon}
                            <span className="font-semibold">{item.label}</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-red-500" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-stone-100 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-stone-500 mt-0.5" />
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {t.safetyDisclaimer}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      {activeScreen !== 'auth' && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t px-6 py-3 flex justify-between items-center z-10">
          <button 
            onClick={() => setActiveScreen('home')}
            className={cn("p-2 flex flex-col items-center gap-1 transition-colors", activeScreen === 'home' ? "text-brand-primary" : "text-stone-400")}
          >
            <Bus className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t.buses}</span>
          </button>
          <button 
            onClick={() => {
              setActiveScreen('tourist-mode');
              startCamera();
            }}
            className={cn("p-2 flex flex-col items-center gap-1 transition-colors", activeScreen === 'tourist-mode' ? "text-brand-primary" : "text-stone-400")}
          >
            <Camera className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t.arScan}</span>
          </button>
          <button 
            onClick={() => handleItinerary('Chennai')}
            className={cn("p-2 flex flex-col items-center gap-1 transition-colors", activeScreen === 'itinerary' ? "text-brand-primary" : "text-stone-400")}
          >
            <MapIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t.trip}</span>
          </button>
          <button 
            onClick={() => setActiveScreen('rooms')}
            className={cn("p-2 flex flex-col items-center gap-1 transition-colors", activeScreen === 'rooms' ? "text-brand-primary" : "text-stone-400")}
          >
            <Bed className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t.rooms}</span>
          </button>
          <button 
            onClick={() => setActiveScreen('safety')}
            className={cn("p-2 flex flex-col items-center gap-1 transition-colors", activeScreen === 'safety' ? "text-brand-primary" : "text-stone-400")}
          >
            <ShieldAlert className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t.safety}</span>
          </button>
        </nav>
      )}

      {/* Loading Overlay */}
      {isLoading && activeScreen !== 'itinerary' && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-stone-600">Processing...</p>
          </div>
        </div>
      )}

      {/* 3D Seat Modal */}
      <AnimatePresence>
        {showSeatModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-stone-900 rounded-[3rem] overflow-hidden relative shadow-2xl border border-white/10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-white font-display font-bold flex items-center gap-2">
                  <Layout className="w-4 h-4 text-brand-primary" />
                  {t.seatMap3D}
                </h4>
                <button 
                  onClick={() => setShowSeatModal(false)}
                  className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 rotate-45" />
                </button>
              </div>

              {/* Bus Type & Deck Toggles */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex bg-stone-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setBusType('seater')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      busType === 'seater' ? "bg-brand-primary text-white shadow-lg" : "text-stone-500"
                    )}
                  >
                    {t.seater}
                  </button>
                  <button 
                    onClick={() => setBusType('sleeper')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      busType === 'sleeper' ? "bg-brand-primary text-white shadow-lg" : "text-stone-500"
                    )}
                  >
                    {t.sleeper}
                  </button>
                </div>

                {busType === 'sleeper' && (
                  <div className="flex bg-stone-800 p-1 rounded-xl">
                    <button 
                      onClick={() => setActiveDeck('lower')}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        activeDeck === 'lower' ? "bg-brand-secondary text-white shadow-lg" : "text-stone-500"
                      )}
                    >
                      {t.lowerDeck}
                    </button>
                    <button 
                      onClick={() => setActiveDeck('upper')}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        activeDeck === 'upper' ? "bg-brand-secondary text-white shadow-lg" : "text-stone-500"
                      )}
                    >
                      {t.upperDeck}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mb-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-stone-700" />
                  <span className="text-[10px] text-stone-400 font-bold uppercase">{t.booked}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-brand-primary" />
                  <span className="text-[10px] text-stone-400 font-bold uppercase">{t.available}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-[10px] text-stone-400 font-bold uppercase">{t.womenOnly}</span>
                </div>
              </div>

              <div className="relative h-[450px] w-full flex justify-center" style={{ perspective: '1000px' }}>
                <motion.div 
                  key={`${busType}-${activeDeck}`}
                  initial={{ rotateX: 45, rotateZ: -15, y: 50, opacity: 0 }}
                  animate={{ rotateX: 45, rotateZ: -15, y: 0, opacity: 1 }}
                  className="relative w-48 h-[550px] bg-stone-800 rounded-3xl border-4 border-stone-700 shadow-[0_50px_100px_rgba(0,0,0,0.5)] p-4"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Driver Area */}
                  {activeDeck === 'lower' && (
                    <div className="absolute top-4 left-4 right-4 h-12 bg-stone-700/50 rounded-xl flex items-center justify-center border border-white/5">
                      <div className="w-8 h-8 rounded-full bg-stone-600 border-2 border-stone-500 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-stone-400 rounded-full" />
                      </div>
                      <span className="absolute -bottom-5 text-[8px] font-black text-stone-500 uppercase tracking-widest">{t.driver}</span>
                    </div>
                  )}

                  {/* Seats Grid */}
                  <div className={cn("mt-20 grid gap-3 gap-y-6", busType === 'sleeper' ? "grid-cols-3" : "grid-cols-4")}>
                    {Array.from({ length: busType === 'sleeper' ? 12 : 24 }).map((_, i) => {
                      const isBooked = i % 3 === 0;
                      const isWomenOnly = activeDeck === 'lower' && (i === 4 || i === 5 || i === 8 || i === 9);
                      
                      return (
                        <motion.div 
                          key={i}
                          whileHover={{ translateZ: 10 }}
                          className={cn(
                            "relative rounded-lg transition-all duration-300",
                            busType === 'sleeper' ? "h-16" : "h-8",
                            isBooked ? "bg-stone-700" : isWomenOnly ? "bg-pink-500/20 border border-pink-500/40" : "bg-brand-primary shadow-[0_4px_0_#c45a0d]",
                            busType === 'seater' && i % 4 === 1 && "mr-4", // Seater Aisle
                            busType === 'sleeper' && i % 3 === 0 && "mr-4" // Sleeper Aisle
                          )}
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          {/* Seat Back / Pillow */}
                          <div className={cn(
                            "absolute left-0 right-0 h-2 rounded-t-lg",
                            busType === 'sleeper' ? "top-0 h-4" : "-top-1 h-2",
                            isBooked ? "bg-stone-600" : isWomenOnly ? "bg-pink-400" : "bg-brand-primary/80"
                          )} />
                          
                          {/* Women Icon */}
                          {isWomenOnly && !isBooked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Floor Details */}
                  <div className="absolute inset-0 pointer-events-none border-x border-white/5" />
                </motion.div>

                {/* Floor Shadow */}
                <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-stone-950 to-transparent opacity-50 blur-xl" />
              </div>

              <div className="mt-6 text-center">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                  Bus Model: ASHOK LEYLAND 2024
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeScreen === 'puzzle-challenge' && (
          <motion.div 
            key="puzzle-challenge"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="min-h-screen bg-stone-50 p-4 space-y-6 overflow-y-auto pb-24 relative"
          >
            {/* Floating Blur Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
              <motion.div 
                animate={{ 
                  x: [0, 100, 0], 
                  y: [0, 50, 0],
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute -top-20 -left-20 w-80 h-80 bg-amber-400/20 rounded-full blur-[100px]" 
              />
              <motion.div 
                animate={{ 
                  x: [0, -100, 0], 
                  y: [0, 100, 0],
                  scale: [1, 1.3, 1]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/3 -right-20 w-96 h-96 bg-emerald-400/20 rounded-full blur-[120px]" 
              />
              <motion.div 
                animate={{ 
                  x: [0, 50, 0], 
                  y: [0, -100, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-20 left-1/4 w-72 h-72 bg-sky-400/20 rounded-full blur-[90px]" 
              />
            </div>

            {/* Background Atmosphere Image */}
            <div className="absolute inset-0 -z-20 opacity-5 overflow-hidden pointer-events-none">
              <img 
                src="https://picsum.photos/seed/happy-family-temple/1080/1920?blur=2"
                className="w-full h-full object-cover"
                alt="Happy family exploring temple"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setActiveScreen('home')}
                className="p-2 bg-white/80 backdrop-blur-md rounded-xl shadow-sm text-stone-500 hover:text-brand-primary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-2 rounded-2xl shadow-[0_10px_20px_-5px_rgba(244,63,94,0.3)] text-white">
                <Trophy className="w-5 h-5" />
                <span className="font-display font-black">{points}</span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-display font-black text-stone-800 uppercase tracking-tight flex items-center justify-center gap-2">
                <Puzzle className="w-6 h-6 text-brand-primary" />
                {t.puzzleChallenge}
              </h2>
              <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">Kapaleeshwarar Temple, Chennai</p>
            </div>

            {/* Central Puzzle Grid */}
            <div className="relative aspect-[4/5] bg-white/40 backdrop-blur-xl rounded-[3rem] p-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden transform-gpu hover:rotate-x-1 hover:rotate-y-1 transition-transform duration-700" style={{ transformStyle: 'preserve-3d' }}>
              <div className="grid grid-cols-4 grid-rows-5 gap-2 h-full">
                {Array.from({ length: 20 }).map((_, i) => {
                  const isUnlocked = unlockedBlocks.includes(i);
                  return (
                    <motion.div 
                      key={i}
                      whileHover={isUnlocked ? { scale: 1.05, zIndex: 10, translateZ: 20 } : {}}
                      className={cn(
                        "relative rounded-xl overflow-hidden transition-all duration-500",
                        isUnlocked ? "shadow-xl ring-2 ring-white/50" : "bg-gradient-to-br from-stone-100/80 to-stone-200/80 backdrop-blur-sm"
                      )}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {isUnlocked ? (
                        <img 
                          src={`https://picsum.photos/seed/temple-detail-${i}/300/300`}
                          className="w-full h-full object-cover"
                          alt={`Puzzle piece ${i}`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative">
                          <span className="absolute top-1 left-2 text-[8px] font-black text-stone-400/50">{i + 1}</span>
                          <Lock className="w-5 h-5 text-stone-300" />
                          <div className="w-1 h-1 bg-stone-200 rounded-full" />
                        </div>
                      )}
                      {/* Grid lines overlay */}
                      <div className="absolute inset-0 border border-white/10 pointer-events-none" />
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Progress Overlay */}
              <div className="absolute top-6 right-6 bg-gradient-to-r from-emerald-400 to-cyan-500 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-[0_10px_20px_-5px_rgba(6,182,212,0.4)]">
                {unlockedBlocks.length}/20 {t.blocksUnlocked}
              </div>
            </div>

            {/* Gamification Panels */}
            <div className="grid grid-cols-2 gap-4">
              {/* Leaderboard */}
              <div className="bg-white/40 backdrop-blur-xl p-5 rounded-[2.5rem] shadow-xl border border-white/50 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-amber-100 rounded-lg">
                    <Crown className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t.leaderboard}</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { name: 'Arun', pts: 2450, avatar: 'https://i.pravatar.cc/150?u=arun' },
                    { name: 'Priya', pts: 2100, avatar: 'https://i.pravatar.cc/150?u=priya' },
                    { name: 'Me', pts: points, avatar: 'https://i.pravatar.cc/150?u=me', isMe: true }
                  ].map((user, i) => (
                    <div key={i} className={cn("flex items-center justify-between p-2.5 rounded-2xl transition-all", user.isMe ? "bg-white/60 ring-1 ring-amber-400/30 shadow-sm" : "bg-white/20")}>
                      <div className="flex items-center gap-2.5">
                        <img src={user.avatar} className="w-7 h-7 rounded-full border-2 border-white shadow-sm" alt={user.name} />
                        <span className="text-[10px] font-bold text-stone-700">{user.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-stone-400">{user.pts}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Badges */}
              <div className="bg-white/40 backdrop-blur-xl p-5 rounded-[2.5rem] shadow-xl border border-white/50 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-emerald-100 rounded-lg">
                    <Star className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t.badges}</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { name: t.history, color: 'from-amber-100 to-amber-200 text-amber-600', icon: History, unlocked: true },
                    { name: t.culture, color: 'from-emerald-100 to-emerald-200 text-emerald-600', icon: Globe, unlocked: true },
                    { name: t.architecture, color: 'from-sky-100 to-sky-200 text-sky-600', icon: Layout, unlocked: false },
                  ].map((badge, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ scale: 1.05, x: 5 }}
                      className={cn(
                        "p-3 rounded-2xl flex items-center gap-3 shadow-sm border border-white/50 relative overflow-hidden bg-gradient-to-br",
                        badge.color,
                        !badge.unlocked && "opacity-50 grayscale"
                      )}
                    >
                      <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-inner">
                        <badge.icon className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-tight">{badge.name}</span>
                        <span className="text-[8px] font-bold uppercase opacity-60">{badge.unlocked ? 'Unlocked' : 'Locked'}</span>
                      </div>
                      {badge.unlocked && (
                        <div className="absolute top-0 right-0 p-1">
                          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_5px_#fbbf24]" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hint Panel / Trivia */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-8 rounded-[3rem] space-y-6 shadow-2xl shadow-indigo-500/30 relative overflow-hidden backdrop-blur-xl border border-white/20">
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400/30 rounded-full blur-3xl" />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-xl border border-white/30">
                  <Info className="w-7 h-7" />
                </div>
                <h3 className="font-display font-black text-white text-2xl uppercase tracking-tight">{t.hint}</h3>
              </div>
              <p className="text-white font-bold text-lg leading-tight relative z-10">{t.triviaQuestion}</p>
              <div className="grid grid-cols-1 gap-3 relative z-10">
                {[
                  { id: 'a', text: t.optionA },
                  { id: 'b', text: t.optionB },
                  { id: 'c', text: t.optionC }
                ].map((opt) => (
                  <button 
                    key={opt.id}
                    onClick={() => setTriviaAnswered(opt.id)}
                    className={cn(
                      "w-full p-4 rounded-[1.5rem] font-bold text-sm transition-all text-left flex items-center justify-between shadow-lg backdrop-blur-md",
                      triviaAnswered === opt.id 
                        ? (opt.id === 'a' ? "bg-white text-indigo-600 scale-[1.02] shadow-white/20" : "bg-red-500 text-white")
                        : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                    )}
                  >
                    {opt.text}
                    {triviaAnswered === opt.id && (
                      opt.id === 'a' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Claim Reward Button */}
            <div className="pt-4">
              <button 
                onClick={() => {
                  setShowRewardClaimed(true);
                  setPoints(prev => prev + 500);
                }}
                className="w-full py-6 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-white rounded-[2.5rem] font-display font-black text-2xl uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(242,125,38,0.4)] flex items-center justify-center gap-4 group relative overflow-hidden active:scale-95 transition-all"
              >
                <Gift className="w-8 h-8 group-hover:scale-125 transition-transform" />
                {t.claimReward}
                
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
              </button>
            </div>

            {/* Reward Claimed Overlay */}
            <AnimatePresence>
              {showRewardClaimed && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                >
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRewardClaimed(false)} />
                  <motion.div 
                    initial={{ scale: 0.5, y: 100 }}
                    animate={{ scale: 1, y: 0 }}
                    className="relative bg-white rounded-[3rem] p-8 text-center space-y-6 shadow-2xl max-w-sm w-full"
                  >
                    <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto text-yellow-600">
                      <Trophy className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-display font-black text-stone-800 uppercase tracking-tight">Congratulations!</h2>
                      <p className="text-stone-500 font-bold">You've unlocked a treasure chest with 500 points!</p>
                    </div>
                    
                    {/* Confetti simulation */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3rem]">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <motion.div 
                          key={i}
                          initial={{ y: -20, x: Math.random() * 300 - 150, rotate: 0 }}
                          animate={{ y: 400, rotate: 360 }}
                          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "linear" }}
                          className="absolute w-2 h-2 rounded-sm"
                          style={{ backgroundColor: ['#FFD700', '#FF6321', '#00875A', '#38BDF8'][i % 4] }}
                        />
                      ))}
                    </div>

                    <button 
                      onClick={() => setShowRewardClaimed(false)}
                      className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
                    >
                      Awesome!
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

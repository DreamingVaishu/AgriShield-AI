import { useState, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { FirstPage } from './components/firstpage';
import { initializeClassifier, type PredictionResult } from './services/classifier';
import { saveScan, syncWithBackend } from './services/storage';
import { ArrowLeft, Share2, Info, ShieldCheck, RefreshCw } from 'lucide-react';

type Screen = 'home' | 'camera' | 'result' | 'history';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [scanResult, setScanResult] = useState<{ result: PredictionResult; imageUri: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const speak = (text: string, lang: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.95;
      utter.pitch = 1.0;
      synth.cancel();
      synth.speak(utter);
    } catch { void 0 }
  };

  const handleSync = async () => {
    if (navigator.onLine) {
      setIsSyncing(true);
      await syncWithBackend();
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    initializeClassifier();
    const onOnline = () => { void handleSync(); };
    window.addEventListener('online', onOnline);
    if (navigator.onLine) {
      setTimeout(() => { void handleSync(); }, 0);
    }
    return () => { window.removeEventListener('online', onOnline); };
  }, []);

  const handleCapture = (imageUri: string, result: PredictionResult) => {
    setScanResult({ imageUri, result });
    saveScan({
      disease: result.disease,
      confidence: result.confidence,
      imageUri,
      locationName: 'Detected Location' // Mock location
    });
    setCurrentScreen('result');
    speak(result.disease.treatmentHindi, 'hi-IN');
  };

  const handleBack = () => {
    setScanResult(null);
    setCurrentScreen('camera');
  };

  if (currentScreen === 'result' && scanResult) {
    const { result, imageUri } = scanResult;
    return (
      <div className="min-h-screen bg-nature-950 text-white pb-safe animate-slide-up">
        {/* Header Image */}
        <div className="relative h-80 w-full group">
          <img src={imageUri} alt="Scanned plant" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-nature-950 via-nature-950/20 to-transparent" />

          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
            <button
              onClick={handleBack}
              className="p-3 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition border border-white/10"
            >
              <ArrowLeft size={24} />
            </button>
            <button
              className="p-3 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition border border-white/10"
            >
              <Share2 size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 -mt-16 relative z-10 space-y-6">
          <div className="glass-card rounded-[2rem] p-6 backdrop-blur-xl bg-nature-900/80 border-nature-700/30 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white capitalize leading-tight mb-1">{result.disease.name}</h1>
                <p className="text-nature-300 text-sm font-medium">Detected Problem</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className={`p-2 rounded-full ${result.confidence > 80 ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' : 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'}`}>
                  <ShieldCheck size={20} />
                </div>
                <span className={`text-xs font-bold ${result.confidence > 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {result.confidence.toFixed(0)}% MATCH
                </span>
              </div>
            </div>

            <div className="h-px bg-nature-700/30 w-full mb-4" />

            <div className="flex gap-4">
              <div className="flex-1 bg-nature-950/50 rounded-2xl p-4 border border-nature-700/30">
                <span className="block text-xs text-nature-400 uppercase tracking-wider mb-2 font-semibold opacity-70">Severity</span>
                <span className={`text-lg font-bold capitalize ${result.disease.severity === 'high' ? 'text-red-400' :
                  result.disease.severity === 'medium' ? 'text-orange-400' : 'text-green-400'
                  }`}>
                  {result.disease.severity}
                </span>
              </div>
              <div className="flex-1 bg-nature-950/50 rounded-2xl p-4 border border-nature-700/30">
                <span className="block text-xs text-nature-400 uppercase tracking-wider mb-2 font-semibold opacity-70">Local Name</span>
                <span className="text-lg font-bold text-white line-clamp-1">{result.disease.nameHindi}</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-6 backdrop-blur-xl bg-nature-900/60 border-nature-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-nature-500/20 rounded-xl text-nature-300">
                <Info size={22} />
              </div>
              <h2 className="text-xl font-bold text-white">Treatment Plan</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-nature-950/30 p-4 rounded-xl border border-nature-700/20">
                <p className="text-nature-100 leading-relaxed text-sm">
                  {result.disease.treatment}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold text-nature-400 mb-2 uppercase tracking-wide opacity-80">In Hindi</h3>
                <div className="bg-nature-950/30 p-4 rounded-xl border border-nature-700/20">
                  <p className="text-nature-100 leading-relaxed text-sm font-medium">
                    {result.disease.treatmentHindi}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'home') {
    return (
      <FirstPage onStart={() => setCurrentScreen('camera')} />
    );
  }

  return (
    <div className="h-screen w-full bg-nature-950 relative">
      <CameraCapture onCapture={handleCapture} onError={(err) => alert(err)} />

      {/* Sync Indicator */}
      <div className="absolute top-4 right-4 z-50 pointer-events-none">
        {isSyncing && (
          <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-white/10">
            <RefreshCw size={12} className="animate-spin" />
            Syncing...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

import { Camera } from 'lucide-react';
import { useEffect, useState } from 'react';
import bg from '../assets/backgrond.png';

interface FirstPageProps {
  onStart: () => void;
}

export function FirstPage({ onStart }: FirstPageProps) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weather, setWeather] = useState<{ temperature?: number; humidity?: number; wind?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      if (!navigator.geolocation) {
        setError('Location unavailable');
        setLoading(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCoords({ lat, lon });
          try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('weather fetch failed');
            const data = await resp.json();
            const current = data.current || {};
            setWeather({
              temperature: current.temperature_2m,
              humidity: current.relative_humidity_2m,
              wind: current.wind_speed_10m
            });
            try {
              const rev = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`);
              if (rev.ok) {
                const g = await rev.json();
                const r = g.results && g.results[0];
                if (r) {
                  const parts = [r.name, r.admin1, r.country].filter(Boolean);
                  setPlace(parts.join(', '));
                }
              }
            } catch { void 0; }
          } catch {
            setError('No weather data');
          } finally {
            setLoading(false);
          }
        },
        () => {
          setError('Location denied');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    } catch {
      setError('Location error');
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-nature-950 text-white flex flex-col items-center justify-center relative">
      <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/20 pointer-events-none" />

      <div className="flex flex-col items-center gap-2 mb-12">
        <h1 className="text-3xl font-bold tracking-tight">AgriShield</h1>
        <p className="text-sm text-nature-300 font-medium tracking-wide uppercase">AI Plant Defense</p>
      </div>

      <button
        onClick={onStart}
        className="relative group"
      >
        <div className="absolute inset-0 bg-nature-400 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="w-40 h-40 rounded-full border-4 border-nature-900 bg-nature-800 flex items-center justify-center relative p-2 shadow-2xl">
          <div className="w-full h-full rounded-full border-2 border-nature-500/40 flex items-center justify-center group-active:scale-95 transition-transform duration-200 bg-gradient-to-tr from-nature-600 to-nature-400">
            <Camera size={64} className="text-white drop-shadow-md" />
          </div>
        </div>
      </button>

      <p className="mt-8 text-white/90 font-medium text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
        Tap to open camera
      </p>

      <div className="absolute bottom-4 left-0 right-0 px-6">
        <div className="mx-auto max-w-sm glass-card rounded-2xl p-4 backdrop-blur-xl bg-nature-900/70 border-nature-700/30 text-white">
          <div className="mb-2">
            <div className="text-lg font-bold">{place ? place : 'Location'}</div>
            <div className="text-xs text-nature-400">{coords ? `${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}` : ''}</div>
          </div>
          <div className="text-xs text-nature-300 font-semibold tracking-wider uppercase">Local Weather</div>
          <div className="h-px bg-nature-700/30 my-2" />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-nature-950/40 rounded-xl p-3 border border-nature-700/30">
              <div className="text-xs text-nature-400">Temp</div>
              <div className="text-lg font-bold">{loading ? '...' : weather?.temperature != null ? `${weather.temperature}°C` : error ? 'N/A' : '--'}</div>
            </div>
            <div className="bg-nature-950/40 rounded-xl p-3 border border-nature-700/30">
              <div className="text-xs text-nature-400">Humidity</div>
              <div className="text-lg font-bold">{loading ? '...' : weather?.humidity != null ? `${weather.humidity}%` : error ? 'N/A' : '--'}</div>
            </div>
            <div className="bg-nature-950/40 rounded-xl p-3 border border-nature-700/30">
              <div className="text-xs text-nature-400">Wind</div>
              <div className="text-lg font-bold">{loading ? '...' : weather?.wind != null ? `${weather.wind} km/h` : error ? 'N/A' : '--'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

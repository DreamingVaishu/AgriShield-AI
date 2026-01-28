import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, Leaf, ScanLine, Shield } from 'lucide-react';
import { classifyImage, calibrateHealthyLeaf, type PredictionResult } from '../services/classifier';

interface CameraCaptureProps {
    onCapture: (imageUri: string, result: PredictionResult) => void;
    onError: (error: string) => void;
}

export function CameraCapture({ onCapture, onError }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // const [isStreaming, setIsStreaming] = useState(false); // Unused
    const [isProcessing, setIsProcessing] = useState(false);

    const waitForVideoReady = useCallback((video: HTMLVideoElement) => {
        return new Promise<void>((resolve, reject) => {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                resolve();
                return;
            }
            const onLoaded = () => {
                resolve();
            };
            const onError = () => {
                reject(new Error('Camera not ready'));
            };
            video.addEventListener('loadedmetadata', onLoaded, { once: true });
            video.addEventListener('error', onError, { once: true });
        });
    }, []);


    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try { await videoRef.current.play(); } catch { void 0; }
                // setIsStreaming(true);
            }
        } catch (err) {
            console.error('Camera error:', err);
            onError('Could not access camera. Please allow permissions or use upload.');
        }
    }, [onError]);

    const stopCamera = useCallback(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            // setIsStreaming(false);
        }
    }, []);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [startCamera, stopCamera]);

    const handleCapture = async () => {
        if (!videoRef.current || !canvasRef.current || isProcessing) return;

        setIsProcessing(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                await waitForVideoReady(video);
            }

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get data URL for display/storage
            const imageUri = canvas.toDataURL('image/jpeg');

            // Run classification directly on the canvas element
            const result = await classifyImage(canvas);

            onCapture(imageUri, result);
        } catch (err) {
            console.error('Capture error:', err);
            onError('Failed to capture and analyze image.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    // Draw to canvas for consistent processing
                    const canvas = canvasRef.current;
                    if (canvas) {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0);

                        const result = await classifyImage(canvas);
                        onCapture(img.src, result);
                    }
                } catch {
                    onError('Failed to analyze uploaded image.');
                } finally {
                    setIsProcessing(false);
                }
            };
            img.src = e.target?.result as string;
        };

        reader.readAsDataURL(file);
    };

    const handleCalibrate = async () => {
        if (!videoRef.current || !canvasRef.current || isProcessing) return;
        setIsProcessing(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                calibrateHealthyLeaf(canvas);
            }
        } catch {
            onError('Calibration failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="relative h-full flex flex-col bg-nature-950 overflow-hidden">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 pt-safe-top pb-6 bg-gradient-to-b from-black/80 to-transparent">
                <div className="px-6 flex items-center gap-2">
                    <Shield className="text-nature-400 fill-nature-400/20" size={28} />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">AgriShield</h1>
                        <p className="text-xs text-nature-300 font-medium tracking-wide uppercase">AI Plant Defense</p>
                    </div>
                </div>
            </div>

            {/* Camera View */}
            <div className="flex-1 relative overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-nature-950/30 pointer-events-none" />

                {/* Hidden Canvas for processing */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning Frame */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center -mt-12">
                    <div className="relative w-72 h-72">
                        {/* Corner markers */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-nature-400 rounded-tl-2xl shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-nature-400 rounded-tr-2xl shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-nature-400 rounded-bl-2xl shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-nature-400 rounded-br-2xl shadow-[0_0_15px_rgba(74,222,128,0.5)]" />

                        {/* Scanner Line Animation */}
                        <div className="absolute inset-x-0 h-0.5 bg-nature-400/80 shadow-[0_0_20px_rgba(74,222,128,1)] animate-[scan_2s_ease-in-out_infinite]" style={{ top: '50%' }} />

                        {isProcessing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-3xl animate-fade-in">
                                <ScanLine className="w-16 h-16 text-nature-400 animate-pulse-ring" />
                                <p className="mt-4 text-nature-200 font-bold tracking-wider animate-pulse">ANALYZING...</p>
                            </div>
                        )}
                    </div>

                    {!isProcessing && (
                        <p className="mt-8 text-white/90 font-medium text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
                            Align plant within frame
                        </p>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="bg-nature-950/80 backdrop-blur-xl pb-safe-bottom pt-8 px-6 rounded-t-[2.5rem] border-t border-white/5 relative z-10 -mt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between max-w-sm mx-auto">
                    {/* Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 group"
                        disabled={isProcessing}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-nature-900/80 border border-nature-700/50 flex items-center justify-center group-active:scale-95 transition-all duration-200 hover:bg-nature-800 hover:border-nature-500/50">
                            <Upload size={24} className="text-nature-200 group-hover:text-nature-100" />
                        </div>
                        <span className="text-xs font-medium text-nature-400/60 group-hover:text-nature-300 transition-colors">Upload</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                    />

                    {/* Capture Button */}
                    <button
                        onClick={handleCapture}
                        disabled={isProcessing}
                        className="relative group -mt-12"
                    >
                        <div className="absolute inset-0 bg-nature-400 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="w-24 h-24 rounded-full border-4 border-nature-950 bg-nature-800 flex items-center justify-center relative p-1">
                            <div className="w-full h-full rounded-full border-2 border-nature-500/30 flex items-center justify-center group-active:scale-95 transition-transform duration-200 bg-gradient-to-tr from-nature-600 to-nature-400">
                                <Camera size={36} className="text-white drop-shadow-md" />
                            </div>
                        </div>
                    </button>

                    {/* Calibrate Button */}
                    <button
                        onClick={handleCalibrate}
                        disabled={isProcessing}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-nature-900/80 border border-nature-700/50 flex items-center justify-center group-active:scale-95 transition-all duration-200 hover:bg-nature-800 hover:border-nature-500/50">
                            <Leaf size={24} className="text-nature-200 group-hover:text-nature-100" />
                        </div>
                        <span className="text-xs font-medium text-nature-400/60 group-hover:text-nature-300 transition-colors">Calibrate</span>
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0%, 100% { transform: translateY(-140px); opacity: 0; }
                    10% { opacity: 1; }
                    50% { transform: translateY(140px); opacity: 1; }
                    90% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}

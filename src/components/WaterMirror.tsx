import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, Sliders, ChevronLeft, Sparkles, AlertCircle, Info, Settings, Play, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Ripple {
  x: number;
  y: number;
  age: number;
  intensity: number;
  speed: number;
}

interface WaterMirrorProps {
  onBack: () => void;
}

export default function WaterMirror({ onBack }: WaterMirrorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // States
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [wantsCamera, setWantsCamera] = useState<boolean>(true);
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(true);
  const [hideCursor, setHideCursor] = useState<boolean>(true);
  
  // Customization values
  const [refractionStrength, setRefractionStrength] = useState<number>(1.2);
  const [specularStrength, setSpecularStrength] = useState<number>(1.5);
  const [rippleLimit, setRippleLimit] = useState<number>(24);
  const [motionThreshold, setMotionThreshold] = useState<number>(30); // Brightness difference threshold
  const [waterHue, setWaterHue] = useState<'gold' | 'cyan' | 'jade' | 'cosmic'>('gold');
  const [rainMode, setRainMode] = useState<boolean>(true);

  // Sound/Ambient setting
  const [ambientAudio, setAmbientAudio] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientOscillators = useRef<any[]>([]);
  const filterModulationRef = useRef<{ mid: BiquadFilterNode; high: BiquadFilterNode; gain: GainNode } | null>(null);

  // Simulation variables
  const ripplesRef = useRef<Ripple[]>([]);
  const prevFrameData = useRef<Uint8ClampedArray | null>(null);
  const nextParticleSpawnTime = useRef<number>(0);
  const lastSoundTimeRef = useRef<number>(0);

  // FBO ping-pong simulation & MediaPipe Hands refs and states
  const [activeMode, setActiveMode] = useState<'liquid' | 'crystal'>('liquid');
  const [handsLoaded, setHandsLoaded] = useState<boolean>(false);
  const fingersRef = useRef<{ x: number; y: number }[]>([]);
  const prevFingersRef = useRef<{ x: number; y: number }[]>([]);
  const pointerActiveRef = useRef<boolean>(false);
  const handsRef = useRef<any>(null);
  const rainTimerRef = useRef<number>(0);

  // Theme configuration
  const hues = {
    gold: { name: '历劫重光 (Imperial Gold)', vec3: [1.0, 0.88, 0.7] as [number, number, number], hex: '#c9af7f' },
    cyan: { name: '白鹤青江 (Marine Cyan)', vec3: [0.6, 0.85, 1.0] as [number, number, number], hex: '#4ca3d9' },
    jade: { name: '江底碧玉 (River Jade)', vec3: [0.65, 0.92, 0.8] as [number, number, number], hex: '#52bf90' },
    cosmic: { name: '幽冥黛黑 (Cosmic Teal)', vec3: [0.45, 0.6, 0.72] as [number, number, number], hex: '#314e63' },
  };

  // 1. Initialize and Manage Sound (Web Audio API active synthesis for organic, flowing water stream sounds)
  const toggleAmbientSound = () => {
    if (ambientAudio) {
      // Stop ambient sound oscillators gently without freezing/closing the entire audio context
      ambientOscillators.current.forEach(osc => {
        try {
          osc.stop();
        } catch (e) {
          try {
            osc.disconnect();
          } catch (err) {}
        }
      });
      ambientOscillators.current = [];
      filterModulationRef.current = null;
      setAmbientAudio(false);
    } else {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const startSynthesizedWater = () => {
          // Create 2.5 seconds of high-quality White Noise loop buffer for natural water hiss & wash
          const bufferSize = ctx.sampleRate * 2.5;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const dataArr = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            dataArr[i] = Math.random() * 2 - 1;
          }

          const noiseSrc = ctx.createBufferSource();
          noiseSrc.buffer = noiseBuffer;
          noiseSrc.loop = true;

          // Parallel Filters to shape the white noise into a rich organic babbling river:
          // Band 1: Deep water gurgles / low stream rushing (lowpass @ 140Hz)
          const lowFilter = ctx.createBiquadFilter();
          lowFilter.type = 'lowpass';
          lowFilter.frequency.setValueAtTime(140, ctx.currentTime);

          // Band 2: Mid-range flowing ripples (bandpass @ 385Hz, modulated)
          const midFilter = ctx.createBiquadFilter();
          midFilter.type = 'bandpass';
          midFilter.Q.setValueAtTime(5.5, ctx.currentTime);
          midFilter.frequency.setValueAtTime(385, ctx.currentTime);

          // Band 3: High-frequency sparkling water foam (bandpass @ 800Hz, modulated)
          const highFilter = ctx.createBiquadFilter();
          highFilter.type = 'bandpass';
          highFilter.Q.setValueAtTime(9.5, ctx.currentTime);
          highFilter.frequency.setValueAtTime(800, ctx.currentTime);

          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.08, ctx.currentTime); // gentle babbling stream volume

          // Two slow LFOs modulating the bandpass center frequencies to simulate dynamic flowing currents
          const lfo1 = ctx.createOscillator();
          lfo1.frequency.setValueAtTime(0.09, ctx.currentTime); // slow swell

          const lfo1Gain = ctx.createGain();
          lfo1Gain.gain.setValueAtTime(140, ctx.currentTime); // sweeps mid range by 140Hz

          const lfo2 = ctx.createOscillator();
          lfo2.frequency.setValueAtTime(0.15, ctx.currentTime); // fast ripple flow

          const lfo2Gain = ctx.createGain();
          lfo2Gain.gain.setValueAtTime(250, ctx.currentTime); // sweeps high range by 250Hz

          lfo1.connect(lfo1Gain);
          lfo1Gain.connect(midFilter.frequency);

          lfo2.connect(lfo2Gain);
          lfo2Gain.connect(highFilter.frequency);

          // Slow master volume swell to mimic natural waves shifting
          const swellLfo = ctx.createOscillator();
          swellLfo.frequency.setValueAtTime(0.2, ctx.currentTime);
          const swellGain = ctx.createGain();
          swellGain.gain.setValueAtTime(0.012, ctx.currentTime);
          swellLfo.connect(swellGain);
          swellGain.connect(gainNode.gain);

          // Mix the independent filtering streams
          const mixer = ctx.createGain();
          mixer.gain.setValueAtTime(1.0, ctx.currentTime);

          noiseSrc.connect(lowFilter);
          noiseSrc.connect(midFilter);
          noiseSrc.connect(highFilter);

          lowFilter.connect(mixer);
          midFilter.connect(mixer);
          highFilter.connect(mixer);

          mixer.connect(gainNode);
          gainNode.connect(ctx.destination);

          noiseSrc.start();
          lfo1.start();
          lfo2.start();
          swellLfo.start();

          // Keep references for clean lifecycle
          ambientOscillators.current = [noiseSrc, lfo1, lfo2, swellLfo, mixer, gainNode];
          filterModulationRef.current = { mid: midFilter, high: highFilter, gain: gainNode };
          setAmbientAudio(true);
        };

        const tryLoadUserAudio = async () => {
          try {
            // Attempt to load the user's custom water sound first. 
            // In the AI Studio editor, upload your sound file to the 'public' folder and rename it to 'water_sound.mp3'.
            const response = await fetch('./water_sound.mp3');
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.loop = true;
              
              const gainNode = ctx.createGain();
              gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
              
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              source.start();
              
              ambientOscillators.current = [source, gainNode];
              // Provide dummy filters so the hover volume interaction logic still works without crashing
              filterModulationRef.current = { 
                mid: ctx.createBiquadFilter(), 
                high: ctx.createBiquadFilter(), 
                gain: gainNode 
              };
              setAmbientAudio(true);
              return;
            }
          } catch (e) {
             console.warn("Custom /water_sound.mp3 not found, falling back to synthesis...");
          }
          // Fallback to synthesis
          startSynthesizedWater();
        };

        tryLoadUserAudio();
      } catch (e) {
        console.error('Failed to init Web Audio', e);
      }
    }
  };

  // Clean ambient sound on unmount & Global 'F' Key Listener to Toggle Cursor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        setHideCursor(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Dynamic load MediaPipe Hands from CDN
  useEffect(() => {
    if ((window as any).Hands) {
      setHandsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
    script.async = true;
    script.onload = () => {
      setHandsLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load MediaPipe Hands from CDN');
    };
    document.head.appendChild(script);
  }, []);

  // Initialize MediaPipe Hands tracking loop
  useEffect(() => {
    if (!handsLoaded || !cameraActive || !videoRef.current) return;

    let active = true;
    const HandsClass = (window as any).Hands;
    if (!HandsClass) return;

    const hands = new HandsClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results: any) => {
      if (!active) return;
      const tips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky joint tips
      const found: { x: number; y: number }[] = [];
      if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
        for (const lm of results.multiHandLandmarks) {
          for (const t of tips) {
            if (lm[t]) {
              found.push({ x: lm[t].x, y: lm[t].y });
            }
          }
        }
      }

      if (found.length === 0) {
        prevFingersRef.current = [];
        fingersRef.current = [];
      } else {
        prevFingersRef.current = fingersRef.current.length === found.length ? fingersRef.current : found;
        fingersRef.current = found.slice(0, 10);
      }
    });

    handsRef.current = hands;

    let lastRun = 0;
    const processFrame = async () => {
      if (!active) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && hands) {
        const now = performance.now();
        if (now - lastRun > 60) { // Throttle to ~16fps to conserve resources
          lastRun = now;
          try {
            await hands.send({ image: video });
          } catch (e) {
            // safe ignore
          }
        }
      }
      if (active) {
        requestAnimationFrame(processFrame);
      }
    };

    requestAnimationFrame(processFrame);

    return () => {
      active = false;
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (e) {}
        handsRef.current = null;
      }
    };
  }, [handsLoaded, cameraActive]);

  // 2. Setup Camera Stream
  const isStartingCameraRef = useRef<boolean>(false);

  const startCamera = async () => {
    if (isStartingCameraRef.current) return;
    isStartingCameraRef.current = true;
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Catch and ignore common interruptions or autoplay denials
          videoRef.current.play()
            .then(() => {
              setCameraActive(true);
              setHasCamera(true);
            })
            .catch((err) => {
              console.warn('Playback promise caught/interrupted:', err);
            });
        }
      } else {
        throw new Error('浏览器不支持或未开启摄像头硬件。');
      }
    } catch (err: any) {
      console.warn('Camera failed:', err);
      setCameraError('无法启用摄像头。已自动切换至“数字墨意 fallback”模式，您仍然可以使用鼠标或触屏与水流进行完整顺畅的交互。');
      setCameraActive(false);
      setHasCamera(false);
    } finally {
      isStartingCameraRef.current = false;
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (e) {
        // Safe ignore
      }
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {}
        });
        videoRef.current.srcObject = null;
      }
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (hasEntered) {
      if (wantsCamera) {
        startCamera();
      } else {
        setCameraActive(false);
        setHasCamera(false);
      }
      
      // Lazily activate the sound automatically when entering
      if (!ambientAudio) {
        toggleAmbientSound();
      }
    }
    return () => {
      stopCamera();
    };
  }, [hasEntered, wantsCamera]);

  // 3. Spawning helper (Injects point directly into simulated physical waves)
  const addRipple = (x: number, y: number, intensity: number = 1.0) => {
    const pt = { x, y };
    fingersRef.current.push(pt);
    prevFingersRef.current.push(pt);
  };

  const customRippleBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    // Preload custom ripple sound
    const preloadSound = async () => {
      try {
        const response = await fetch('./water_sound.mp3');
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
          }
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          customRippleBufferRef.current = audioBuffer;
        }
      } catch (e) {
        // Ignored fallback
      }
    };
    preloadSound();
  }, []);

  // Sound triggering function for sparkling, gurgling ripple splashes & bubble sweeps
  const playRippleSound = (intensity: number, isGesture: boolean = false) => {
    // Lazily create audio context if it does not exist yet to play splash sounds
    if (!audioContextRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      } catch (e) {
        return;
      }
    }
    
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = Date.now();
    // Throttling: prevent too many overlapping sounds on high-rate frame loops
    const minInterval = isGesture ? 80 : 50;
    if (now - lastSoundTimeRef.current < minInterval) {
      return;
    }
    lastSoundTimeRef.current = now;

    try {
      if (customRippleBufferRef.current) {
        // Play custom user-provided sound
        const source = ctx.createBufferSource();
        source.buffer = customRippleBufferRef.current;
        
        // Add random pitch shifting for natural effect on rapid triggers
        source.playbackRate.value = 0.85 + Math.random() * 0.3;
        
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(intensity * 0.8, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0); // quick fade to avoid stacking noise
        
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(ctx.currentTime);
        
        return;
      }

      // Fallback: Spawn 2 to 3 fluid bubble droplets staggered in time for organic liquid depth
      const count = isGesture ? (Math.random() > 0.65 ? 2 : 1) : (Math.random() > 0.4 ? 3 : 2);
      
      for (let d = 0; d < count; d++) {
        const delay = d * (0.04 + Math.random() * 0.07); // stagger them
        
        // 1. Sine wave oscillator sweeping upwards quickly: the physics of a rising water bubble bursting!
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        
        const baseFreq = (isGesture ? 300 : 250) + Math.random() * 180;
        const targetFreq = baseFreq * (2.1 + Math.random() * 0.45); // double sweet resonance sweeps
        
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + delay + 0.13);
        
        // 2. High-Q bandpass filter giving the hollow, glass/wood click quality of real water droplets
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(12.0, ctx.currentTime + delay); 
        filter.frequency.setValueAtTime(baseFreq * 1.15, ctx.currentTime + delay);
        filter.frequency.exponentialRampToValueAtTime(targetFreq * 1.05, ctx.currentTime + delay + 0.13);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
        gainNode.gain.linearRampToValueAtTime(intensity * 0.045, ctx.currentTime + delay + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.15);
        
        // 3. Subtle lowpass filter to warm the output and make it sound lush and organic
        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.setValueAtTime(1400, ctx.currentTime + delay);
        
        osc.connect(filter);
        filter.connect(lpFilter);
        lpFilter.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.18);
      }
    } catch (e) {
      console.error('Ripple sound synthesis error:', e);
    }
  };

  // Mouse or touch interactions (Pointer Down, Move, Up)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    pointerActiveRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    // Direct pointer tracking (0-1 coords)
    const f = { x: nx, y: ny };
    prevFingersRef.current = [f];
    fingersRef.current = [f];

    playRippleSound(0.75, false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerActiveRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    const f = { x: nx, y: ny };
    prevFingersRef.current = fingersRef.current.length > 0 ? fingersRef.current : [f];
    fingersRef.current = [f];

    if (Math.random() < 0.22) {
      playRippleSound(0.6, true);
    }
  };

  const handlePointerUp = () => {
    pointerActiveRef.current = false;
    fingersRef.current = [];
    prevFingersRef.current = [];
  };

  // 4. Fallback texture generation (creating beautiful, high-contrast traditional calligraphy image in memory)
  const createFallbackTexture = (gl: WebGLRenderingContext, texture: WebGLTexture) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mystical dark slate blue background
      const grad = ctx.createRadialGradient(512, 384, 100, 512, 384, 600);
      grad.addColorStop(0, '#0a1d28');
      grad.addColorStop(1, '#03080d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 768);

      // Distant waves grid
      ctx.strokeStyle = 'rgba(201, 175, 127, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 1024; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 768); ctx.stroke();
      }
      for (let y = 0; y < 768; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }

      // Add a drawing of overlapping fish outlines (Traditional Baiheliang Stone Fish)
      ctx.strokeStyle = 'rgba(201, 175, 127, 0.12)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#c9af7f';
      ctx.shadowBlur = 15;
      
      // Draw fish 1
      ctx.beginPath();
      ctx.ellipse(512, 300, 110, 45, Math.PI / 12, 0, Math.PI * 2);
      ctx.stroke();
      // Tail 1
      ctx.beginPath();
      ctx.moveTo(400, 280);
      ctx.bezierCurveTo(340, 260, 340, 330, 390, 310);
      ctx.stroke();

      // Draw fish 2
      ctx.beginPath();
      ctx.ellipse(380, 480, 80, 35, -Math.PI / 8, 0, Math.PI * 2);
      ctx.stroke();

      // Traditional Calligraphy lettering in the background
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e5dec9';
      ctx.textAlign = 'center';
      ctx.font = '700 84px "Noto Serif CJK SC", "SimSun", serif';
      ctx.fillText('江 底 鳴 響', 512, 180);
      
      ctx.fillStyle = '#c9af7f';
      ctx.font = '500 24px "Noto Serif CJK SC", serif';
      ctx.fillText('— 白 鶴 梁 紀 錄 水 水 紋 鏡 —', 512, 235);

      ctx.fillStyle = 'rgba(229, 222, 201, 0.5)';
      ctx.font = '300 18px "PingFang SC", sans-serif';
      ctx.fillText('请移动鼠标、或开启摄像头摇晃双手 · 触摸跨越千年的水文脉动', 512, 600);
      
      // Fine-print history
      ctx.fillStyle = 'rgba(201, 175, 127, 0.35)';
      ctx.font = '400 14px "PingFang SC", sans-serif';
      ctx.fillText('“唐代广德元年，石鱼出水，双鱼环扣，预兆丰收”', 512, 640);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };

  // 5. Core WebGL + FBO double-buffered ping-pong fluid wave physics simulation + MediaPipe hand joint tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL is not supported on this browser');
      return;
    }

    // SIM_TYPE determination
    let SIM_TYPE = gl.UNSIGNED_BYTE;
    const floatExt = gl.getExtension('OES_texture_float');
    const halfExt = gl.getExtension('OES_texture_half_float');
    if (floatExt) {
      SIM_TYPE = gl.FLOAT;
    } else if (halfExt) {
      SIM_TYPE = (halfExt as any).HALF_FLOAT_OES || 0x8D61;
    }

    // 1. Shaders Definitions
    const VS_QUAD = `
      attribute vec2 position;
      varying vec2 vUV;
      void main() {
        vUV = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Heights simulation shader
    const FS_SIM = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D uPrev;
      uniform vec2 uTexel;
      uniform float uAspect;
      uniform float uTime;
      uniform float uDt;
      uniform vec4 uFingers0;
      uniform vec4 uFingers1;
      uniform vec4 uFingers2;
      uniform vec4 uFingers3;
      uniform vec4 uFingers4;
      uniform vec4 uFingerPrev0;
      uniform vec4 uFingerPrev1;
      uniform vec4 uFingerPrev2;
      uniform vec4 uFingerPrev3;
      uniform vec4 uFingerPrev4;
      uniform float uFingerCount;
      uniform float uModeCrystal;

      float capsuleSDF(vec2 p, vec2 a, vec2 b, float aspect) {
        vec2 P = vec2(p.x * aspect, p.y);
        vec2 A = vec2(a.x * aspect, a.y);
        vec2 B = vec2(b.x * aspect, b.y);
        vec2 ba = B - A;
        vec2 pa = P - A;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        return length(pa - ba * h);
      }

      void main() {
        vec2 uv = vUV;
        vec2 t = uTexel;

        // 9-tap isotropic laplacian
        float c  = texture2D(uPrev, uv).r;
        float n  = texture2D(uPrev, uv + vec2(0.0, t.y)).r;
        float s  = texture2D(uPrev, uv + vec2(0.0, -t.y)).r;
        float e  = texture2D(uPrev, uv + vec2(t.x, 0.0)).r;
        float w  = texture2D(uPrev, uv + vec2(-t.x, 0.0)).r;
        float ne = texture2D(uPrev, uv + vec2(t.x, t.y)).r;
        float nw = texture2D(uPrev, uv + vec2(-t.x, t.y)).r;
        float se = texture2D(uPrev, uv + vec2(t.x, -t.y)).r;
        float sw = texture2D(uPrev, uv + vec2(-t.x, -t.y)).r;

        float lap = 0.2*(n+s+e+w) + 0.05*(ne+nw+se+sw) - 1.0*c;

        float hOld = texture2D(uPrev, uv).g;

        // Wave propagation
        float k = 1.7;
        float hNew = 2.0 * c - hOld + k * lap;

        // Adaptive damping
        float a = abs(hNew);
        float damping = mix(0.90, 0.985, smoothstep(0.0, 0.2, a));
        hNew *= damping;

        // Deadzone threshold
        float deadzone = step(0.003, a);
        hNew *= deadzone;

        // Finger injecting capsules
        float radius = 0.024;
        float strength = 0.12;
        radius = mix(radius, 0.016, uModeCrystal);
        strength = mix(strength, 0.20, uModeCrystal);

        #define ADD_FINGER(IDX, CUR, PREV) \
          { \
            float active = step(float(IDX) + 0.5, uFingerCount); \
            float d1 = capsuleSDF(uv, PREV.xy, CUR.xy, uAspect); \
            float ring1 = smoothstep(radius, 0.0, d1); \
            hNew += active * strength * ring1; \
            float d2 = capsuleSDF(uv, PREV.zw, CUR.zw, uAspect); \
            float ring2 = smoothstep(radius, 0.0, d2); \
            hNew += active * strength * ring2; \
          }

        ADD_FINGER(0, uFingers0, uFingerPrev0)
        {
          float active = step(2.5, uFingerCount);
          float d1 = capsuleSDF(uv, uFingerPrev1.xy, uFingers1.xy, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d1);
          float d2 = capsuleSDF(uv, uFingerPrev1.zw, uFingers1.zw, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d2);
        }
        {
          float active = step(4.5, uFingerCount);
          float d1 = capsuleSDF(uv, uFingerPrev2.xy, uFingers2.xy, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d1);
          float d2 = capsuleSDF(uv, uFingerPrev2.zw, uFingers2.zw, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d2);
        }
        {
          float active = step(6.5, uFingerCount);
          float d1 = capsuleSDF(uv, uFingerPrev3.xy, uFingers3.xy, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d1);
          float d2 = capsuleSDF(uv, uFingerPrev3.zw, uFingers3.zw, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d2);
        }
        {
          float active = step(8.5, uFingerCount);
          float d1 = capsuleSDF(uv, uFingerPrev4.xy, uFingers4.xy, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d1);
          float d2 = capsuleSDF(uv, uFingerPrev4.zw, uFingers4.zw, uAspect);
          hNew += active * strength * smoothstep(radius, 0.0, d2);
        }

        // Edge fade
        vec2 edge = min(uv, 1.0 - uv);
        float edgeMask = smoothstep(0.0, 0.05, min(edge.x, edge.y));
        hNew *= mix(0.9, 1.0, edgeMask);

        hNew = clamp(hNew, -1.8, 1.8);
        gl_FragColor = vec4(hNew, c, 0.0, 1.0);
      }
    `;

    // Render / Refraction shader
    const FS_RENDER = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D uVideo;
      uniform sampler2D uSim;
      uniform vec2 uTexel;
      uniform vec2 uVideoTex; // scale, offset
      uniform float uModeCrystal;
      uniform vec2 uVideoFit;
      uniform float uTime;
      uniform float uRefrStr;
      uniform float uSpecStr;
      uniform vec3 uTintColor;

      vec3 sat(vec3 c, float s) {
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        return mix(vec3(l), c, s);
      }

      void main() {
        vec2 uv = vUV;

        // Heights
        float hC = texture2D(uSim, uv).r;
        float hL = texture2D(uSim, uv - vec2(uTexel.x, 0.0)).r;
        float hR = texture2D(uSim, uv + vec2(uTexel.x, 0.0)).r;
        float hD = texture2D(uSim, uv - vec2(0.0, uTexel.y)).r;
        float hU = texture2D(uSim, uv + vec2(0.0, uTexel.y)).r;

        vec2 grad = vec2(hR - hL, hU - hD);
        float lap = (hL + hR + hU + hD) - 4.0 * hC;

        float refrAmp = mix(0.08, 0.14, uModeCrystal) * uRefrStr;
        float lensAmp = mix(0.18, 0.35, uModeCrystal) * uRefrStr;

        vec2 baseOff = grad * refrAmp + grad * lap * lensAmp * 4.0;

        float disp = mix(0.007, 0.015, uModeCrystal);
        vec2 offR = baseOff * (1.0 + disp);
        vec2 offG = baseOff;
        vec2 offB = baseOff * (1.0 - disp);

        vec2 srcUV = (uv - 0.5) / uVideoFit + 0.5;
        vec2 mUV = vec2(uVideoTex.x * (srcUV.x - 0.5) + 0.5 + uVideoTex.y, srcUV.y);

        vec2 sR = clamp(mUV + offR, vec2(0.001), vec2(0.999));
        vec2 sG = clamp(mUV + offG, vec2(0.001), vec2(0.999));
        vec2 sB = clamp(mUV + offB, vec2(0.001), vec2(0.999));

        float r = texture2D(uVideo, sR).r;
        float g = texture2D(uVideo, sG).g;
        float b = texture2D(uVideo, sB).b;
        vec3 col = vec3(r, g, b);

        // Lighting / Fresnel
        vec3 N = normalize(vec3(-grad * 4.0, 1.0));
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 L = normalize(vec3(0.5, 0.7, 0.9));
        vec3 L2 = normalize(vec3(-0.6, -0.4, 0.7));

        float F0 = 0.02;
        float NdotV = clamp(dot(N, V), 0.0, 1.0);
        float fres = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

        vec3 H1 = normalize(L + V);
        vec3 H2 = normalize(L2 + V);
        float sharpSpec = pow(max(dot(N, H1), 0.0), 96.0) * uSpecStr;
        float broadSheen = pow(max(dot(N, H2), 0.0), 12.0) * 0.5 * uSpecStr;

        float crest = clamp(hC * 1.2, -1.0, 1.0);
        vec3 warm = vec3(1.04, 1.00, 0.95);
        vec3 cool = vec3(0.92, 0.96, 1.06);
        vec3 tint = mix(cool, warm, crest * 0.5 + 0.5);
        col *= mix(vec3(1.0), tint, 0.4);

        // Ambient tint coloring from state
        col = mix(col, col * uTintColor, 0.28);

        col *= 1.0 + crest * 0.08;

        vec3 specCol = mix(vec3(1.0, 0.95, 0.88), vec3(0.88, 0.96, 1.15), uModeCrystal);
        col += specCol * sharpSpec * (0.8 + 0.6 * fres);
        col += specCol * broadSheen * 0.35;

        vec3 sky = mix(vec3(0.15, 0.20, 0.32), vec3(0.50, 0.60, 0.90), smoothstep(-0.2, 1.0, N.y));
        col = mix(col, col * 0.6 + sky * 0.7, fres * mix(0.18, 0.45, uModeCrystal));

        col = mix(col, sat(col, 1.2) * 1.05, uModeCrystal);

        // Vignette
        vec2 q = uv - 0.5;
        float vig = 1.0 - dot(q, q) * 0.55;
        col *= vig;

        col = col / (1.0 + col * 0.04);
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    // 2. Compile shaders helper
    const compile = (type: number, src: string, name: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(`Shader compilation error [${name}]:`, gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const link = (vs: WebGLShader, fs: WebGLShader) => {
      const prog = gl.createProgram();
      if (!prog) return null;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Program linking failed:', gl.getProgramInfoLog(prog));
        gl.deleteProgram(prog);
        return null;
      }
      return prog;
    };

    const vsShader = compile(gl.VERTEX_SHADER, VS_QUAD, 'vs_quad');
    const fsSimShader = compile(gl.FRAGMENT_SHADER, FS_SIM, 'fs_sim');
    const fsRenShader = compile(gl.FRAGMENT_SHADER, FS_RENDER, 'fs_render');

    if (!vsShader || !fsSimShader || !fsRenShader) return;

    const progSim = link(vsShader, fsSimShader);
    const progRender = link(vsShader, fsRenShader);

    if (!progSim || !progRender) return;

    // Quad geometry buffer
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW);

    // Initializing simulation width/height FBO textures
    const SIM_W = 256;
    const SIM_H = 256;

    const createSimTex = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      let filter = gl.LINEAR;
      if (SIM_TYPE === gl.FLOAT && !gl.getExtension('OES_texture_float_linear')) {
        filter = gl.NEAREST;
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM_W, SIM_H, 0, gl.RGBA, SIM_TYPE, null);
      return tex;
    };

    const createFBO = (tex: WebGLTexture) => {
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return fbo;
    };

    const texA = createSimTex();
    const texB = createSimTex();
    if (!texA || !texB) return;

    const fboA = createFBO(texA);
    const fboB = createFBO(texB);

    // Default Calligraphy visual texture unit
    const videoTexture = gl.createTexture();
    if (!videoTexture) return;
    createFallbackTexture(gl, videoTexture);

    // Uniform Caching Sim
    const uniSimPrev = gl.getUniformLocation(progSim, 'uPrev');
    const uniSimTexel = gl.getUniformLocation(progSim, 'uTexel');
    const uniSimAspect = gl.getUniformLocation(progSim, 'uAspect');
    const uniSimTime = gl.getUniformLocation(progSim, 'uTime');
    const uniSimDt = gl.getUniformLocation(progSim, 'uDt');
    const uniSimCount = gl.getUniformLocation(progSim, 'uFingerCount');
    const uniSimMode = gl.getUniformLocation(progSim, 'uModeCrystal');
    const uniSimF = [
      gl.getUniformLocation(progSim, 'uFingers0'),
      gl.getUniformLocation(progSim, 'uFingers1'),
      gl.getUniformLocation(progSim, 'uFingers2'),
      gl.getUniformLocation(progSim, 'uFingers3'),
      gl.getUniformLocation(progSim, 'uFingers4'),
    ];
    const uniSimFP = [
      gl.getUniformLocation(progSim, 'uFingerPrev0'),
      gl.getUniformLocation(progSim, 'uFingerPrev1'),
      gl.getUniformLocation(progSim, 'uFingerPrev2'),
      gl.getUniformLocation(progSim, 'uFingerPrev3'),
      gl.getUniformLocation(progSim, 'uFingerPrev4'),
    ];

    // Uniform Caching Render
    const uniRenVideo = gl.getUniformLocation(progRender, 'uVideo');
    const uniRenSim = gl.getUniformLocation(progRender, 'uSim');
    const uniRenTexel = gl.getUniformLocation(progRender, 'uTexel');
    const uniRenVideoTex = gl.getUniformLocation(progRender, 'uVideoTex');
    const uniRenMode = gl.getUniformLocation(progRender, 'uModeCrystal');
    const uniRenVideoFit = gl.getUniformLocation(progRender, 'uVideoFit');
    const uniRenTime = gl.getUniformLocation(progRender, 'uTime');
    const uniRenRefr = gl.getUniformLocation(progRender, 'uRefrStr');
    const uniRenSpec = gl.getUniformLocation(progRender, 'uSpecStr');
    const uniRenTint = gl.getUniformLocation(progRender, 'uTintColor');

    // Run loops
    let startTime = Date.now();
    let lastTime = Date.now();
    let curRead = 0;

    const tick = () => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const now = Date.now();
      const dt = Math.min((now - lastTime) * 0.001, 0.05);
      lastTime = now;

      const elapsed = (now - startTime) * 0.001;
      const mirror = cameraActive;

      // 1. Check if video needs upload
      const video = videoRef.current;
      const isVideoReady = cameraActive && video && video.readyState >= 2;

      if (isVideoReady) {
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }

      // 1b. Real-time CV Frame-Differencing Motion Detection (Extremely robust, zero-dependency, works on any action)
      const hiddenCanvas = hiddenCanvasRef.current;
      if (isVideoReady && hiddenCanvas) {
        const hctx = hiddenCanvas.getContext('2d');
        if (hctx) {
          hctx.drawImage(video, 0, 0, 48, 36);
          const imgData = hctx.getImageData(0, 0, 48, 36);
          const data = imgData.data;

          if (prevFrameData.current) {
            const prev = prevFrameData.current;
            let sumX = 0, sumY = 0, motionPointsCount = 0;

            for (let y = 0; y < 36; y++) {
              for (let x = 0; x < 48; x++) {
                const idx = (y * 48 + x) * 4;
                const brightness = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                const prevBright = prev[y * 48 + x];
                const diff = Math.abs(brightness - prevBright);

                if (diff > motionThreshold) {
                  sumX += x;
                  sumY += y;
                  motionPointsCount++;

                  // Spawn interactive ripples at the moving coordinates
                  if (Math.random() < 0.04) {
                    const rx = x / 48.0;
                    const ry = y / 36.0;
                    addRipple(rx, ry, diff / 255.0);
                  }
                }
                prev[y * 48 + x] = brightness;
              }
            }

            // If there's concentrated movement, trigger localized waves and splash sounds
            if (motionPointsCount > 6) {
              const cx = (sumX / motionPointsCount) / 48.0;
              const cy = (sumY / motionPointsCount) / 36.0;
              if (Math.random() < 0.15) {
                addRipple(cx, cy, 0.4);
                playRippleSound(0.25, true);
              }
            }
          } else {
            const brightnessArr = new Uint8ClampedArray(48 * 36);
            for (let i = 0; i < 48 * 36; i++) {
              const idx = i * 4;
              brightnessArr[i] = (data[idx] + data[idx+1] + data[idx+2]) / 3;
            }
            prevFrameData.current = brightnessArr;
          }
        }
      }

      // 2. Rainforest Raindrop injection
      if (rainMode && now > rainTimerRef.current) {
        const rx = Math.random() * 0.9 + 0.05;
        const ry = Math.random() * 0.9 + 0.05;
        
        const pt = { x: rx, y: ry };
        fingersRef.current.push(pt);
        prevFingersRef.current.push(pt);

        if (Math.random() < 0.28) {
          playRippleSound(Math.random() * 0.25 + 0.15, false);
        }
        rainTimerRef.current = now + Math.random() * 600 + 400;
      }

      // 3. Sound sweeps for background ambient and dynamic modulation
      if (ambientAudio) {
        if (Math.random() < 0.03) {
          playRippleSound(Math.random() * 0.12 + 0.04, false);
        }
        
        // Responsive real-time synthesis sweeps
        if (filterModulationRef.current) {
          const hasInteraction = (fingersRef.current && fingersRef.current.length > 0) || pointerActiveRef.current;
          const targetGain = hasInteraction ? 0.22 : 0.08; // volume swell
          const targetMid = hasInteraction ? 550.0 : 385.0; // sweep frequency midband up
          const targetHigh = hasInteraction ? 1150.0 : 800.0; // sweep highband frequency up
          
          try {
            const ctx = audioContextRef.current;
            if (ctx) {
              filterModulationRef.current.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.1);
              filterModulationRef.current.mid.frequency.setTargetAtTime(targetMid, ctx.currentTime, 0.12);
              filterModulationRef.current.high.frequency.setTargetAtTime(targetHigh, ctx.currentTime, 0.12);
            }
          } catch (e) {
            // ignore rare audio context sync issues
          }
        }
      }

      // Get lists and prepare drawing bounds
      const frameFingers = [...fingersRef.current];
      const framePrevFingers = [...prevFingersRef.current];

      // Clear pointers inside fallback mode loop so clicks aren't sticking on frame boundary
      if (!pointerActiveRef.current && !handsRef.current) {
        fingersRef.current = [];
        prevFingersRef.current = [];
      } else if (pointerActiveRef.current) {
        prevFingersRef.current = [...fingersRef.current];
      }

      // Simulation Step (Write into writeFBO)
      const readTex = (curRead === 0) ? texA : texB;
      const writeFBO = (curRead === 0) ? fboB : fboA;

      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
      gl.viewport(0, 0, SIM_W, SIM_H);
      gl.useProgram(progSim);

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      const locPosSim = gl.getAttribLocation(progSim, 'position');
      gl.enableVertexAttribArray(locPosSim);
      gl.vertexAttribPointer(locPosSim, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTex);
      gl.uniform1i(uniSimPrev, 0);

      gl.uniform2f(uniSimTexel, 1.0 / SIM_W, 1.0 / SIM_H);
      gl.uniform1f(uniSimAspect, canvas.width / canvas.height);
      gl.uniform1f(uniSimTime, elapsed);
      gl.uniform1f(uniSimDt, dt);
      gl.uniform1f(uniSimMode, activeMode === 'crystal' ? 1.0 : 0.0);

      // Pack fingers
      const fcnt = Math.min(frameFingers.length, 10);
      gl.uniform1f(uniSimCount, fcnt);

      const cVec = [0,0,0,0,  0,0,0,0,  0,0,0,0,  0,0,0,0,  0,0,0,0];
      const pVec = [0,0,0,0,  0,0,0,0,  0,0,0,0,  0,0,0,0,  0,0,0,0];

      for (let i = 0; i < fcnt; i++) {
        const slot = (i >> 1) * 4 + ((i & 1) ? 2 : 0);
        const mirrorX = mirror ? (1.0 - frameFingers[i].x) : frameFingers[i].x;
        cVec[slot] = mirrorX;
        cVec[slot+1] = 1.0 - frameFingers[i].y;

        const p = framePrevFingers[i] || frameFingers[i];
        const mirrorPX = mirror ? (1.0 - p.x) : p.x;
        pVec[slot] = mirrorPX;
        pVec[slot+1] = 1.0 - p.y;
      }

      for (let i = 0; i < 5; i++) {
        gl.uniform4f(uniSimF[i], cVec[i*4], cVec[i*4+1], cVec[i*4+2], cVec[i*4+3]);
        gl.uniform4f(uniSimFP[i], pVec[i*4], pVec[i*4+1], pVec[i*4+2], pVec[i*4+3]);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Flip buffer
      curRead = 1 - curRead;

      // Render Stage (Write onto full screen canvas)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(progRender);

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      const locPosRen = gl.getAttribLocation(progRender, 'position');
      gl.enableVertexAttribArray(locPosRen);
      gl.vertexAttribPointer(locPosRen, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
      gl.uniform1i(uniRenVideo, 0);

      gl.activeTexture(gl.TEXTURE1);
      const lastWritten = (curRead === 0) ? texA : texB;
      gl.bindTexture(gl.TEXTURE_2D, lastWritten);
      gl.uniform1i(uniRenSim, 1);

      gl.uniform2f(uniRenTexel, 1.0 / SIM_W, 1.0 / SIM_H);
      gl.uniform2f(uniRenVideoTex, mirror ? -1.0 : 1.0, 0.0);
      gl.uniform1f(uniRenMode, activeMode === 'crystal' ? 1.0 : 0.0);

      const vw = video?.videoWidth || 1024;
      const vh = video?.videoHeight || 768;
      const ca = canvas.width / canvas.height;
      const va = vw / vh;
      let sx = 1.0, sy = 1.0;
      if (ca > va) {
        sy = ca / va;
      } else {
        sx = va / ca;
      }
      gl.uniform2f(uniRenVideoFit, sx, sy);
      gl.uniform1f(uniRenTime, elapsed);
      gl.uniform1f(uniRenRefr, refractionStrength);
      gl.uniform1f(uniRenSpec, specularStrength);

      const colorTintVec = hues[waterHue].vec3;
      gl.uniform3f(uniRenTint, colorTintVec[0], colorTintVec[1], colorTintVec[2]);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameId.current = requestAnimationFrame(tick);
    };

    animationFrameId.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      gl.deleteTexture(texA);
      gl.deleteTexture(texB);
      gl.deleteTexture(videoTexture);
      gl.deleteFramebuffer(fboA);
      gl.deleteFramebuffer(fboB);
      gl.deleteProgram(progSim);
      gl.deleteProgram(progRender);
    };
  }, [cameraActive, refractionStrength, specularStrength, waterHue, rainMode, activeMode, handsLoaded]);

  return (
    <div className={`relative w-full h-screen overflow-hidden bg-[#050505] ${(hideCursor && hasEntered) ? 'hide-cursor' : ''}`}>
      <AnimatePresence>
        {!hasEntered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full z-50 bg-[#061118] text-[#e5dec9] flex flex-col justify-between p-8 md:p-16 select-none"
          >
            {/* Ambient water reflection flow lines background */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full select-none text-[#c9af7f]">
                <path d="M0 50 Q25 40 50 50 T100 50 L100 100 L0 100 Z" fill="currentColor"/>
              </svg>
            </div>

            {/* Glowing round portal resembling the water mirror */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[500px] max-h-[500px] border border-[#c9af7f]/10 rounded-full blur-[30px] opacity-30 select-none pointer-events-none" />

            {/* Top Header */}
            <div className="flex justify-between items-center z-10 w-full">
              <div className="flex items-center gap-2">
                <span className="text-[#c9af7f] text-[10px] tracking-[4px] font-mono font-bold">ROOM_02</span>
                <span className="w-8 h-[1px] bg-[#c9af7f]/30"></span>
                <span className="text-white/40 text-[9px] tracking-[3px] font-mono">AQUAFORM</span>
              </div>
              <button
                onClick={onBack}
                className="text-xs font-mono tracking-widest text-[#e5dec9]/60 hover:text-[#c9af7f] transition duration-200 cursor-none flex items-center gap-1 border border-white/10 hover:border-[#c9af7f]/40 px-3 py-1.5 rounded bg-white/5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>返回展殿</span>
              </button>
            </div>

            {/* Center Content */}
            <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6 md:gap-8 z-10 my-auto">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#c9af7f]/15 border border-[#c9af7f]/40 rounded-full text-[10px] tracking-[3px] text-[#c9af7f] uppercase font-bold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>白鹤梁 · 数智流体镜像</span>
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.7 }}
                className="space-y-4"
              >
                <h1 className="text-4xl md:text-5xl font-serif tracking-[6px] text-[#e5dec9] font-black leading-tight">
                  步 入 互 动 水 镜
                </h1>
                <p className="text-[#c9af7f] tracking-[10px] text-[10px] uppercase font-mono pl-2 block opacity-80">
                  Step Into The Aquatic Mirror Lab
                </p>
              </motion.div>

              <motion.p
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-slate-300 text-xs md:text-[14px] leading-[2.1] tracking-wider text-justify md:text-center max-w-xl text-[#e5dec9]/75"
              >
                触摸横亘江底千载的枯水脉动。在这里，我们将长江的水流气韵抽取重构为数字镜像。您可以选择启用设备摄像头进行手势追踪控制，亦或利用鼠标或触控屏幕激荡水波，通过数字流体唤醒被时间湮没的石鱼刻文。
              </motion.p>

              {/* Action Choices */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.9 }}
                className="flex flex-col sm:flex-row gap-4 items-center mt-4 w-full justify-center"
              >
                {/* Choice 1: Camera Gestures */}
                <button
                  onClick={() => {
                    setWantsCamera(true);
                    setHasEntered(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#c9af7f] hover:bg-[#e5dec9] text-black font-bold tracking-widest text-xs px-8 py-4 rounded cursor-none transition duration-300 transform hover:scale-[1.03] shadow-[0_15px_30px_rgba(201,175,127,0.15)]"
                >
                  <Camera className="w-4 h-4" />
                  <span>启用摄像头镜面 · 手势挥浪</span>
                </button>

                {/* Choice 2: Quiet Pointer */}
                <button
                  onClick={() => {
                    setWantsCamera(false);
                    setHasEntered(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 border border-white/20 hover:border-[#c9af7f]/40 hover:text-[#c9af7f] bg-white/5 hover:bg-white/10 text-white/95 font-bold tracking-widest text-xs px-8 py-4 rounded cursor-none transition duration-300 transform hover:scale-[1.03]"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>静默心游 · 触控水流体验</span>
                </button>
              </motion.div>
            </div>

            {/* Bottom info section */}
            <div className="flex flex-col sm:flex-row justify-between items-center text-[9px] text-white/30 tracking-[2px] font-mono z-10 gap-2 border-t border-white/5 pt-6 mt-4">
              <span>* SYSTEM STATUS: AQ_SIMULATOR READY</span>
              <span className="text-center sm:text-right">建议光线充足、环境静默时开启镜面手势交互</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden webcam player & CV scanner canvases */}
      <video
        ref={videoRef}
        className="absolute pointer-events-none opacity-0 w-1 h-1 -left-[9999px]"
        playsInline
        muted
        width="320"
        height="240"
      />
      <canvas
        ref={hiddenCanvasRef}
        width="48"
        height="36"
        className="hidden"
      />

      {/* Main interactive WebGL Fluid Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Retro-Futuristic Digital HUD & Controller Interface */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#050505]/90 to-transparent z-20 pointer-events-none flex items-center justify-between px-8">
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            onClick={() => {
              stopCamera();
              onBack();
            }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 hover:text-cyan-400 text-white/90 border border-white/10 px-4 py-2 rounded text-xs tracking-wider uppercase transition cursor-none backdrop-blur-md"
            aria-label="返回展廊"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-400" />
            <span>返回博物馆</span>
          </button>
          
          <div className="hidden md:flex flex-col border-l border-white/10 pl-4">
            <span className="text-cyan-400 font-light tracking-[0.25em] text-sm uppercase">数字水镜拟流室</span>
            <span className="text-white/40 text-[9px] tracking-[0.3em] font-mono">AQUAFORM GESTURE WATER LAB</span>
          </div>
        </div>

        {/* HUD status bars */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={toggleAmbientSound}
            className={`px-3 py-1.5 rounded border text-[10px] font-mono tracking-widest transition cursor-none flex items-center gap-1.5 ${
              ambientAudio 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            <span>AUDIO:</span>
            <span>{ambientAudio ? 'ON (135Hz)' : 'OFF'}</span>
          </button>

          <div className={`px-3 py-1.5 rounded border text-[10px] font-mono tracking-widest flex items-center gap-2 ${
            cameraActive 
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cameraActive ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-amber-400'}`}></span>
            <span>{cameraActive ? 'LEAP ACTIVE' : 'TOUCH SIMULATE'}</span>
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 rounded bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 transition cursor-none"
            title="水流调节面板"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Floating Interactive Settings Card */}
      {showConfig && (
        <div className="absolute right-6 top-28 w-80 bg-black/75 border border-white/10 text-slate-200 p-5 rounded shadow-[0_30px_70px_rgba(0,0,0,0.85)] backdrop-blur-xl z-20 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="font-sans text-[11px] font-light tracking-[0.2em] text-white/80 uppercase">Simulation Parameters</span>
            </div>
          </div>

          {/* Camera Trigger Toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-white/35 text-[9px] font-mono tracking-[0.2em] uppercase">Hardware Intake</span>
            {cameraActive ? (
              <button
                onClick={() => {
                  stopCamera();
                  prevFrameData.current = null;
                }}
                className="w-full py-2 bg-red-950/20 border border-red-500/30 hover:bg-red-955/40 rounded text-[10px] text-red-300 tracking-wider uppercase font-medium transition cursor-none flex items-center justify-center gap-2"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>关闭视频采集 / INTAKE OFF</span>
              </button>
            ) : (
              <button
                onClick={startCamera}
                className="w-full py-2 bg-cyan-950/20 border border-cyan-500/30 hover:bg-cyan-955/40 rounded text-[10px] text-cyan-300 tracking-wider uppercase font-medium transition cursor-none flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(34,211,238,0.1)]"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>开启摄像头镜面手势 / INTAKE ON</span>
              </button>
            )}
          </div>

          {/* Wave Simulation Style */}
          <div className="flex flex-col gap-1.5 border-b border-white/5 pb-3">
            <span className="text-white/35 text-[9px] font-mono tracking-[0.2em] uppercase">WAVE SIMULATION STYLE</span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                onClick={() => setActiveMode('liquid')}
                className={`py-2 px-1.5 text-center rounded border transition cursor-none flex flex-col items-center justify-center gap-1 ${
                  activeMode === 'liquid'
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 font-medium shadow-[0_0_8px_rgba(6,182,212,0.1)]'
                    : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/15'
                }`}
              >
                <span className="font-serif text-xs font-semibold">粘连流动</span>
                <span className="text-[8px] opacity-60 tracking-wider">VISCOUS LIQUID</span>
              </button>
              <button
                onClick={() => setActiveMode('crystal')}
                className={`py-2 px-1.5 text-center rounded border transition cursor-none flex flex-col items-center justify-center gap-1 ${
                  activeMode === 'crystal'
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 font-medium shadow-[0_0_8px_rgba(6,182,212,0.1)]'
                    : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/15'
                }`}
              >
                <span className="font-serif text-xs font-semibold">剔透折射</span>
                <span className="text-[8px] opacity-60 tracking-wider">CRYSTAL GLAZE</span>
              </button>
            </div>
          </div>

          {/* Parameter Sliders */}
          <div className="flex flex-col gap-4">
            {/* Refraction slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-white/50 uppercase tracking-widest">水流折射强度</span>
                <span className="text-cyan-400">{refractionStrength.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={refractionStrength}
                onChange={(e) => setRefractionStrength(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-white/5 h-1 rounded cursor-none"
              />
            </div>

            {/* Specular slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-white/50 uppercase tracking-widest">表面反光高亮</span>
                <span className="text-cyan-400">{specularStrength.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="4.0"
                step="0.1"
                value={specularStrength}
                onChange={(e) => setSpecularStrength(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-white/5 h-1 rounded cursor-none"
              />
            </div>

            {/* Motion threshold slider */}
            {cameraActive && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/50 uppercase tracking-widest">手势防噪灵敏度</span>
                  <span className="text-cyan-400">{101 - motionThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="55"
                  step="1"
                  value={motionThreshold}
                  onChange={(e) => setMotionThreshold(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 bg-white/5 h-1 rounded cursor-none"
                />
              </div>
            )}
          </div>

          {/* Theme Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-white/35 text-[9px] font-mono tracking-[0.2em] uppercase">COLOR SHIFT COMPOSITION</span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {Object.entries(hues).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setWaterHue(key as any)}
                  className={`py-1.5 px-2 text-left rounded border transition cursor-none ${
                    waterHue === key 
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 font-medium shadow-[0_0_8px_rgba(6,182,212,0.1)]' 
                      : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: value.hex }}></span>
                    <span className="truncate">{value.name.split(' ')[0]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Rainforest raindrop simulator toggle */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide font-serif text-white/80">天降甘霖 (雨落模拟)</span>
              <span className="text-[9px] text-white/30 tracking-wider">无操作时亦有细点泛起层浪</span>
            </div>
            <button
              onClick={() => setRainMode(!rainMode)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-none ${
                rainMode ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-black transition-transform ${
                rainMode ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>
        </div>
      )}

      {/* Floating Instructions Banner at Bottom */}
      <div className="absolute inset-x-0 bottom-6 z-20 pointer-events-none flex justify-center">
        <div className="pointer-events-auto max-w-lg bg-black/75 border border-white/10 text-white/80 p-3.5 rounded-full px-6 flex items-center gap-3 shadow-xl backdrop-blur-sm">
          <Info className="w-4 h-4 text-[#c9af7f] shrink-0" />
          <p className="text-xs leading-relaxed text-slate-300">
            {cameraActive 
              ? '已成功锁定摄像头。请退后1.5米轻轻挥色，重现古人“白鹤时飞、涟漪叠浪”的手势触控江水。按“F”键可自由显示/隐藏鼠标。' 
              : '当前为触控仿真。请用鼠标按住并快速拖拽以触动粘连流淌的水流。按“F”键可自由显示/隐藏鼠标指针。'}
          </p>
        </div>
      </div>

      {/* Camera warning alert if failed */}
      {cameraError && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md bg-amber-950/90 border border-amber-500/30 text-amber-100 p-4 rounded-lg shadow-xl backdrop-blur-sm">
          <div className="flex gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold font-serif text-[#c9af7f]">水镜提示 (Notice)</span>
              <p className="text-[11px] leading-relaxed text-slate-300">{cameraError}</p>
              <button
                onClick={() => setCameraError(null)}
                className="self-end mt-1.5 text-[10px] font-mono text-[#c9af7f] hover:underline cursor-none"
              >
                我知道了 (Dismiss)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

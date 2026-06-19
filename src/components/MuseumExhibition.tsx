import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, ArrowRight, Anchor, Eye, Sparkles, BookOpen, Compass, ShieldAlert, Award, X, Terminal, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

gsap.registerPlugin(ScrollTrigger);

interface MuseumExhibitionProps {
  onEnterMirror: () => void;
}

export default function MuseumExhibition({ onEnterMirror }: MuseumExhibitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const magicCardRef = useRef<HTMLDivElement | null>(null);

  // States & Refs for Smooth Lerping Spotlight
  const spotlightTargetRef = useRef({ x: 160, y: 242 }); // card center defaults (320w, 485h)
  const spotlightCurrentRef = useRef({ x: 160, y: 242 });
  const spotlightActiveRef = useRef(false);
  const [spotlightPos, setSpotlightPos] = useState({ x: '50%', y: '50%' });
  const [isHovered, setIsHovered] = useState(false);

  // Secondary sub-view detail page state
  const [activeDetail, setActiveDetail] = useState<string | null>(null);

  // Particle disintegration refs
  const disintegrationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeClosingParticlesRef = useRef<any[]>([]);
  const disintegrationFrameIdRef = useRef<number | null>(null);

  // Elastic spring rebound physics for horizontal scroll
  const innerWrapperRef = useRef<HTMLDivElement | null>(null);
  const springRef = useRef({
    pos: 0,
    vel: 0,
    k: 0.15,      // Spring constant / stiffness
    damp: 0.78,   // Damping ratio
  });

  // 3D Stele Rotation State
  const [steleRotation, setSteleRotation] = useState({ x: 0, y: 0 });
  const isDraggingStele = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Stele Particles
  const [steleParticles] = useState(() => Array.from({ length: 45 }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 1,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
    opacity: Math.random() * 0.5 + 0.3
  })));

  const particleMaskStyle = {
    WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 1.5px, rgba(0,0,0,0.2) 2.5px)',
    maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 1.5px, rgba(0,0,0,0.2) 2.5px)',
    WebkitMaskSize: '4px 4px',
    maskSize: '4px 4px'
  };

  const DETAIL_DATA = {
    stone1: {
      id: 'stone1',
      title: '张楫题诗',
      subtitle: '历代文墨 · 张楫题诗',
      era: '-',
      image: './images/张楫题诗.png',
      content: [
        '江石有双鳞，沉浮验年岁。隐微宜自规，凶乐正相系。古人形此镌，览者发长喟。勿谓仰无闻，顺理终有泻。大明正德庚午郡人张楫题。'
      ],
      specs: [
        { label: '题刻时间', value: '明正德庚午年(公元1510年)' }
      ]
    },
    stone2: {
      id: 'stone2',
      title: '张椽和黄寿诗',
      subtitle: '历代文墨 · 张椽和黄寿诗',
      era: '-',
      image: './images/张椽和黄寿诗.png',
      content: [
        '石鱼随出没，民安即是丰。一州蒙作福，百姓免遭凶。张弛谁能测，奸横自敛踪。天工夺造化屈指几人同。大明正德庚午涪人张楫拜和。'
      ],
      specs: [
        { label: '题刻时间', value: '明正德庚午年(公元1510年)' }
      ]
    },
    stone3: {
      id: 'stone3',
      title: '娄橒题记',
      subtitle: '历代文墨 · 娄橒题记',
      era: '-',
      image: './images/lytj.png',
      content: [
        '去者已去，来者又来。万古如斯，何抚此而徘徊。'
      ],
      specs: [
        { label: '题刻时间', value: '清光绪七年(公元1881年)' }
      ]
    },
    stone4: {
      id: 'stone4',
      title: '游白鹤梁',
      subtitle: '历代文墨 · 游白鹤梁',
      era: '-',
      image: './images/游白鹤梁.png',
      content: [
        '江水西来去自东，浪淘尽几英雄。两三鸣鹤摩天渐，卅六鳞鱼兆岁丰。皇祐序诗刘转运，元符纪事黄涪翁。遍舟载得潞州酒，醉听渔人唱晚风。民国丁丑仲春，至山老人刘镕经题，年七十六矣。邑人刘树培涂鸦，同游文君明盛、王君伯勋。'
      ],
      specs: [
        { label: '题刻时间', value: '民国廿六年（公元1937年）' }
      ]
    },
    stone5: {
      id: 'stone5',
      title: '杨公留题',
      subtitle: '历代文墨 · 杨公留题',
      era: '-',
      image: './images/yglt.png',
      content: [
        '太守杨公留题邀客西津上，观鱼出水初。长江多巨石，此地近仙居。所记皆名笔，为祥旧奏书。丰年知有验，遗秉利将舒。戏草春波静，双鳞乐意徐。不才叨郡寄，燕喜愧萧疏。'
      ],
      specs: [
        { label: '题刻时间', value: '北宋崇宁元年（公元 1102 年）' }
      ]
    },
    stone6: {
      id: 'stone6',
      title: '徐庄题记',
      subtitle: '历代文墨 · 徐庄题记',
      era: '-',
      image: './images/xztj.png',
      content: [
        '大宋熙宁元年正月二十日，军事判官徐庄，同巡检供奉王安民、监税殿直王克岐、知乐温县钟浚、涪陵县令赵君仪、司理参军李袭，观石鱼题名，涪陵尉郑阶平书。二石鱼在江心石梁上，古记云出水四尺，岁必大稔。袁能刻。'
      ],
      specs: [
        { label: '题刻时间', value: '北宋熙宁元年（公元1068年）' }
      ]
    },
    crane: {
      id: 'crane',
      title: '仙鹤独立《白鹤时鸣图》',
      subtitle: '白鹤仙羽回流 · 石梁图腾生态纪事画刻',
      era: '中华民国二十六年 (1937 A.D.)',
      image: './images/bhsmt.png',
      content: [
        '白鹤梁的美丽之名，源自这一枯水期生态图腾：相传每逢大旱，石梁凸显，成群身披仙羽的雪白野鹤便会从天盘旋坠下，站立于石梁缝里争捕被激湍搁浅的小鱼溪蟹，引颈高歌，蔚为江天仙景。',
        '民国二十六年抗战前夕，名画家刘冕阶泛舟江心，被枯涸下的这一奇伟姿态倾倒，遂于礁石梁顶镌刻《白鹤时鸣图》。白鹤长足直立，双翅欲敛，回尾鸣响，象征人神与自然的和平律动。',
        '画面线条虚实相生，神韵清幽，我们现通过数字滤镜实时模拟天仙飘逸的流体力学气韵，使尘封数十米长江永夜下的一纸白鹤再度在镜中展翅飞舞。'
      ],
      specs: [
        { label: '流传时代', value: '民国二十六年（1937年秋）' },
        { label: '雕刻手法', value: '高精减地浮雕线刻 · 没骨墨法' },
        { label: '地理风物', value: '老涪陵外八景之「白鹤翔原、丰年鱼歌」' },
        { label: '数智重生', value: '通过动态流体波阻算法唤醒的动态重光渲染' }
      ]
    },
    guanyin: {
      id: 'guanyin',
      title: '《送子观音图》',
      subtitle: '历代文墨 · 送子观音图',
      era: '-',
      image: './images/szgyx.png',
      content: [
        '大清光绪二年杭州许丽生敬摹。'
      ],
      specs: [
        { label: '题刻时间', value: '清光绪二年(公元1876年)' }
      ]
    },
    science: {
      id: 'science',
      title: '无压容器·长江水下防爆玻璃穹顶',
      subtitle: '葛修润院士巨献 · 世纪水文明珠之隔水平衡盾',
      era: '跨世纪保护工程（2003 - 2009 A.D.）',
      image: './images/hydraulic_science_containment_1781528412054.jpg',
      content: [
        '2003年，随着长江三峡大坝的完全蓄水，枯水江滩将长眠于垂直40米之下的重压急浪与浑浊泥沙中。常态日光观测退居历史，且极易面临浪沙磨蚀和水下结构坍缩。',
        '为守护瑰宝，中国工程院院士葛修润献上了精绝天才的“无压容器原址防护”方案。他们在碑林礁石上套造大型双拱防护罩，并在罩里灌满完全经过滤层层透析的水过滤清水，使其内外水压绝对持平！',
        '此举完美平抑了数百吨江流撕扯力量，还保持了透明舷窗，使观众能够乘着91米超长斜井电梯直达江心底，目睹清莹透亮中的千载石鱼。这是世界首座也是唯一的特大深水原位博物馆工程。'
      ],
      specs: [
        { label: '核心专利', value: '内外压强双向水流等比平衡系统' },
        { label: '潜伏深度', value: '在重流急湍最深处达42米深度' },
        { label: '辅助技术', value: '28个抗温阻冲击钢拱支撑 / 水循环无泥沙过滤器' },
        { label: '世界荣衔', value: '被联合国教科文组织盛赞为世界水下活碑保护里程碑' }
      ]
    }
  };

  // 1. Dual Cursor Effect
  const dotCursorRef = useRef<HTMLDivElement | null>(null);
  const followerCursorRef = useRef<HTMLDivElement | null>(null);

  const playClickSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.14);
      
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(7.0, ctx.currentTime);
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
      // safe bypass web-audio constraints
    }
  };

  const currentDetail = activeDetail ? (DETAIL_DATA as any)[activeDetail] : null;

  const playGatherSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const frequencies = [523.25, 659.25, 783.99, 1046.50];
      
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.04);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.45, ctx.currentTime + idx * 0.04 + 0.35);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, ctx.currentTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + idx * 0.04 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.04 + 0.45);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.04);
        osc.stop(ctx.currentTime + idx * 0.04 + 0.5);
      });
    } catch (e) {
      // safe bypass web-audio constraints
    }
  };

  const spawnDisintegrationParticles = (modalRect: DOMRect, cardRect: DOMRect | null, cardId: string) => {
    const canvas = disintegrationCanvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (disintegrationFrameIdRef.current) {
      cancelAnimationFrame(disintegrationFrameIdRef.current);
    }

    const particles: any[] = [];
    const particleCount = 200;

    const modalCenterX = modalRect.left + modalRect.width / 2;
    const modalCenterY = modalRect.top + modalRect.height / 2;

    const targetX = cardRect ? cardRect.left + cardRect.width / 2 : window.innerWidth / 2;
    const targetY = cardRect ? cardRect.top + cardRect.height / 2 : window.innerHeight * 0.8;

    const colors = ['#c9af7f', '#e5dec9', '#22d3ee', '#67e8f9', '#ffffff', '#a5f3fc'];

    for (let i = 0; i < particleCount; i++) {
      const x = modalRect.left + Math.random() * modalRect.width;
      const y = modalRect.top + Math.random() * modalRect.height;

      const dxCent = x - modalCenterX;
      const dyCent = y - modalCenterY;
      const angle = Math.atan2(dyCent, dxCent) + (Math.random() * 0.6 - 0.3);
      const speed = Math.random() * 8 + 4;

      const vx = Math.cos(angle) * speed + (Math.random() * 3 - 1.5);
      const vy = Math.sin(angle) * speed + (Math.random() * 3 - 1.5);

      const pTargetX = cardRect
        ? cardRect.left + Math.random() * cardRect.width
        : targetX + (Math.random() * 100 - 50);
      const pTargetY = cardRect
        ? cardRect.top + Math.random() * cardRect.height
        : targetY + (Math.random() * 100 - 50);

      particles.push({
        x,
        y,
        vx,
        vy,
        origX: x,
        origY: y,
        pTargetX,
        pTargetY,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 3.5 + 1.2,
        alpha: 1,
        life: 0,
        maxLife: 45 + Math.floor(Math.random() * 25),
        delay: Math.floor(Math.random() * 8),
        history: [{ x, y }]
      });
    }

    activeClosingParticlesRef.current = particles;

    let soundPlayed = false;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let activeCount = 0;
      const curParticles = activeClosingParticlesRef.current;

      for (let i = 0; i < curParticles.length; i++) {
        const p = curParticles[i];

        if (p.delay > 0) {
          p.delay--;
          activeCount++;
          continue;
        }

        if (p.life < p.maxLife) {
          p.life++;
          activeCount++;

          const ratio = p.life / p.maxLife;

          if (ratio < 0.32) {
            p.x += p.vx;
            p.y += p.vy;

            p.vx *= 0.94;
            p.vy *= 0.94;
          } else {
            if (!soundPlayed && ratio > 0.4) {
              soundPlayed = true;
              playGatherSound();
            }

            const tdx = p.pTargetX - p.x;
            const tdy = p.pTargetY - p.y;
            const dist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;

            const pullFactor = (ratio - 0.32) / 0.68;
            const pullSpeed = 0.6 + pullFactor * 4.2;

            p.vx += (tdx / dist) * pullSpeed;
            p.vy += (tdy / dist) * pullSpeed;

            p.vx *= 0.85;
            p.vy *= 0.85;

            p.x += p.vx;
            p.y += p.vy;

            if (dist < 45) {
              p.size *= 0.92;
              p.alpha *= 0.88;
            }
          }

          p.history.push({ x: p.x, y: p.y });
          if (p.history.length > 5) {
            p.history.shift();
          }

          ctx.beginPath();
          ctx.moveTo(p.history[0].x, p.history[0].y);
          for (let step = 1; step < p.history.length; step++) {
            ctx.lineTo(p.history[step].x, p.history[step].y);
          }
          ctx.strokeStyle = p.color;
          ctx.shadowBlur = p.size * 2;
          ctx.shadowColor = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.lineWidth = p.size * 0.7;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      if (activeCount > 0) {
        disintegrationFrameIdRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        disintegrationFrameIdRef.current = null;
      }
    };

    disintegrationFrameIdRef.current = requestAnimationFrame(animate);

    setTimeout(() => {
      if (cardId) {
        const cardEl = document.getElementById(cardId);
        if (cardEl) {
          gsap.fromTo(cardEl, 
            { scale: 0.96, boxShadow: '0 0 32px rgba(201, 175, 127, 0.75), 0 15px 40px rgba(0,0,0,0.65)' },
            { scale: 1, boxShadow: '0 15px 40px rgba(0,0,0,0.65)', duration: 0.8, ease: 'elastic.out(1.2, 0.45)' }
          );
        }
      }
    }, 550);
  };

  const closeDetailWithParticles = () => {
    if (!activeDetail) {
      setActiveDetail(null);
      return;
    }

    const modalEl = document.getElementById('detail-modal-card');
    
    let cardId = '';
    if (activeDetail === 'science') {
      cardId = 'timeline-3';
    } else if (activeDetail === 'crane' || activeDetail === 'guanyin') {
      cardId = `stone-card-${activeDetail}`;
    } else {
      const idx = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5', 'stone6'].indexOf(activeDetail);
      if (idx !== -1) {
        cardId = `stone-card-${idx + 1}`;
      }
    }

    const cardEl = cardId ? document.getElementById(cardId) : null;
    const modalRect = modalEl?.getBoundingClientRect();
    const cardRect = cardEl?.getBoundingClientRect();

    if (modalRect) {
      spawnDisintegrationParticles(modalRect, cardRect || null, cardId);
    }

    playClickSound();
    setActiveDetail(null);
  };

  const openDetail = (id: string | null) => {
    setActiveDetail(id);
    playClickSound();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dotCursorRef.current && followerCursorRef.current) {
        dotCursorRef.current.style.opacity = '1';
        followerCursorRef.current.style.opacity = '1';
        
        gsap.to(dotCursorRef.current, { x: e.clientX, y: e.clientY, duration: 0.1 });
        gsap.to(followerCursorRef.current, { x: e.clientX, y: e.clientY, duration: 0.35, ease: 'power2.out' });
      }
    };

    const handleMouseLeave = () => {
      if (dotCursorRef.current && followerCursorRef.current) {
        dotCursorRef.current.style.opacity = '0';
        followerCursorRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // 2. Rising Bubbles/Particles Simulation
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let prFrameId: number;
    let particles: { x: number; y: number; r: number; vy: number; vx: number; opacity: number }[] = [];

    const initParticles = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < 65; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 2.5 + 0.5,
          vy: -(Math.random() * 0.35 + 0.15),
          vx: Math.sin(Math.random() * 8) * 0.18,
          opacity: Math.random() * 0.35 + 0.1,
        });
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.beginPath();
        // Golden tea/vellum color representation for Baiheliang style
        ctx.fillStyle = `rgba(229, 222, 201, ${p.opacity})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -15) {
          p.y = canvas.height + 15;
          p.x = Math.random() * canvas.width;
        }
      });
      prFrameId = requestAnimationFrame(drawParticles);
    };

    initParticles();
    drawParticles();

    const handleResize = () => {
      initParticles();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(prFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 3. GSAP Sideways Pin Scroll Animations
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollWidth = container.scrollWidth;
    const windowWidth = window.innerWidth;

    const ctx = gsap.context(() => {
      // Pin horizontal viewport scrolling
      const scrollTween = gsap.to(container, {
        x: () => -(scrollWidth - windowWidth),
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          pin: true,
          scrub: 0.85, // beautifully soft transition, complemented by the spring lag below
          invalidateOnRefresh: true,
          end: () => `+=${scrollWidth}`,
        },
      });

      // Sequential fade-ins for informational contents
      const sections = gsap.utils.toArray('section') as HTMLElement[];
      sections.forEach((sec) => {
        const content = sec.querySelector('.scroll-content-container');
        const nodes = sec.querySelectorAll('.stone-card-node, .timeline-node-item');

        if (content) {
          gsap.to(content, {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sec,
              containerAnimation: scrollTween,
              start: 'left center+=280',
              toggleActions: 'play none none reverse',
            },
          });
        }

        if (nodes.length > 0) {
          gsap.to(nodes, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 1.0,
            stagger: 0.12,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sec,
              containerAnimation: scrollTween,
              start: 'left center+=320',
              toggleActions: 'play none none reverse',
            },
          });
        }
      });
    });

    return () => ctx.revert();
  }, []);

  // New: Global Mouse Wheel Translator to force smooth scrolling inside sandboxed iframe previews with boundary tension
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      // Accept vertical deltaY or horizontal deltaX (comfortable for trackpads)
      const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (scrollAmount !== 0) {
        const currentY = window.scrollY;
        const maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1;

        // Feed direct impulse when scroll reaches the edges and users try to pull further
        if (currentY <= 2 && scrollAmount < 0) {
          // Scrolling past left boundary: push positive to shift layout rightward with tension
          springRef.current.vel += Math.max(-22, scrollAmount * -0.065);
        } else if (currentY >= maxScroll - 2 && scrollAmount > 0) {
          // Scrolling past right boundary: push negative to shift layout leftward with tension
          springRef.current.vel += Math.min(22, scrollAmount * -0.065);
        }

        window.scrollBy({
          top: scrollAmount,
          behavior: 'auto'
        });
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  // 3b. Interactive horizontal rebound spring simulation (lag + edge bounce solver)
  useEffect(() => {
    let animId: number;
    let lastScrollY = window.scrollY;

    const tick = () => {
      const spring = springRef.current;
      const currentScrollY = window.scrollY;
      const scrollSpeed = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      // 1. Add subtle interactive lag during standard mid-scroll
      if (Math.abs(scrollSpeed) > 0.1) {
        // Shifting multiplier determines the degree of lag/compliance (negative coefficient reflects correct directional lag)
        spring.vel += scrollSpeed * 0.055;
      }

      // 2. Physics solver step (restoring force toward 0 offset)
      const force = -spring.k * spring.pos;
      spring.vel += force;
      spring.vel *= spring.damp;
      spring.pos += spring.vel;

      // Tight clamp overshoot limits for exquisite professional polish
      spring.pos = Math.max(-85, Math.min(85, spring.pos));

      // 3. Render translation offset inline for premium hardware performance
      if (innerWrapperRef.current) {
        innerWrapperRef.current.style.transform = `translateX(${spring.pos.toFixed(2)}px)`;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 4. Spotlight magic card coordinates tracker (Smooth Lerping Drag)
  useEffect(() => {
    let animId: number;

    const lerpTick = () => {
      const current = spotlightCurrentRef.current;
      const target = spotlightTargetRef.current;

      // Silky smooth inertia lerp (factor 0.12)
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;

      setSpotlightPos({ x: `${current.x}px`, y: `${current.y}px` });

      const card = document.getElementById('magic-spotlight-card');
      if (card) {
        card.style.setProperty('--x', `${current.x}px`);
        card.style.setProperty('--y', `${current.y}px`);
      }

      animId = requestAnimationFrame(lerpTick);
    };

    animId = requestAnimationFrame(lerpTick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleSpotlightMove = (e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
    const card = magicCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    spotlightTargetRef.current = { x, y };

    if (!spotlightActiveRef.current) {
      spotlightCurrentRef.current = { x, y };
      spotlightActiveRef.current = true;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingStele.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    if (magicCardRef.current) {
        magicCardRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingStele.current = false;
    setSteleRotation({ x: 0, y: 0 });
    if (magicCardRef.current) {
        magicCardRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingStele.current) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      setSteleRotation(prev => ({
        x: Math.max(-25, Math.min(25, prev.x - dy * 0.4)),
        y: prev.y + dx * 0.4
      }));
      dragStartPos.current = { x: e.clientX, y: e.clientY };
    } else {
      handleSpotlightMove(e);
    }
  };

  return (
    <div className={`relative overflow-x-hidden bg-[#050505] ${activeDetail ? "" : "hide-cursor"}`}>
      {/* HUD Navigation Header */}
      <div className="fixed top-0 inset-x-0 h-16 bg-gradient-to-b from-black/85 to-transparent z-40 flex items-center justify-between px-12 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3">
          <span className="text-[#c9af7f] font-serif font-bold tracking-widest text-sm">白鹤梁数字重光</span>
          <span className="text-white/30 text-[9px] tracking-widest font-mono">DIGITAL RECONSTRUCTION</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-xs tracking-widest font-mono text-white/50 hover:text-[#c9af7f] transition duration-200 cursor-none"
          >
            MUSEUM / 展廊
          </button>
        </div>
      </div>

      {/* 1. Global Custom Web Cursor */}
      <div 
        ref={dotCursorRef}
        className={`fixed w-2 h-2 bg-[#e5dec9] rounded-full pointer-events-none z-[110] transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 opacity-0 mix-blend-difference ${activeDetail ? "hidden" : ""}`}
      />
      <div 
        ref={followerCursorRef}
        className={`fixed w-10 h-10 border border-[#c9af7f]/40 rounded-full pointer-events-none z-[110] transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 opacity-0 shadow-lg shadow-[#c9af7f]/10 ${activeDetail ? "hidden" : ""}`}
      />

      {/* 2. Global Water Particle canvas */}
      <canvas 
        ref={particleCanvasRef}
        className="fixed top-0 left-0 w-screen h-screen pointer-events-none z-[2]" 
      />

      {/* 2b. Secondary Particle Disintegration Canvas */}
      <canvas 
        ref={disintegrationCanvasRef}
        className="fixed top-0 left-0 w-screen h-screen pointer-events-none z-[100]" 
      />

      {/* 3. Horizontal Museum Content Stream wrapper */}
      <main ref={containerRef} className="container flex flex-nowrap w-max h-screen select-none">
        <div ref={innerWrapperRef} className="flex flex-nowrap h-full">
        
        {/* SECTION 1: LANDING BANNER SCREEN */}
        <section 
          id="section-intro"
          className="relative w-screen h-screen flex flex-col justify-center shrink-0 overflow-hidden"
        >
          {/* Parallax giant traditional calligraphy water reflections */}
          <div className="absolute font-serif text-[35vw] font-black text-[#e5dec9]/[0.015] leading-none select-none pointer-events-none left-[5%] top-[12%]">
            白鶴梁
          </div>

          <div className="absolute right-[5%] bottom-[10%] w-[42vw] max-w-[500px] opacity-15 mix-blend-screen pointer-events-none">
            {/* Ink drawing fish outline in dark golden stroke */}
            <svg viewBox="0 0 400 200" className="w-full text-[#c9af7f]" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 100 C120 20, 280 20, 380 100 C280 180, 120 180, 20 100" />
              <path d="M80 80 Q190 40, 300 80 Q190 120, 80 80" />
              <path d="M20 100 L0 80 M20 100 L0 120" />
              <circle cx="340" cy="100" r="8" stroke="currentColor" />
              <path d="M220 50 Q260 70, 280 100" />
            </svg>
          </div>

          <div className="relative pl-[12vw] z-10 flex flex-col items-start gap-4">
            <span className="inline-block px-4 py-1.5 border border-[#c9af7f] text-[10px] uppercase tracking-[4px] text-[#c9af7f] font-mono rounded-full font-bold">
              UNESCO World Heritage Tentative
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[#e5dec9] font-serif text-[7.5vw] font-black leading-none tracking-widest font-custom">
                白鹤梁
              </span>
              <span className="text-white/45 text-sm uppercase font-mono tracking-[10px] pl-2 mt-4 inline-block">
                Underwater Digital Space-Time Museum
              </span>
            </div>
            <p className="text-[#e5dec9]/70 text-lg tracking-[8px] pl-2 mt-4 font-light max-w-2xl leading-relaxed">
              沉落长江底部的世界第一古水文碑林 · 数字化重光
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-10 pl-2">
              <button
                onClick={() => {
                  window.scrollBy({
                    top: window.innerHeight * 0.8,
                    behavior: 'smooth'
                  });
                }}
                className="flex items-center gap-2 border border-white/20 hover:border-[#c9af7f]/40 bg-white/5 hover:bg-white/10 px-6 py-3 rounded text-xs font-mono tracking-widest text-[#e5dec9] hover:text-[#c9af7f] transition duration-300 font-medium cursor-none"
              >
                <span>MUSEUM / 阅览数智展廊</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onEnterMirror}
                className="flex items-center gap-2 bg-[#c9af7f]/20 hover:bg-[#c9af7f]/35 border border-[#c9af7f]/50 px-6 py-3 rounded text-xs font-mono tracking-widest text-[#c9af7f] hover:text-[#e5dec9] transition duration-300 font-medium cursor-none shadow-[0_0_15px_rgba(201,175,127,0.15)] animate-pulse"
              >
                <Sparkles className="w-4 h-4" />
                <span>WATER MIRROR / 步入互动水镜</span>
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 2: STONE FISH CHRONICLES & SPECTACULAR SPOTLIGHT DISPLACEMENT */}
        <section 
          id="section-chapter-one"
          style={{ width: '150vw' }}
          className="relative h-screen flex items-center justify-start shrink-0 overflow-hidden border-l border-white/5 bg-gradient-to-r from-transparent to-[#050505]"
        >
          <div className="flex flex-row items-center gap-[8vw] pl-[12vw] pr-[8vw] h-full z-10">
            <div className="scroll-content-container text-block w-[550px] shrink-0 opacity-0 translate-y-12">
              <span className="inline-block px-4 py-1.5 border border-[#c9af7f]/40 text-[10px] tracking-widest text-[#c9af7f] mb-6 rounded-full font-mono uppercase bg-[#c9af7f]/5">
                Chapter I : 观水辨丰
              </span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-widest text-[#c9af7f] mb-6 leading-tight">
                石鱼出水兆丰年
              </h2>
              <p className="text-slate-300 text-[15px] leading-[2.1] tracking-wider text-justify">
                白鹤梁是一道横卧于涪陵长江底部的巨型天然石梁。古人惊奇发现，每当冬春枯水水位退尽，梁石露面，露出古代石鱼雕刻之时，来年便会迎来五谷大丰收。
                这实质是长江千百年来最精巧的枯水位自然循环周期规律。
              </p>
              <p className="text-slate-300/60 text-[13px] leading-relaxed tracking-wider text-justify mt-4 border-l-2 border-[#c9af7f]/45 pl-4 bg-white/[0.01] py-2">
                * 互动体验：将鼠标移至右边探照灯黑色石壁，可以神奇地“看透”水波折射，将掩藏在幽冥黑暗下的立体金色浮雕鱼身纹饰呼唤复写。
              </p>
            </div>

            {/* Premium Magic Interactive Spotlight Card */}
            <div 
              id="magic-spotlight-card"
              onPointerDown={handlePointerDown}
              onPointerUp={(e) => handlePointerUp(e as any)}
              onPointerMove={handlePointerMove}
              onPointerLeave={(e) => {
                handlePointerUp(e as any);
                setIsHovered(false);
              }}
              onMouseEnter={() => setIsHovered(true)}
              className="magic-card relative w-[52vw] h-[65vh] shrink-0 cursor-none touch-none"
              style={{ perspective: '1200px' }}
            >
              <motion.div 
                 ref={magicCardRef as any}
                 className="relative w-full h-full shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
                 animate={{ rotateX: steleRotation.x, rotateY: steleRotation.y }}
                 transition={{ type: 'spring', damping: 25, stiffness: 120, mass: 0.5 }}
                 style={{ 
                    transformStyle: 'preserve-3d'
                 }}
              >
                {/* 3D Floating Particles */}
                <div className="absolute inset-x-[-20%] inset-y-[-20%] pointer-events-none z-0 mix-blend-screen" style={{ transformStyle: 'preserve-3d' }}>
                  {steleParticles.map((p) => (
                    <motion.div
                      key={p.id}
                      className="absolute rounded-full"
                      style={{
                        width: p.size,
                        height: p.size,
                        left: p.left,
                        top: p.top,
                        backgroundColor: Math.random() > 0.5 ? '#c9af7f' : '#67e8f9',
                        boxShadow: `0 0 ${p.size * 2}px ${Math.random() > 0.5 ? '#c9af7f' : '#67e8f9'}`,
                        transform: `translateZ(${Math.random() * 200 - 100}px)`
                      }}
                      animate={{
                        y: [0, -60, -120],
                        x: [0, Math.random() * 60 - 30, Math.random() * 60 - 30],
                        opacity: [0, p.opacity, 0],
                        scale: [0.5, 1.2, 0.5],
                      }}
                      transition={{
                        duration: p.duration,
                        delay: p.delay,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />
                  ))}
                </div>

                {/* Front Face (Original Card Details) */}
                <div 
                  className="absolute inset-0 bg-[#050505] rounded border border-[#c9af7f]/20 overflow-hidden"
                  style={{ 
                    transform: 'translateZ(25px)', 
                    transformStyle: 'preserve-3d',
                    ...particleMaskStyle
                  }}
                >
                  {/* Soft Edge Overlay for '柔滑边缘' */}
                  <div className="absolute inset-0 z-30 pointer-events-none shadow-[inset_0_0_50px_20px_#050505]" />

                  {/* Image 1: Traditional Chinese Shuangyu Ink Rubbing (Normal state) */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-85 pointer-events-none transition-all duration-500 brightness-[0.7] saturate-[0.85]"
                    style={{ 
                      backgroundImage: 'url("./双鱼细节拓片.jpg")',
                      referrerPolicy: 'no-referrer'
                    }}
                  />
                  
                  {/* Fallback pattern graphics in stone box */}
                  <div className="absolute inset-0 flex flex-col justify-end p-8 border border-white/5 pointer-events-none">
                    <span className="text-white/20 text-xs tracking-widest font-mono">STONE RUBBING BAS-RELIEF</span>
                    <span className="text-white/10 text-[10vw] font-serif uppercase select-none leading-none absolute left-8 top-12">RUBBINGS</span>
                  </div>

                  {/* Image 2: White Plaster Shuangyu 3D Relief (Spotlight Hover state) */}
                  <div 
                    className={`reveal-img absolute inset-0 bg-cover bg-center z-10 transition-opacity duration-300 cursor-hidden brightness-105 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                      backgroundImage: 'url("./双鱼细节拓片浮雕效果.jpg")',
                      referrerPolicy: 'no-referrer',
                      WebkitMaskImage: 'radial-gradient(circle 200px at var(--x, 50%) var(--y, 50%), black 0%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                      maskImage: 'radial-gradient(circle 200px at var(--x, 50%) var(--y, 50%), black 0%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)'
                    } as any}
                  >
                    {/* Visual Gold Overlay contents appearing inside light circle */}
                    <div className="absolute inset-x-8 bottom-8 z-20 pointer-events-none flex flex-col text-amber-100 drop-shadow-xl select-none">
                      <div className="flex items-center gap-1.5 mb-1.5 text-cyan-400">
                        <Sparkles className="w-4 h-4 animate-spin-slow text-cyan-400" />
                        <span className="font-mono text-xs tracking-widest font-bold text-cyan-400">REVEAL: ACTIVE SPOTLIGHT RESOLVE</span>
                      </div>
                      <h4 className="text-xl font-bold font-serif tracking-wider">白鹤梁双鱼经典石刻 (唐廣德元年)</h4>
                      <span className="text-xs text-white/70 font-sans tracking-wide mt-1">
                        “双首鱼身相联，精密度刻，零水位测点指标。”
                      </span>
                    </div>
                  </div>

                  {/* Dynamic concentric ripples around spotlight border */}
                  {isHovered && (
                    <div 
                      className="absolute pointer-events-none z-20 mix-blend-screen transition-opacity duration-500 ease-out"
                      style={{
                        left: spotlightPos.x,
                        top: spotlightPos.y,
                      }}
                    >
                      <div 
                        className="absolute rounded-full border border-cyan-400/40"
                        style={{
                          width: '360px',
                          height: '360px',
                          animation: 'ripple-expand-active 3.5s infinite linear',
                        }}
                      />
                      <div 
                        className="absolute rounded-full border border-white/25"
                        style={{
                          width: '360px',
                          height: '360px',
                          animation: 'ripple-expand-active 3.5s infinite linear',
                          animationDelay: '1.2s',
                        }}
                      />
                      <div 
                        className="absolute rounded-full border border-cyan-300/10"
                        style={{
                          width: '360px',
                          height: '360px',
                          animation: 'ripple-expand-active 3.5s infinite linear',
                          animationDelay: '2.4s',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Back Face */}
                <div 
                  className="absolute inset-0 bg-[#0a0a0a] rounded border border-white/5"
                  style={{ transform: 'translateZ(-25px) rotateY(180deg)', ...particleMaskStyle }}
                />
                
                {/* Left Face */}
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-[#151515] border-y border-white/5"
                  style={{ width: '50px', transform: 'translateX(-25px) rotateY(-90deg)', ...particleMaskStyle }}
                />
                
                {/* Right Face */}
                <div 
                  className="absolute top-0 bottom-0 right-0 bg-[#080808] border-y border-white/5"
                  style={{ width: '50px', transform: 'translateX(25px) rotateY(90deg)', ...particleMaskStyle }}
                />
                
                {/* Top Face */}
                <div 
                  className="absolute left-0 right-0 top-0 bg-[#1a1a1a] border-x border-white/5"
                  style={{ height: '50px', transform: 'translateY(-25px) rotateX(90deg)', ...particleMaskStyle }}
                />
                
                {/* Bottom Face */}
                <div 
                  className="absolute left-0 right-0 bottom-0 bg-[#030303] border-x border-white/5 shadow-2xl"
                  style={{ height: '50px', transform: 'translateY(25px) rotateX(-90deg)', ...particleMaskStyle }}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* SECTION 3: TABLETS FOREST GALLERY */}
        <section 
          id="section-chapter-two"
          style={{ width: '230vw' }}
          className="relative h-screen flex items-center justify-start shrink-0 overflow-hidden"
        >
          <div className="absolute font-serif text-[35vw] font-black text-[#e5dec9]/[0.015] leading-none select-none pointer-events-none left-[35%] top-[12%]">
            水下碑林
          </div>

          <div className="flex flex-row items-center gap-[8vw] pl-[12vw] pr-[8vw] h-full z-10">
            <div className="scroll-content-container text-block w-[550px] shrink-0 opacity-0 translate-y-12">
              <span className="inline-block px-4 py-1.5 border border-[#c9af7f]/40 text-[10px] tracking-widest text-[#c9af7f] mb-6 rounded-full font-mono uppercase bg-[#c9af7f]/5">
                Chapter II : 历代文墨
              </span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-widest text-[#c9af7f] mb-6 leading-tight">
                世界第一水下碑林
              </h2>
              <p className="text-slate-300 text-[15px] leading-[2.1] tracking-wider text-justify">
                断崖削壁耸立江底。白鹤梁镌刻着自公元763年（唐代广德元年）以来的163段历代文人墨客题刻，共存三万余文字残余。
                汇集黄庭坚、朱熹、王士祯等书法名家的奇逸遗世狂草、行楷真迹，它们终年随江底幽暗寒流拂面，是名副其实的【水下碑林长廊】。
              </p>
            </div>

            {/* Cards gallery */}
            <div className="gallery-wrapper flex items-center gap-8 pl-4 shrink-0">
              {['stone1', 'stone2', 'stone3', 'stone4', 'stone5', 'stone6'].map((key, i) => {
                const item = (DETAIL_DATA as any)[key];
                return (
                  <div 
                    key={key}
                    id={`stone-card-${i + 1}`}
                    onClick={() => openDetail(key)}
                    className="stone-card-node stone-card border border-white/10 opacity-0 scale-90 translate-y-8 cursor-none hover:border-[#c9af7f]/50 hover:bg-[#c9af7f]/5 transition-all duration-300 transform active:scale-95 group"
                  >
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-screen transition-opacity duration-500 pointer-events-none group-hover:opacity-30"
                      style={{ 
                        backgroundImage: `url("${item.image}")`
                      }}
                    />
                    <BookOpen className="w-8 h-8 text-[#c9af7f] mb-4 z-10" />
                    <h3 className="text-xl font-serif text-[#e5dec9] mb-3 font-bold z-10">
                      {item.title}
                    </h3>
                    <p className="text-slate-400 text-[11px] leading-[1.8] tracking-wider text-justify z-10 line-clamp-4">
                      {item.content[0]}
                    </p>
                    <div className="mt-4 flex items-center text-[#c9af7f] text-[9px] tracking-widest font-mono z-10 border-t border-white/5 pt-3">
                      <span>点击探秘二级资料 ➜</span>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-[#c9af7f]/50 text-[9px] tracking-widest font-mono z-10">
                      <span>CALLIGRAPHY</span>
                      <span>{item.specs?.[0]?.value?.replace(/.*公元/,'').replace('）','') || '-'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 4: WORLD HYDROLOGIC STANDARD BENCHMARK */}
        <section 
          id="section-chapter-three"
          style={{ width: '140vw' }}
          className="relative h-screen flex items-center justify-start shrink-0 overflow-hidden bg-gradient-to-r from-transparent to-[#050505]"
        >
          <div className="flex flex-row items-center gap-[8vw] pl-[12vw] pr-[8vw] h-full z-10">
            <div className="scroll-content-container text-block w-[550px] shrink-0 opacity-0 translate-y-12">
              <span className="inline-block px-4 py-1.5 border border-[#c9af7f]/40 text-[10px] tracking-widest text-[#c9af7f] mb-6 rounded-full font-mono uppercase bg-[#c9af7f]/5">
                Chapter III : 图腾密码
              </span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-widest text-[#c9af7f] mb-6 leading-tight">
                世界水文原点坐标
              </h2>
              <p className="text-slate-300 text-[15px] leading-[2.1] tracking-wider text-justify">
                雕刻鱼眼不仅是图腾崇拜，更象征着长江的【水文零点】。
                西方自19世纪初才开始记录江水涨落水位数据。而白鹤梁，比它们早了整整一千一百年。它是全世界唯一无损纪录千年枯水变化轨迹的物理本尊。
              </p>
            </div>

            <div className="gallery-wrapper flex items-center gap-8 shrink-0">
              {['crane', 'guanyin'].map((key, i) => {
                const item = (DETAIL_DATA as any)[key];
                return (
                  <div 
                    key={key}
                    id={`stone-card-${key}`}
                    onClick={() => openDetail(key)}
                    className="stone-card-node stone-card border border-white/10 opacity-0 scale-90 translate-y-8 cursor-none hover:border-[#c9af7f]/50 hover:bg-[#c9af7f]/5 transition-all duration-300 transform active:scale-95 group"
                  >
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-screen transition-opacity duration-500 pointer-events-none group-hover:opacity-30"
                      style={{ 
                        backgroundImage: `url("${item.image}")`
                      }}
                    />
                    {i === 0 ? (
                      <Compass className="w-8 h-8 text-[#c9af7f] mb-4 z-10" />
                    ) : (
                      <BookOpen className="w-8 h-8 text-[#c9af7f] mb-4 z-10" />
                    )}
                    <h3 className="text-xl font-serif text-[#e5dec9] mb-3 font-bold z-10">
                      {item.title}
                    </h3>
                    <p className="text-slate-400 text-xs leading-[1.8] tracking-wider text-justify z-10 line-clamp-4">
                      {item.content[0]}
                    </p>
                    <div className="mt-4 flex items-center text-[#c9af7f] text-[9px] tracking-widest font-mono z-10 border-t border-white/5 pt-3">
                      <span>点击探秘二级资料 ➜</span>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-[#c9af7f]/50 text-[9px] tracking-widest font-mono z-10">
                      <span>{i === 0 ? 'ROC TIME SCALE' : 'CARVING'}</span>
                      <span>{item.specs?.[0]?.value?.replace(/.*公元/,'').replace('）','') || '-'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 5: CENTURY ENGINEERING GEOLOGICAL TIMELINE */}
        <section 
          id="section-chapter-four"
          style={{ width: '220vw' }}
          className="relative h-screen flex items-center justify-start shrink-0 overflow-hidden"
        >
          <div className="absolute font-serif text-[35vw] font-black text-[#e5dec9]/[0.012] leading-none select-none pointer-events-none left-[45%] top-[12%]">
            历劫重光
          </div>

          <div className="flex flex-row items-center gap-[8vw] pl-[12vw] pr-[8vw] h-full z-10">
            <div className="scroll-content-container text-block w-[550px] shrink-0 opacity-0 translate-y-12 flex flex-col">
              <span className="inline-block px-4 py-1.5 border border-[#c9af7f]/40 text-[10px] tracking-widest text-[#c9af7f] mb-6 rounded-full font-mono uppercase bg-[#c9af7f]/5 w-fit">
                Chapter IV : 世纪工程
              </span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-widest text-[#c9af7f] mb-6 leading-tight">
                40米江底无压保护防护门
              </h2>
              <p className="text-slate-300 text-[15px] leading-[2.1] tracking-wider text-justify mb-5">
                2003年长江三峡大坝合拢蓄水，江底水位飙升，常态白鹤梁礁石将被完全吞没于永夜混沌中。
                为了守护碑文不碎，中国工程院葛修润院士献上惊世骇俗的【无压容器技术】。
                在40米江底筑造无压玻璃容器，注清水平抑内外压差，保护绝大千年圣迹原貌。
              </p>
              <button
                onClick={() => openDetail('science')}
                className="flex items-center gap-2 border border-[#c9af7f]/40 hover:border-[#c9af7f] text-xs font-mono tracking-widest text-[#c9af7f] hover:text-white px-4 py-2 bg-[#c9af7f]/5 hover:bg-[#c9af7f]/15 transition-all duration-300 cursor-none w-fit rounded active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>进入三维数字工程详情 ➜</span>
              </button>
            </div>

            <div className="horizontal-timeline relative flex items-center h-full px-12 gap-24 shrink-0 select-none">
              {/* Horizontal center gradient line */}
              <div className="absolute left-0 top-[52%] w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#c9af7f]/45 to-transparent z-[1]" />

              {/* TIMELINE NODE 1 */}
              <div 
                id="timeline-1"
                className="timeline-node-item timeline-node cursor-none border-l-2 border-[#c9af7f] bg-black/75 backdrop-blur-md p-6 border-y border-r border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.6)] rounded-r-lg w-[280px] h-[250px] flex flex-col justify-start relative z-10 opacity-0 scale-95 translate-y-[-100px]"
              >
                <div className="absolute -left-[5px] bottom-[-43px] w-2 h-2 rounded-full bg-[#c9af7f] shadow-[0_0_12px_#c9af7f]" />
                <span className="year font-serif text-2xl font-black text-[#c9af7f] mb-3">唐 · 广德元年</span>
                <p className="text-slate-400 text-xs leading-[1.8] text-justify tracking-wide">
                  公元763年，双鱼初具。白鹤梁在急湍深江下沉思，唯有逢极度干旱的丰产年份方短暂显露，引众人拓碑称福。
                </p>
              </div>

              {/* TIMELINE NODE 2 */}
              <div 
                id="timeline-2"
                className="timeline-node-item timeline-node cursor-none border-l-2 border-[#c9af7f] bg-black/75 backdrop-blur-md p-6 border-y border-r border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.6)] rounded-r-lg w-[280px] h-[250px] flex flex-col justify-start relative z-10 opacity-0 scale-95 translate-y-[100px]"
              >
                <div className="absolute -left-[5px] top-[-43px] w-2 h-2 rounded-full bg-[#c9af7f] shadow-[0_0_12px_#c9af7f]" />
                <span className="year font-serif text-2xl font-black text-[#c9af7f] mb-3">2003年蓄水</span>
                <p className="text-slate-400 text-xs leading-[1.8] text-justify tracking-wide">
                  三峡蓄水高达175米标准。千年岩梁陷入数十米汪洋，无法直接观测，原址工程抢救全面吹响号角。
                </p>
              </div>

              {/* TIMELINE NODE 3 */}
              <div 
                id="timeline-3"
                className="timeline-node-item timeline-node cursor-none border-l-2 border-[#c9af7f] bg-black/75 backdrop-blur-md p-6 border-y border-r border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.6)] rounded-r-lg w-[280px] h-[250px] flex flex-col justify-start relative z-10 opacity-0 scale-95 translate-y-[-100px]"
              >
                <div className="absolute -left-[5px] bottom-[-43px] w-2 h-2 rounded-full bg-[#c9af7f] shadow-[0_0_12px_#c9af7f]" />
                <span className="year font-serif text-2xl font-black text-[#c9af7f] mb-3">2009年重光</span>
                <p className="text-slate-400 text-xs leading-[1.8] text-justify tracking-wide">
                  江底清水无压保护方案竣工，白鹤梁博物馆惊现人间。游人坐着91米超长自动扶梯，通过水压抗冲击舷窗深情凝结岩柱。
                </p>
              </div>

              {/* TIMELINE NODE 4 */}
              <div 
                id="timeline-4"
                className="timeline-node-item timeline-node cursor-none border-l-2 border-[#c9af7f] bg-black/75 backdrop-blur-md p-6 border-y border-r border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.6)] rounded-r-lg w-[280px] h-[250px] flex flex-col justify-start relative z-10 opacity-0 scale-95 translate-y-[100px]"
              >
                <div className="absolute -left-[5px] top-[-43px] w-2 h-2 rounded-full bg-[#c9af7f] shadow-[0_0_12px_#c9af7f]" />
                <span className="year font-serif text-2xl font-black text-[#c9af7f] mb-3">数字科技新生</span>
                <p className="text-slate-400 text-xs leading-[1.8] text-justify tracking-wide">
                  今日，我们将沉于永夜的碑林、波澜涟漪以及古人浪漫的水流气韵抽取归化至数字镜像，拂动屏幕即可与千年文脉血脉重连。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: INTERACTIVE PORTAL TO DIGITAL WATER MIRROR */}
        <section 
          id="section-interactive-portal"
          style={{ width: '105vw' }}
          className="relative h-screen flex flex-col justify-center items-center shrink-0 overflow-hidden bg-gradient-to-r from-transparent via-[#050505] to-black"
        >
          {/* Shimmering Portal background graphic node */}
          <div className="absolute w-[500px] h-[500px] bg-[#c9af7f]/5 rounded-full blur-[80px] animate-pulse pointer-events-none" />

          {/* Glowing central sphere mimicking video's refractive mirror */}
          <div className="absolute w-[280px] h-[280px] rounded-full border border-[#c9af7f]/30 z-[1] backdrop-blur-[4px] shadow-[0_0_50px_rgba(201,175,127,0.15)] flex flex-col items-center justify-center animate-spin-slow">
            <div className="text-slate-500/10 text-[80px] font-black tracking-widest font-serif">水</div>
          </div>

          <div className="relative pl-8 z-10 text-center max-w-2xl px-6 flex flex-col items-center gap-6">
            <span className="inline-block px-4 py-1 bg-[#c9af7f]/15 border border-[#c9af7f] text-[10px] tracking-widest text-[#c9af7f] uppercase rounded-full font-bold">
              Immersive Fluid Space
            </span>
            <h2 className="text-4xl font-serif text-[#e5dec9] tracking-widest font-bold drop-shadow-md">
              白鹤重光 · 互动水镜
            </h2>
            <p className="text-[#e5dec9]/75 text-[14px] leading-relaxed tracking-wider mb-6">
              现在，邀请您身临其境体验视频中的“手势操控折射水流”。
              开启摄像头，您将置身清澈的江底水晶镜像。轻轻摆动双臂，即可激荡起符合真实物理重力波传播的高精度 WebGL 流体澜痕！
            </p>

            <button
              id="btn-enter-water-mirror"
              onClick={onEnterMirror}
              className="flex items-center gap-3 bg-gradient-to-r from-[#c9af7f] to-[#e5dec9] hover:from-[#e5dec9] hover:to-[#c9af7f] hover:scale-105 hover:shadow-amber-500/15 cursor-none text-[#061118] font-bold tracking-[3px] text-sm px-8 py-4 rounded-full shadow-2xl transition duration-300"
            >
              <Eye className="w-4 h-4 animate-bounce" />
              <span>开启手势叠浪水流体验 (开镜)</span>
            </button>
            <span className="text-[10px] text-white/30 font-mono tracking-widest uppercase mt-1">
              * CAMERA/MOUSE GESTURE WEBGL FLUID LAB
            </span>
          </div>
        </section>

        {/* SECTION 7: SUMMARY CONCLUDING GREETING */}
        <section 
          id="section-concluding"
          className="relative w-screen h-screen flex flex-col justify-center items-center shrink-0 overflow-hidden bg-black"
        >
          <div className="relative z-10 text-center max-w-[820px] px-8 flex flex-col items-center gap-6">
            <span className="inline-block px-3.5 py-1 border border-[#c9af7f] text-[10px] tracking-[3px] text-[#c9af7f] uppercase rounded-full">
              结语 · 守护
            </span>
            <h2 className="text-3xl md:text-5xl font-serif text-[#c9af7f] tracking-widest leading-snug">
              数字重光 · 历劫新生
            </h2>
            <p className="text-slate-300/80 text-[15px] leading-[2.1] tracking-wider text-justify mt-4">
              岁月长滩奔腾不息，岩石风化剥蚀无声。古老的白鹤梁纵使长眠江底暗流，由于数字交互水力科技的渲染复刻，依然能够让我们重触千年时光的质感。
              这不仅仅是一篇富有浪漫主义色彩的数字艺术实践，更是属于华夏古明刻在洪荒自然中的深刻凝视与不朽自证。
            </p>

            <div className="w-12 h-[1px] bg-[#c9af7f]/50 mt-8 mb-4" />
            <span className="text-white/20 text-xs tracking-widest font-mono">
              BAIHELIANG UNDERWATER MUSEUM DIGITAL RESURRECTED · © 2026
            </span>
          </div>
        </section>

        </div>
      </main>

      {/* 5. IMMERSIVE COMPREHENSIVE SECONDARY DETAIL VIEW PANEL */}
      <AnimatePresence>
        {currentDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 w-full h-full z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-[12px] select-none text-[#e5dec9]"
          >
            {/* Click backdrop to exit */}
            <div 
              className="absolute inset-0 cursor-default" 
              onClick={closeDetailWithParticles} 
            />

            <motion.div
              id="detail-modal-card"
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="relative w-full max-w-5xl h-[85vh] bg-[#0c1921]/95 border border-[#c9af7f]/30 rounded-xl overflow-hidden flex flex-col md:flex-row shadow-[0_30px_100px_rgba(0,0,0,0.95)] z-10"
            >
              {/* Close Button overlay */}
              <button
                onClick={closeDetailWithParticles}
                className="absolute right-4 top-4 z-40 p-2.5 rounded-full bg-black/40 hover:bg-[#c9af7f] text-[#e5dec9] hover:text-black transition-all cursor-pointer border border-white/5 active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Left Column: Visual Artwork Area */}
              <div className="w-full md:w-[45%] h-[40%] md:h-full relative overflow-hidden bg-black/50 border-r border-white/5">
                {/* Generated theme-based high-end imagery with fallback styling */}
                <motion.div 
                  initial={{ scale: 1.1, filter: 'blur(10px)' }}
                  animate={{ scale: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0 bg-cover bg-center brightness-[0.8] hover:scale-105 transition-transform duration-700"
                  style={{ 
                    backgroundImage: `url("${currentDetail.image}")`
                  }}
                />
                
                {/* Frame border highlight */}
                <div className="absolute inset-4 border border-[#c9af7f]/25 pointer-events-none" />
                <div className="absolute bottom-6 left-6 right-6 z-20 bg-black/60 p-4 rounded border border-white/10 backdrop-blur-md">
                  <span className="text-[#c9af7f] text-[9px] tracking-[3px] font-mono block mb-1">
                    HISTORIC PRESERVATION RECORD
                  </span>
                  <span className="text-sm font-sans font-medium text-[#e5dec9]">
                    {currentDetail.era}
                  </span>
                </div>
              </div>

              {/* Right Column: In-depth Interactive Content */}
              <div className="w-full md:w-[55%] h-[60%] md:h-full p-6 md:p-10 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {/* Category breadcrumb */}
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 text-[10px] tracking-[4px] font-mono font-bold">RECON_INFO</span>
                    <span className="w-6 h-[1.5px] bg-[#c9af7f]/30"></span>
                    <span className="text-slate-400 text-[9px] tracking-[3px] font-mono">ID: {activeDetail?.toUpperCase()}</span>
                  </div>

                  {/* Titles */}
                  <div className="space-y-2">
                    <h2 className="text-2xl md:text-3xl font-serif font-black text-[#e5dec9] tracking-wider leading-tight">
                      {currentDetail.title}
                    </h2>
                    <p className="text-sm text-[#c9af7f] tracking-wide font-medium">
                      {currentDetail.subtitle}
                    </p>
                  </div>

                  {/* Long Texts (rendered elegantly with premium line-height) */}
                  <div className="space-y-4 text-slate-300 text-xs md:text-sm leading-relaxed tracking-wide text-justify pl-3 border-l-2 border-[#c9af7f]/30 font-sans">
                    {currentDetail.content.map((paragraph: string, index: number) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </div>

                {/* Sub-grid system specs */}
                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-2 text-[10px] tracking-[2px] font-mono text-[#c9af7f] font-bold">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span>白鹤科研局测算参数/科学特征：</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentDetail.specs.map((spec: any, i: number) => (
                      <div key={i} className="bg-black/40 border border-white/5 p-3 rounded flex flex-col gap-1">
                        <span className="text-[9px] tracking-wider font-mono text-slate-400">{spec.label}</span>
                        <span className="text-xs font-sans text-amber-100 font-medium">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

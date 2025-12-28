// import React, { useRef, useEffect, useCallback } from 'react';
// import { useTheme } from '@/hooks/use-theme';

// interface Particle {
//   x: number;
//   y: number;
//   size: number;
//   speedX: number;
//   speedY: number;
//   color: string;
//   // Removed supernova-specific properties
// }

// const ParticleBackground: React.FC = () => {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const { theme } = useTheme();
//   const particlesArray = useRef<Particle[]>([]);

//   const getRandom = (min: number, max: number) => Math.random() * (max - min) + min;

//   const createParticle = useCallback((canvas: HTMLCanvasElement, particleTheme: string): Particle => {
//     // Reverted to original star creation logic
//     const size = getRandom(1, 2.5);
//     const x = Math.random() * canvas.width;
//     const y = Math.random() * canvas.height;
//     const speedX = getRandom(-0.15, 0.15);
//     const speedY = getRandom(-0.15, 0.15);
//     let color = '';
//     const baseLightness = particleTheme === 'dark' ? getRandom(75, 95) : getRandom(40, 60);
//     const alpha = getRandom(0.2, 0.8);

//     if (Math.random() > 0.1) {
//         color = `hsla(0, 0%, ${baseLightness}%, ${alpha})`;
//     } else {
//         const hue = getRandom(180, 220);
//         color = `hsla(${hue}, ${getRandom(30, 60)}%, ${baseLightness}%, ${alpha})`;
//     }
//     return { x, y, size, speedX, speedY, color };
//   }, []); // Removed theme from dependency array as it's passed directly now

//   const initParticles = useCallback((canvas: HTMLCanvasElement) => {
//     particlesArray.current = [];
//     const numberOfParticles = Math.min(Math.floor(canvas.width / 30), 60);
//     for (let i = 0; i < numberOfParticles; i++) {
//       particlesArray.current.push(createParticle(canvas, theme)); // Pass theme here
//     }
//   }, [createParticle, theme]); // Added theme dependency

//   const animateParticles = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     for (let i = 0; i < particlesArray.current.length; i++) {
//       let p = particlesArray.current[i];
      
//       ctx.fillStyle = p.color;
//       ctx.beginPath();
//       ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
//       ctx.fill();

//       p.x += p.speedX;
//       p.y += p.speedY;

//       if (p.x > canvas.width + p.size) p.x = -p.size;
//       if (p.x < -p.size) p.x = canvas.width + p.size;
//       if (p.y > canvas.height + p.size) p.y = -p.size;
//       if (p.y < -p.size) p.y = canvas.height + p.size;
//     }
//     requestAnimationFrame(() => animateParticles(ctx, canvas));
//   }, []); // Removed createParticle and theme dependencies, not needed here directly

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;

//     let animationFrameId: number;
//     const resizeObserver = new ResizeObserver(() => {
//         if (canvasRef.current) {
//             canvasRef.current.width = canvasRef.current.offsetWidth;
//             canvasRef.current.height = canvasRef.current.offsetHeight;
//             initParticles(canvasRef.current); // initParticles will use the theme from its own scope
//         }
//     });
    
//     if (canvasRef.current) {
//         resizeObserver.observe(canvasRef.current);
//         canvasRef.current.width = canvasRef.current.offsetWidth;
//         canvasRef.current.height = canvasRef.current.offsetHeight;
//         initParticles(canvasRef.current);
//         animationFrameId = requestAnimationFrame(() => animateParticles(ctx, canvasRef.current!));
//     }
    
//     return () => {
//       if (canvasRef.current) {
//         resizeObserver.unobserve(canvasRef.current);
//       }
//       if (animationFrameId) {
//         cancelAnimationFrame(animationFrameId);
//       }
//       particlesArray.current = [];
//     };
//   }, [initParticles, animateParticles]); // Theme is implicitly handled by initParticles

//   return (
//     <canvas 
//       ref={canvasRef} 
//       className="absolute inset-0 -z-10 w-full h-full"
//       aria-hidden="true"
//     />
//   );
// };

// export default ParticleBackground; 
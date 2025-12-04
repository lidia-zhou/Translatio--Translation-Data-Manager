import React, { useEffect, useRef } from 'react';

const GlobalFlowBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize(); // Force initial size

    // Configuration
    const GLOBE_RADIUS = Math.min(width, height) * 0.35;
    const DOT_COUNT = 100; // Increased count
    const DOT_RADIUS = 2.5; // Slightly larger
    const PERSPECTIVE = width * 0.8;
    const ROTATION_SPEED = 0.0015;
    
    // State
    let rotation = 0;

    interface Point3D {
      lat: number;
      lon: number;
    }

    // Generate random points on a sphere
    const points: Point3D[] = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const lat = Math.acos(2 * Math.random() - 1); // 0 to PI
      const lon = 2 * Math.PI * Math.random(); // 0 to 2PI
      points.push({ lat, lon });
    }

    // Create random connections (Translation flows)
    const connections: [number, number][] = [];
    for(let i=0; i< points.length; i++) {
        // Connect to 1-2 other points to create a network web
        if(Math.random() > 0.6) {
            const target = Math.floor(Math.random() * points.length);
            if(target !== i) connections.push([i, target]);
        }
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Center of screen
      const cx = width / 2;
      const cy = height / 2;

      rotation += ROTATION_SPEED;

      // 1. Calculate 3D positions and 2D projections
      const projectedPoints = points.map(p => {
        // Sphere coordinates
        const x3d = GLOBE_RADIUS * Math.sin(p.lat) * Math.cos(p.lon + rotation);
        const y3d = GLOBE_RADIUS * Math.cos(p.lat);
        const z3d = GLOBE_RADIUS * Math.sin(p.lat) * Math.sin(p.lon + rotation);

        // Projection
        // We add a minimum distance to avoid division by zero or negative z issues close to camera
        const scale = PERSPECTIVE / (PERSPECTIVE + z3d + GLOBE_RADIUS * 1.5); 
        const x2d = x3d * scale + cx;
        const y2d = y3d * scale + cy;

        return { x: x2d, y: y2d, scale, z: z3d };
      });

      // 2. Draw Connections (Arcs) - Draw these first so points sit on top
      connections.forEach(([i, j]) => {
        const p1 = projectedPoints[i];
        const p2 = projectedPoints[j];

        // Only draw if connected points are somewhat in front
        // z3d ranges roughly from -GLOBE_RADIUS to GLOBE_RADIUS
        if (p1.z > -GLOBE_RADIUS * 0.8 || p2.z > -GLOBE_RADIUS * 0.8) {
            // Opacity based on Z-depth
            const depth = Math.max(0, (p1.z + p2.z) / 2 + GLOBE_RADIUS);
            const maxDepth = GLOBE_RADIUS * 2;
            const alpha = Math.min(1, Math.pow(depth / maxDepth, 2)); // Quadratic fade for smoother look
            
            if (alpha < 0.05) return;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            
            // Quadratic Bezier: control point pulls towards center but slightly offset
            // to create a nice arc over the surface
            ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
            
            // Use a brighter color (Indigo-300/400)
            ctx.strokeStyle = `rgba(129, 140, 248, ${alpha * 0.3})`; 
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Draw a "packet" (particle) moving along the line
            const time = Date.now() * 0.0005;
            const speedOffset = (i * j) % 1000; // Randomize start
            const t = ((time + speedOffset) * 0.5) % 1;
            
            // Simple Quadratic Bezier interpolation formula
            const invT = 1 - t;
            const particleX = invT * invT * p1.x + 2 * invT * t * cx + t * t * p2.x;
            const particleY = invT * invT * p1.y + 2 * invT * t * cy + t * t * p2.y;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(particleX, particleY, 2 * scaleAvg(p1.scale, p2.scale), 0, Math.PI * 2);
            ctx.fill();
        }
      });

      // 3. Draw Points
      projectedPoints.forEach(p => {
        const depth = p.z + GLOBE_RADIUS;
        const maxDepth = GLOBE_RADIUS * 2;
        const alpha = Math.min(1, Math.pow(depth / maxDepth, 1.5));
        
        // Draw main dot
        ctx.fillStyle = `rgba(199, 210, 254, ${alpha})`; // Indigo-100
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_RADIUS * p.scale, 0, Math.PI * 2);
        ctx.fill();

        // Draw glow for front-facing dots
        if (p.z > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, DOT_RADIUS * p.scale * 2, 0, Math.PI * 2);
            ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Helper
  function scaleAvg(s1: number, s2: number) { return (s1 + s2) / 2; }

  return (
    <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        // Move the gradient here to ensure it's tied to the canvas element
        style={{ background: 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%)' }} 
    />
  );
};

export default GlobalFlowBackground;
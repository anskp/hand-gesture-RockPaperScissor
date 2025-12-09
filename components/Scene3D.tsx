import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Gesture } from '../types';

interface Scene3DProps {
  playerGesture: Gesture;
  botGesture: Gesture;
  isCountingDown: boolean;
}

// Assets configuration - Using hosted 3D Fluent Emojis
const ASSETS = {
  [Gesture.ROCK]: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Oncoming%20Fist.png',
  [Gesture.PAPER]: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Raised%20Hand.png',
  [Gesture.SCISSORS]: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Victory%20Hand.png',
  [Gesture.NONE]: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Thinking%20Face.png' 
};

// Fallback texture generator
const createFallbackTexture = (text: string, color: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(256, 256, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 200px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const Scene3D: React.FC<Scene3DProps> = ({ playerGesture, botGesture, isCountingDown }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerSpriteRef = useRef<THREE.Sprite | null>(null);
  const botSpriteRef = useRef<THREE.Sprite | null>(null);
  
  // Refs for animation state
  const frameIdRef = useRef<number>(0);
  const texturesRef = useRef<Record<string, THREE.Texture>>({});
  const timeRef = useRef<number>(0);

  // Function to safely update sprite texture
  const updateSprite = (sprite: THREE.Sprite, gesture: Gesture) => {
    const url = ASSETS[gesture];
    
    // If texture is already cached, use it
    if (texturesRef.current[url]) {
      if (sprite.material.map !== texturesRef.current[url]) {
        sprite.material.map = texturesRef.current[url];
        sprite.material.needsUpdate = true;
      }
      return;
    }

    // Load new texture
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous'; // Ensure CORS is handled for remote images
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        texturesRef.current[url] = tex;
        // Check if the gesture is still the same before applying (prevent race conditions)
        // Actually, for simplicity we just apply it. The next render loop or prop update will correct it if changed.
        sprite.material.map = tex;
        sprite.material.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(`Failed to load texture for ${gesture}, using fallback.`, err);
        // Create fallback
        const fallbackMap: Record<string, string> = {
          [Gesture.ROCK]: '🪨',
          [Gesture.PAPER]: '📄',
          [Gesture.SCISSORS]: '✂️',
          [Gesture.NONE]: '🤔'
        };
        const fallbackColor: Record<string, string> = {
          [Gesture.ROCK]: '#475569',
          [Gesture.PAPER]: '#3b82f6',
          [Gesture.SCISSORS]: '#ef4444',
          [Gesture.NONE]: '#eab308'
        };
        const fallbackTex = createFallbackTexture(fallbackMap[gesture] || '?', fallbackColor[gesture] || '#666');
        texturesRef.current[url] = fallbackTex;
        sprite.material.map = fallbackTex;
        sprite.material.needsUpdate = true;
      }
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827); // Tailwind gray-900
    // scene.fog = new THREE.Fog(0x111827, 10, 50); // Removed fog to make sprites clearer

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 100);
    camera.position.z = 10; // Brought closer
    camera.position.y = 0;
    camera.lookAt(0, 0, 0);

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    // --- Sprites ---
    const spriteMaterial = new THREE.SpriteMaterial({ 
       color: 0xffffff,
       transparent: true 
    });

    // Player
    const pSprite = new THREE.Sprite(spriteMaterial.clone());
    pSprite.position.set(-2.5, 0, 0);
    pSprite.scale.set(3, 3, 1);
    scene.add(pSprite);
    playerSpriteRef.current = pSprite;

    // Bot
    const bSprite = new THREE.Sprite(spriteMaterial.clone());
    bSprite.position.set(2.5, 0, 0);
    bSprite.scale.set(3, 3, 1);
    scene.add(bSprite);
    botSpriteRef.current = bSprite;

    // Contextual Grid
    const gridHelper = new THREE.GridHelper(40, 40, 0x334155, 0x1e293b);
    gridHelper.position.y = -3;
    gridHelper.rotation.x = 0; // Flat grid
    scene.add(gridHelper);

    // Initial Texture Load
    updateSprite(pSprite, Gesture.NONE);
    updateSprite(bSprite, Gesture.NONE);

    // --- Animation Loop ---
    const animate = (time: number) => {
      frameIdRef.current = requestAnimationFrame(animate);
      timeRef.current = time;

      // Calculate target scales based on activity
      // If we are playing and a gesture is detected, scale up
      
      if (playerSpriteRef.current && botSpriteRef.current) {
        
        // 1. Player Logic
        // Base hover
        const pHover = Math.sin(time * 0.002) * 0.1;
        playerSpriteRef.current.position.y = pHover;

        // Scaling logic - if gesture is active, scale up slightly
        // We use a simple Lerner for smooth scaling requires tracking state, 
        // but for simplicity we'll just set it or use math.sin for pulse
        
        // Apply rotation/tilt based on movement (simulated)
        const pTilt = Math.cos(time * 0.003) * 0.05;
        playerSpriteRef.current.material.rotation = pTilt;

        // 2. Bot Logic
        const bHover = Math.sin(time * 0.002 + 1) * 0.1;
        botSpriteRef.current.position.y = bHover;
        botSpriteRef.current.material.rotation = -pTilt;

        // 3. Countdown Shake
        if (isCountingDown) {
             const shakeAmp = 0.5;
             const shakeSpeed = 0.02;
             playerSpriteRef.current.position.y += Math.sin(time * shakeSpeed) * shakeAmp;
             botSpriteRef.current.position.y += Math.cos(time * shakeSpeed) * shakeAmp;
             
             // Reset scale during countdown
             playerSpriteRef.current.scale.setScalar(3);
             botSpriteRef.current.scale.setScalar(3);
        }
      }

      renderer.render(scene, camera);
    };
    animate(0);

    // Resize Handler
    const handleResize = () => {
      if (camera && containerRef.current && renderer) {
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameIdRef.current);
      if (containerRef.current && renderer) {
        containerRef.current.removeChild(renderer.domElement);
      }
      // Cleanup textures
      Object.values(texturesRef.current).forEach(t => t.dispose());
    };
  }, []); // Run once on mount

  // React to Player Gesture Changes
  useEffect(() => {
    if (playerSpriteRef.current) {
        updateSprite(playerSpriteRef.current, playerGesture);
        
        // Add a "pop" effect when gesture changes
        if (playerGesture !== Gesture.NONE) {
            // Simple pop by checking time or just setting scale larger temporarily? 
            // Since we don't have a tween library, we can set a larger scale 
            // and let the next render loop handle it if we had lerping.
            // For now, let's just make it bigger if it's a valid gesture.
            playerSpriteRef.current.scale.set(4, 4, 1);
        } else {
            playerSpriteRef.current.scale.set(3, 3, 1);
        }
    }
  }, [playerGesture]);

  // React to Bot Gesture Changes
  useEffect(() => {
    if (botSpriteRef.current) {
        updateSprite(botSpriteRef.current, botGesture);
        
        if (botGesture !== Gesture.NONE) {
            botSpriteRef.current.scale.set(4, 4, 1);
        } else {
            botSpriteRef.current.scale.set(3, 3, 1);
        }
    }
  }, [botGesture]);

  return <div ref={containerRef} className="absolute inset-0 z-0 w-full h-full" />;
};

export default Scene3D;
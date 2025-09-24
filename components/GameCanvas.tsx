import React, { useRef, useEffect, useCallback } from 'react';
import { Team, Difficulty, Player, Ball } from '../types';
import { AI_SPEED_MULTIPLIERS } from '../constants';

interface GameCanvasProps {
  player1Team: Team;
  player2Team: Team;
  isOpponentAI: boolean;
  difficulty: Difficulty;
  isPaused: boolean;
  onGoal: (scorer: 'player1' | 'player2') => void;
  triggerReset: number;
  controlSplitRatio: number;
}

interface ConfettiParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    opacity: number;
}

const DRAG = 0.998;
const SPIN_DRAG = 0.97;
const SPIN_FACTOR = 0.05;
const PLAYER_SMOOTHING_FACTOR = 0.4;

const GameCanvas: React.FC<GameCanvasProps> = ({
  player1Team,
  player2Team,
  isOpponentAI,
  difficulty,
  isPaused,
  onGoal,
  triggerReset,
  controlSplitRatio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameState = useRef({
    player1: null as Player | null,
    player2: null as Player | null,
    ball: null as Ball | null,
    mouse: { p1_x: window.innerWidth / 2, p2_x: window.innerWidth / 2 },
    ballTrail: [] as { x: number; y: number }[],
    confettiParticles: [] as ConfettiParticle[],
    goalShake: { side: null as 'top' | 'bottom' | null, progress: 0 },
    screenShake: { active: false, magnitude: 0, duration: 0 },
    scale: 1,
    paddleWidth: 70,
    paddleHeight: 8,
    playerRadius: 18,
    ballRadius: 10,
    goalWidth: 180,
    cornerBarrierSize: 30,
  });
  const animationFrameId = useRef<number | null>(null);
  const isPausedRef = useRef(isPaused);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const playSound = useCallback((sound: 'hit' | 'goal' | 'bounce') => {
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
            return;
        }
    }
    const audioCtx = audioContextRef.current;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    if (sound === 'hit') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (sound === 'bounce') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, now);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    } else if (sound === 'goal') {
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, now);
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.linearRampToValueAtTime(659.25, now + 0.1); // E5
        oscillator.frequency.linearRampToValueAtTime(783.99, now + 0.2); // G5
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    canvas.width = containerWidth;
    canvas.height = containerWidth * 1.6;

    const gs = gameState.current;
    gs.scale = canvas.width / 400;
    gs.paddleWidth = 70 * gs.scale;
    gs.paddleHeight = 8 * gs.scale;
    gs.playerRadius = 18 * gs.scale;
    gs.ballRadius = 10 * gs.scale;
    gs.goalWidth = 180 * gs.scale;
    gs.cornerBarrierSize = 30 * gs.scale;
  }, []);

  const resetPositions = useCallback((goalScorer?: 'player1' | 'player2') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gs = gameState.current;
    const aiSpeed = AI_SPEED_MULTIPLIERS[difficulty] || 0.1;

    gs.player1 = {
      x: canvas.width / 2, y: canvas.height - gs.playerRadius * 3, radius: gs.playerRadius, width: gs.paddleWidth, hitAnimation: 0, prevX: canvas.width / 2, velocityX: 0,
    };
    gs.player2 = {
      x: canvas.width / 2, y: gs.playerRadius * 3, radius: gs.playerRadius, width: gs.paddleWidth, speed: 6 * gs.scale, aiReact: aiSpeed, hitAnimation: 0, prevX: canvas.width / 2, velocityX: 0,
    };
    gs.ball = {
      x: canvas.width / 2, y: canvas.height / 2, radius: gs.ballRadius, speed: 7 * gs.scale, vx: 0, vy: 0, spin: 0, rotation: 0,
    };
    
    gs.mouse.p1_x = canvas.width / 2;
    gs.mouse.p2_x = canvas.width / 2;

    if (goalScorer) {
      gs.ball.vy = (goalScorer === 'player2' ? -7 : 7) * gs.scale;
    } else {
       gs.ball.vy = (Math.random() > 0.5 ? 1 : -1) * 7 * gs.scale;
    }
  }, [difficulty]);
  
  const triggerConfetti = useCallback((x: number, y: number) => {
    const gs = gameState.current;
    const newParticles = Array.from({ length: 500 }).map(() => ({
        x,
        y,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.7) * 50,
        radius: Math.random() * 4 * gs.scale + 2,
        color: `hsl(${Math.random() * 360}, 90%, 70%)`,
        opacity: 1,
    }));
    gs.confettiParticles.push(...newParticles);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const gs = gameState.current;
    const { player1, player2, ball, ballTrail, confettiParticles } = gs;

    ctx.save();

    if (gs.screenShake.active && gs.screenShake.duration > 0) {
        const dx = (Math.random() - 0.5) * 2 * gs.screenShake.magnitude;
        const dy = (Math.random() - 0.5) * 2 * gs.screenShake.magnitude;
        ctx.translate(dx, dy);
    }

    const stripeCount = 12;
    const stripeHeight = canvas.height / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#4a8a53' : '#417d49';
        ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
    }
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 3 * gs.scale;
    const w = canvas.width, h = canvas.height, midY = h / 2;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, midY, w * 0.15, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, midY, 3 * gs.scale, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeRect(w * 0.15, h - h * 0.25, w * 0.7, h * 0.25);
    ctx.strokeRect(w * 0.3, h - h * 0.1, w * 0.4, h * 0.1);
    ctx.beginPath(); ctx.arc(w / 2, h - h * 0.17, 4 * gs.scale, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2, h - h * 0.17, w * 0.1, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
    ctx.strokeRect(w * 0.15, 0, w * 0.7, h * 0.25);
    ctx.strokeRect(w * 0.3, 0, w * 0.4, h * 0.1);
    ctx.beginPath(); ctx.arc(w / 2, h * 0.17, 4 * gs.scale, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2, h * 0.17, w * 0.1, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, gs.cornerBarrierSize); ctx.lineTo(gs.cornerBarrierSize, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w, gs.cornerBarrierSize); ctx.lineTo(w - gs.cornerBarrierSize, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h - gs.cornerBarrierSize); ctx.lineTo(gs.cornerBarrierSize, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w, h - gs.cornerBarrierSize); ctx.lineTo(w - gs.cornerBarrierSize, h); ctx.stroke();

    const drawGoal = (yPos: number) => {
        const isTop = yPos === 0;
        const isAnimating = (isTop && gs.goalShake.side === 'top') || (!isTop && gs.goalShake.side === 'bottom');
        const shakeOffset = isAnimating ? Math.sin(gs.goalShake.progress * Math.PI * 16) * 20 * gs.scale * gs.goalShake.progress : 0;
        
        const goalDepth = 15 * gs.scale;
        const startX = canvas.width / 2 - gs.goalWidth / 2;
        
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5 * gs.scale;
        ctx.beginPath(); ctx.moveTo(startX + shakeOffset, yPos); ctx.lineTo(startX + shakeOffset, yPos + (isTop ? goalDepth : -goalDepth)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(startX + gs.goalWidth + shakeOffset, yPos); ctx.lineTo(startX + gs.goalWidth + shakeOffset, yPos + (isTop ? goalDepth : -goalDepth)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(startX + shakeOffset, yPos + (isTop ? goalDepth : -goalDepth)); ctx.lineTo(startX + gs.goalWidth + shakeOffset, yPos + (isTop ? goalDepth : -goalDepth)); ctx.stroke();
        
        ctx.lineWidth = 1 * gs.scale; ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        for (let i = 1; i < 15; i++) {
            const lineX = startX + i * (gs.goalWidth / 15);
            ctx.beginPath(); ctx.moveTo(lineX + shakeOffset, yPos); ctx.lineTo(lineX + shakeOffset, yPos + (isTop ? goalDepth : -goalDepth)); ctx.stroke();
        }
    }
    drawGoal(0);
    drawGoal(h);

    if (player1 && player2 && ball) {
      const highSpeedThreshold = 14 * gs.scale;
      for (let i = 0; i < ballTrail.length; i++) {
        const pos = ballTrail[i];
        const progress = i / ballTrail.length;
        ctx.save();
        ctx.globalAlpha = 1 - progress;

        if (ball.speed > highSpeedThreshold) {
            const r = 255;
            const g = Math.max(0, Math.floor(255 - progress * 255));
            const b = 0;
            ctx.fillStyle = `rgba(${r},${g},${b}, ${0.8 * (1 - progress)})`;
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        }
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ball.radius * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const drawPlayer = (p: Player, isTop: boolean, team: Team) => {
          ctx.beginPath(); ctx.arc(p.x, p.y + 4 * gs.scale, p.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
          ctx.save();
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = team.color1; ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius, p.radius * 2);
          ctx.fillStyle = team.color2; ctx.fillRect(p.x, p.y - p.radius, p.radius, p.radius * 2);
          ctx.restore();
          
          const flashProgress = p.hitAnimation > 0 ? Math.sin(p.hitAnimation * Math.PI) : 0;
          
          const scaleEffect = 1 + 0.5 * flashProgress;
          const animatedWidth = p.width * scaleEffect;
          const animatedHeight = gs.paddleHeight * scaleEffect;
          const paddleY = isTop ? p.y + p.radius - gs.paddleHeight * 1.5 : p.y - p.radius + gs.paddleHeight / 2;

          const baseColor = { r: 51, g: 51, b: 51 };
          const flashColor = { r: 241, g: 196, b: 15 };
          const r = Math.floor(baseColor.r + (flashColor.r - baseColor.r) * flashProgress);
          const g = Math.floor(baseColor.g + (flashColor.g - baseColor.g) * flashProgress);
          const b = Math.floor(baseColor.b + (flashColor.b - baseColor.b) * flashProgress);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          
          ctx.fillRect(p.x - animatedWidth / 2, paddleY - (animatedHeight-gs.paddleHeight)/2, animatedWidth, animatedHeight);
      }
      drawPlayer(player1, false, player1Team);
      drawPlayer(player2, true, player2Team);

      const drawSoccerBall = (x: number, y: number, r: number, rotation: number) => {
        ctx.beginPath(); ctx.arc(x, y + 4*gs.scale, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.clip();
        
        ctx.fillStyle = "white"; ctx.fillRect(-r, -r, 2 * r, 2 * r);
        ctx.fillStyle = "black";
        const sides = 5, angle = 2 * Math.PI / sides;
        for(let i = 0; i < sides; i++) {
            ctx.beginPath(); let curAngle = i * angle - Math.PI/2;
            ctx.moveTo(r * 0.6 * Math.cos(curAngle), r * 0.6 * Math.sin(curAngle));
            ctx.arc(0, 0, r, curAngle - angle / 4, curAngle + angle / 4);
            ctx.closePath(); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 2 * Math.PI); ctx.fill();
        
        ctx.restore();
        
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.strokeStyle = "black"; ctx.lineWidth = 1; ctx.stroke();
      }
      drawSoccerBall(ball.x, ball.y, ball.radius, ball.rotation);
    }
      confettiParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    ctx.restore();
  }, [player1Team, player2Team]);

  const update = useCallback(() => {
    const canvas = canvasRef.current;
    const gs = gameState.current;

    gs.confettiParticles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.vx *= 0.99;
        p.opacity -= 0.008;
        if (p.opacity <= 0) {
            gs.confettiParticles.splice(index, 1);
        }
    });

    if (gs.goalShake.progress > 0) {
        gs.goalShake.progress -= 0.02;
    } else {
        gs.goalShake.side = null;
    }

    if (gs.screenShake.active) {
        gs.screenShake.duration--;
        if (gs.screenShake.duration <= 0) {
            gs.screenShake.active = false;
        }
    }

    if (!canvas || isPausedRef.current) {
        if (gs.player1?.hitAnimation && gs.player1.hitAnimation > 0) gs.player1.hitAnimation -= 0.05;
        if (gs.player2?.hitAnimation && gs.player2.hitAnimation > 0) gs.player2.hitAnimation -= 0.05;
        return;
    }

    const { player1, player2, ball } = gs;
    if (!player1 || !player2 || !ball) return;
    
    if (player1.hitAnimation && player1.hitAnimation > 0) player1.hitAnimation -= 0.05;
    if (player2.hitAnimation && player2.hitAnimation > 0) player2.hitAnimation -= 0.05;

    gs.ballTrail.unshift({ x: ball.x, y: ball.y });
    if (gs.ballTrail.length > 15) gs.ballTrail.pop();
    
    ball.vx += ball.spin;
    ball.vx *= DRAG;
    ball.vy *= DRAG;
    ball.spin *= SPIN_DRAG;
    
    const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const minSpeed = 4 * gs.scale; 
    if (currentSpeed > 0 && currentSpeed < minSpeed) {
        const speedFactor = minSpeed / currentSpeed;
        ball.vx *= speedFactor;
        ball.vy *= speedFactor;
    }
    ball.speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.rotation += ball.vx * 0.05;

    const { mouse } = gs;
    player1.x += (mouse.p1_x - player1.x) * PLAYER_SMOOTHING_FACTOR;
    player1.x = Math.max(player1.width / 2, Math.min(canvas.width - player1.width / 2, player1.x));
    player1.velocityX = player1.x - player1.prevX;
    player1.prevX = player1.x;
    
    if (isOpponentAI) {
      const targetX = ball.vy < 0 ? ball.x : canvas.width / 2;
      player2.x += (targetX - player2.x) * (player2.aiReact || 0.1);
    } else {
      player2.x += (mouse.p2_x - player2.x) * PLAYER_SMOOTHING_FACTOR;
    }
    player2.x = Math.max(player2.width / 2, Math.min(canvas.width - player2.width / 2, player2.x));
    player2.velocityX = player2.x - player2.prevX;
    player2.prevX = player2.x;

    const accelerateBallOnWallHit = () => {
        playSound('bounce');
        const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const newSpeed = Math.min(15 * gs.scale, currentSpeed + 1.0 * gs.scale);
        if (currentSpeed > 0) {
            const scaleFactor = newSpeed / currentSpeed;
            ball.vx *= scaleFactor;
            ball.vy *= scaleFactor;
            ball.speed = newSpeed;
        }
    };
    
    const w = canvas.width, h = canvas.height, r = ball.radius, b = gs.cornerBarrierSize;
    let collided = false;
    if (ball.x < b && ball.y < b && (ball.x + ball.y < b + r)) { const tempVx = ball.vx; ball.vx = -ball.vy; ball.vy = -tempVx; collided = true; } 
    else if (ball.x > w - b && ball.y < b && ((w - ball.x) + ball.y < b + r)) { const tempVx = ball.vx; ball.vx = ball.vy; ball.vy = tempVx; collided = true; } 
    else if (ball.x < b && ball.y > h - b && (ball.x + (h - ball.y) < b + r)) { const tempVx = ball.vx; ball.vx = ball.vy; ball.vy = tempVx; collided = true; } 
    else if (ball.x > w - b && ball.y > h - b && ((w - ball.x) + (h - ball.y) < b + r)) { const tempVx = ball.vx; ball.vx = -ball.vy; ball.vy = -tempVx; collided = true; }
    if(collided) accelerateBallOnWallHit();

    if (!collided) {
        if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) { ball.vx *= -1; accelerateBallOnWallHit(); ball.spin *= -0.5; }
    }
    
    const goalStartX = (canvas.width / 2) - (gs.goalWidth / 2);
    const goalEndX = (canvas.width / 2) + (gs.goalWidth / 2);
    if (ball.y - ball.radius < 0) {
      if (ball.x > goalStartX && ball.x < goalEndX) {
        onGoal('player1');
        playSound('goal');
        gs.goalShake = { side: 'top', progress: 1 };
        triggerConfetti(canvas.width / 2, 0);
        ball.x = -1000;
      } 
      else { ball.y = ball.radius; ball.vy *= -1; accelerateBallOnWallHit(); }
    }
    if (ball.y + ball.radius > canvas.height) {
      if (ball.x > goalStartX && ball.x < goalEndX) {
        onGoal('player2');
        playSound('goal');
        gs.goalShake = { side: 'bottom', progress: 1 };
        triggerConfetti(canvas.width / 2, canvas.height);
        ball.x = -1000;
      }
      else { ball.y = canvas.height - ball.radius; ball.vy *= -1; accelerateBallOnWallHit(); }
    }
    
    const handlePaddleCollision = (player: Player, isTopPlayer: boolean) => {
        const paddleY = isTopPlayer ? player.y + player.radius - gs.paddleHeight/2 : player.y - player.radius + gs.paddleHeight/2;
        const paddleStartX = player.x - player.width/2;
        const paddleEndX = player.x + player.width/2;
        if((isTopPlayer ? (ball.y - ball.radius < paddleY && ball.y > player.y) : (ball.y + ball.radius > paddleY && ball.y < player.y)) && ball.x > paddleStartX && ball.x < paddleEndX) {
            playSound('hit');
            player.hitAnimation = 1;
            let collidePoint = (ball.x - player.x) / (player.width / 2);
            let angleRad = collidePoint * (Math.PI / 3);
            let direction = isTopPlayer ? 1 : -1;
            ball.speed = Math.min(18 * gs.scale, ball.speed + 1.2 * gs.scale);

            if (ball.speed > 11 * gs.scale) {
                gs.screenShake = { active: true, magnitude: 5 * gs.scale, duration: 12 };
            }

            ball.vx = ball.speed * Math.sin(angleRad);
            ball.vy = direction * ball.speed * Math.cos(angleRad);
            ball.spin = player.velocityX * SPIN_FACTOR;
            gs.ballTrail = [];
        }
    }
    handlePaddleCollision(player1, false);
    handlePaddleCollision(player2, true);

  }, [isOpponentAI, onGoal, playSound, triggerConfetti]);


  const gameLoop = useCallback(() => {
    update();
    draw();
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  useEffect(() => {
    resizeCanvas();
    resetPositions();
    window.addEventListener('resize', resizeCanvas);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
        if (isPausedRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const clientX = e.clientX;
        const clientY = e.clientY;
        const splitY = rect.top + rect.height * controlSplitRatio;
        const canvasX = (clientX - rect.left) * scaleX;
        
        if (clientY > splitY) {
            gameState.current.mouse.p1_x = canvasX;
        } else if (!isOpponentAI) {
            gameState.current.mouse.p2_x = canvasX;
        }
    };
    
    const handleTouchEvent = (e: TouchEvent) => {
        e.preventDefault();
        if (isPausedRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const splitY = rect.top + rect.height * controlSplitRatio;

        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const canvasX = (touch.clientX - rect.left) * scaleX;
            if (touch.clientY > splitY) {
                gameState.current.mouse.p1_x = canvasX;
            } else if (!isOpponentAI) {
                gameState.current.mouse.p2_x = canvasX;
            }
        }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchEvent, { passive: false });
    canvas.addEventListener('touchstart', handleTouchEvent, { passive: false });

    animationFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchEvent);
      canvas.removeEventListener('touchstart', handleTouchEvent);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [controlSplitRatio, isOpponentAI, gameLoop, resizeCanvas, resetPositions]);

  useEffect(() => {
    if(triggerReset > 0) {
        const kickOffDirection = triggerReset % 2 === 0 ? 'player1' : 'player2';
        resetPositions(kickOffDirection);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerReset]);

  return <canvas ref={canvasRef} className="w-full cursor-none" />;
};

export default GameCanvas;
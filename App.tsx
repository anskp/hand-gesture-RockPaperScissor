import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Trophy, AlertCircle, Loader2, VideoOff } from 'lucide-react';
import Scene3D from './components/Scene3D';
import { visionService } from './services/visionService';
import { GameState, Gesture, Score, GameResult } from './types';

const WINNING_SCORE = 3;

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [score, setScore] = useState<Score>({ player: 0, bot: 0 });
  const [playerGesture, setPlayerGesture] = useState<Gesture>(Gesture.NONE);
  const [botGesture, setBotGesture] = useState<Gesture>(Gesture.NONE);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<number | null>(null);

  // Determine winner
  const determineWinner = useCallback((p: Gesture, b: Gesture) => {
    if (p === Gesture.NONE) return 'invalid';
    if (p === b) return 'draw';
    if (
      (p === Gesture.ROCK && b === Gesture.SCISSORS) ||
      (p === Gesture.PAPER && b === Gesture.ROCK) ||
      (p === Gesture.SCISSORS && b === Gesture.PAPER)
    ) {
      return 'player';
    }
    return 'bot';
  }, []);

  const startCamera = useCallback(async () => {
      setError(null);
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { 
                  width: { ideal: 640 }, 
                  height: { ideal: 480 },
                  facingMode: "user"
              }, 
              audio: false 
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
               videoRef.current?.play();
               setPermissionGranted(true);
            };
          }
      } catch (err: any) {
          console.error("Camera initialization error:", err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              setError("Camera access denied. Please allow camera permissions in your browser settings to play.");
          } else if (err.name === 'NotFoundError') {
              setError("No camera found. Please connect a camera device.");
          } else {
              setError(`Camera error: ${err.message || 'Unknown error'}`);
          }
          setPermissionGranted(false);
      }
  }, []);

  // Initialize MediaPipe & Camera
  useEffect(() => {
    const init = async () => {
      try {
        await visionService.initialize();
        setIsModelLoading(false);
        await startCamera();
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError(`System error: ${err.message}`);
        setIsModelLoading(false);
      }
    };
    init();
  }, [startCamera]);

  // Detection Loop
  useEffect(() => {
    if (!permissionGranted || isModelLoading) return;

    const detectLoop = () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const result = visionService.detect(videoRef.current);
        setPlayerGesture(result.gesture);
      }
      loopRef.current = requestAnimationFrame(detectLoop);
    };

    loopRef.current = requestAnimationFrame(detectLoop);

    return () => {
        if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [permissionGranted, isModelLoading]);


  // Game Logic Loop
  useEffect(() => {
    if (gameState === GameState.COUNTDOWN) {
      setBotGesture(Gesture.NONE);
      setGameResult(null);
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setGameState(GameState.PLAYING);
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        // We give a very short window in PLAYING state to just capture the frame
        // Since MediaPipe is real-time, we can just grab the current state after a brief moment
        let timeout = setTimeout(() => {
            const moves = [Gesture.ROCK, Gesture.PAPER, Gesture.SCISSORS];
            const botMove = moves[Math.floor(Math.random() * moves.length)];
            setBotGesture(botMove);

            setGameState(GameState.RESULT);
            
            const winner = determineWinner(playerGesture, botMove);
            let msg = "";
            
            if (winner === 'invalid') {
                msg = "No Hand Detected";
            } else if (winner === 'player') {
                setScore(s => ({ ...s, player: s.player + 1 }));
                msg = "You Win!";
            } else if (winner === 'bot') {
                setScore(s => ({ ...s, bot: s.bot + 1 }));
                msg = "Bot Wins!";
            } else {
                msg = "Draw!";
            }
            setGameResult({ winner: winner, message: msg });

        }, 500); // 0.5s "moment" to lock in the gesture

        return () => clearTimeout(timeout);
    }
  }, [gameState, playerGesture, determineWinner]);

  useEffect(() => {
      if (score.player >= WINNING_SCORE || score.bot >= WINNING_SCORE) {
          setGameState(GameState.GAME_OVER);
      }
  }, [score]);

  const resetGame = () => {
      setScore({ player: 0, bot: 0 });
      setGameState(GameState.IDLE);
      setPlayerGesture(Gesture.NONE);
      setBotGesture(Gesture.NONE);
      setGameResult(null);
  };

  const playRound = () => {
      setGameResult(null);
      setGameState(GameState.COUNTDOWN);
      setCountdown(3);
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden text-white font-sans">
      {/* 3D Background/Scene */}
      <Scene3D 
        playerGesture={playerGesture} 
        botGesture={botGesture}
        isCountingDown={gameState === GameState.COUNTDOWN} 
      />

      {/* Hidden Video for MediaPipe */}
      <video 
        ref={videoRef} 
        className="absolute top-0 left-0 opacity-0 pointer-events-none" 
        playsInline 
        muted 
        width="640"
        height="480"
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 flex flex-col pointer-events-none z-10 p-6">
        
        {/* Header / Score */}
        <header className="flex justify-between items-start">
            <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    MediaPipe 3D RPS
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Camera size={16} />
                    <span>
                        {isModelLoading ? 'Loading Model...' : (permissionGranted ? 'Vision Active' : 'Camera Off')}
                    </span>
                    <span className={`animate-pulse ${isModelLoading ? 'text-yellow-500' : (permissionGranted ? 'text-green-500' : 'text-red-500')}`}>●</span>
                </div>
            </div>

            <div className="flex gap-4">
                 {/* Player Score */}
                 <div className="flex flex-col items-center bg-blue-900/40 backdrop-blur-md p-4 rounded-2xl border border-blue-500/30">
                    <span className="text-sm uppercase tracking-widest text-blue-300 mb-1">You</span>
                    <span className="text-4xl font-bold text-white">{score.player}</span>
                 </div>
                 
                 {/* Bot Score */}
                 <div className="flex flex-col items-center bg-red-900/40 backdrop-blur-md p-4 rounded-2xl border border-red-500/30">
                    <span className="text-sm uppercase tracking-widest text-red-300 mb-1">Bot</span>
                    <span className="text-4xl font-bold text-white">{score.bot}</span>
                 </div>
            </div>
        </header>

        {/* Center Game Status */}
        <div className="flex-1 flex flex-col items-center justify-center pointer-events-auto">
            
            {error ? (
                <div className="flex flex-col items-center gap-6 bg-red-950/80 backdrop-blur-xl p-8 rounded-3xl border border-red-500/30 max-w-md text-center">
                    <VideoOff className="w-16 h-16 text-red-400" />
                    <div>
                        <h2 className="text-2xl font-bold text-red-200 mb-2">Camera Error</h2>
                        <p className="text-red-300/80">{error}</p>
                    </div>
                    <button 
                        onClick={startCamera}
                        className="bg-red-500/20 hover:bg-red-500/40 text-red-200 px-6 py-2 rounded-full font-semibold transition-all border border-red-500/50"
                    >
                        Retry Camera
                    </button>
                </div>
            ) : isModelLoading ? (
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                    <p className="text-xl font-medium">Loading Vision Model...</p>
                </div>
            ) : (
                <>
                    {gameState === GameState.IDLE && (
                        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
                             <div className="bg-black/50 p-8 rounded-3xl backdrop-blur-xl border border-white/10 max-w-md">
                                <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                                <h2 className="text-3xl font-bold mb-4">Ready to Play?</h2>
                                <p className="text-gray-300 mb-8">
                                    Show your hand to the camera. Win 3 rounds to become the champion.
                                </p>
                                <button 
                                    onClick={playRound}
                                    className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform shadow-lg hover:shadow-blue-500/50"
                                >
                                    Start Game
                                </button>
                             </div>
                        </div>
                    )}

                    {gameState === GameState.COUNTDOWN && (
                        <div className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-2xl animate-pulse">
                            {countdown}
                        </div>
                    )}

                    {gameState === GameState.PLAYING && (
                        <div className="text-4xl font-bold text-white drop-shadow-lg animate-bounce">
                            SHOW YOUR HAND!
                        </div>
                    )}

                    {gameState === GameState.RESULT && gameResult && (
                        <div className="text-center space-y-4">
                            <div className="text-6xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                                {gameResult.message}
                            </div>
                            <div className="text-xl text-gray-300">
                                {playerGesture === Gesture.NONE ? 'No Detection' : playerGesture} vs {botGesture}
                            </div>
                            {gameResult.winner === 'invalid' && (
                                <p className="text-red-400 text-sm">Please hold your hand clearly in front of the camera</p>
                            )}
                            <button 
                                onClick={playRound}
                                className="mt-8 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-6 py-2 rounded-full font-semibold transition-all"
                            >
                                {gameResult.winner === 'invalid' ? 'Try Again' : 'Next Round →'}
                            </button>
                        </div>
                    )}

                    {gameState === GameState.GAME_OVER && (
                         <div className="text-center space-y-6 bg-black/80 p-12 rounded-3xl backdrop-blur-xl border border-white/20">
                            <h2 className="text-5xl font-bold text-white mb-2">
                                {score.player >= WINNING_SCORE ? "VICTORY!" : "DEFEAT"}
                            </h2>
                            <p className="text-xl text-gray-400">
                                {score.player >= WINNING_SCORE ? "You crushed the machine." : "The machine detected your weakness."}
                            </p>
                            <button 
                                onClick={resetGame}
                                className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold transition-transform hover:scale-105"
                            >
                                <RefreshCw size={20} />
                                Play Again
                            </button>
                         </div>
                    )}
                </>
            )}

            {/* Gesture Feedback Toast */}
            {gameState !== GameState.GAME_OVER && !isModelLoading && !error && (
                <div className={`absolute bottom-24 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-sm flex items-center gap-2 transition-all ${playerGesture !== Gesture.NONE ? 'opacity-100' : 'opacity-50'}`}>
                    {playerGesture === Gesture.NONE ? (
                        <>
                            <AlertCircle size={16} className="text-yellow-500" />
                            <span>Waiting for gesture...</span>
                        </>
                    ) : (
                        <>
                            <span>Detected:</span>
                            <span className="font-bold text-blue-300">{playerGesture}</span>
                        </>
                    )}
                </div>
            )}
        </div>

        {/* Instructions Footer */}
        <footer className="text-center text-gray-500 text-xs pb-4">
            Powered by MediaPipe Tasks Vision
        </footer>
      </div>
    </div>
  );
}

export default App;
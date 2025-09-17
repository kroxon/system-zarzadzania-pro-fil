import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

interface NotFound404Props {
  isAuthenticated: boolean;
}

export default function NotFound404({ isAuthenticated }: NotFound404Props) {
  const navigate = useNavigate();

  const butterflyRef = useRef<HTMLDivElement>(null);
  const [fly, setFly] = useState(false);
  const [showZero, setShowZero] = useState(false);

  useEffect(() => {
    // Start butterfly animation after 1.5s
    const timer = setTimeout(() => setFly(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!fly) return;
    const handleAnimEnd = () => {
      setShowZero(true);
    };
    const el = butterflyRef.current;
    if (el) {
      el.addEventListener('animationend', handleAnimEnd);
      return () => el.removeEventListener('animationend', handleAnimEnd);
    }
  }, [fly]);

  const handleGoBack = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 to-blue-100 overflow-hidden"
      style={{
        backgroundImage: "url('/assets/background/404 background.png')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left bottom, right bottom",
  backgroundSize: "cover",
      }}
    >
      <div className="relative w-full h-80 flex items-center justify-center select-none">
        <span className="text-[8rem] font-extrabold text-indigo-700 drop-shadow-lg" style={{ position: 'relative', left: 0 }}>4</span>
        <div style={{ position: 'relative', width: '8rem', height: '8rem' }}>
          {/* Butterfly as zero, then zero after animation */}
          {!showZero ? (
            <div
              ref={butterflyRef}
              className={`absolute left-0 top-0 w-full h-full transition-transform duration-1000 ease-in-out ${fly ? 'animate-butterfly-fly' : ''}`}
              style={{ zIndex: 10 }}
            >
              <img src="/assets/logo/PRO-FIL-removebg-preview.png" alt="Motyl fundacji" style={{ width: '100%', height: '100%' }} />
            </div>
          ) : (
            <FadeInZero />
          )}
        </div>
        <span className="text-[8rem] font-extrabold text-indigo-700 drop-shadow-lg" style={{ position: 'relative', right: 0 }}>4</span>
      </div>
      <h1 className="text-3xl font-bold text-indigo-700 mt-6 mb-2">Nie znaleziono strony</h1>
      <p className="text-lg text-gray-600 mb-6 text-center max-w-md">Wygląda na to, że terapeuta zgubił drogę!<br/>Sprawdź adres lub wróć do panelu.</p>
      <button
        onClick={handleGoBack}
        className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
      >
        {isAuthenticated ? 'Powrót do panelu' : 'Powrót do logowania'}
      </button>
      {/* Butterfly flying animation keyframes (add to global CSS or Tailwind config) */}
      <style>{`
        @keyframes butterfly-fly {
          0% { transform: translate(0,0) scale(1) rotate(0deg); }
          10% { transform: translate(-10px,-20px) scale(1.05) rotate(-10deg); }
          20% { transform: translate(40px,-60px) scale(1.1) rotate(10deg); }
          40% { transform: translate(120px,-120px) scale(1.15) rotate(-15deg); }
          60% { transform: translate(-80px,-180px) scale(1.2) rotate(20deg); }
          80% { transform: translate(200px,-240px) scale(1.25) rotate(-20deg); }
          100% { transform: translate(600px,-400px) scale(1.3) rotate(30deg); opacity:0; }
        }
        .animate-butterfly-fly {
          animation: butterfly-fly 2.5s cubic-bezier(.4,0,.2,1) forwards;
        }
      `}</style>
    </div>
  );
}

// CSS for slow bounce animation (add to global styles or tailwind config)
// .animate-bounce-slow { animation: bounce 2.5s infinite; }
// @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }

// FadeInZero component for smooth fade-in
// ...existing code...

function FadeInZero() {
  const zeroRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = zeroRef.current;
    if (el) {
      el.style.opacity = '0';
      // Force reflow
      void el.offsetWidth;
      setTimeout(() => {
        el.style.opacity = '1';
      }, 10);
    }
  }, []);
  return (
    <span
      ref={zeroRef}
      className="absolute left-0 top-0 w-full h-full flex items-center justify-center text-[8rem] font-extrabold text-indigo-700 drop-shadow-lg"
      style={{ transition: 'opacity 2s cubic-bezier(.4,0,.2,1)' }}
    >
      0
    </span>
  );
}

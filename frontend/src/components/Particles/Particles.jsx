import { useMemo } from "react";
import "./Particles.css";

export default function Particles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 8}s`,
        duration: `${10 + Math.random() * 14}s`,
        size: `${2 + Math.random() * 2}px`,
        opacity: (0.1 + Math.random() * 0.15).toFixed(2),
      })),
    []
  );

  return (
    <div className="cv-particles" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * IntroAnimation Component for SevaSaathi AI
 * 
 * Plays the official opening launch animation when visiting the platform.
 * Features:
 * - Autoplays muted for broad browser compatibility
 * - Center-aligned, responsive, preserves aspect ratio
 * - Halts on final frame without looping
 * - Tap / click / Enter / Space initiates smooth 450ms fade-out transition
 * - Idempotent click guard prevents multiple triggers
 * - Accessible keyboard navigation & reduced-motion support
 */
export default function IntroAnimation({ onComplete }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const timerRef = useRef(null);

  // Smooth dismiss handler with transition delay
  const handleDismiss = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    // 450ms smooth fade-out transition before unmounting
    timerRef.current = setTimeout(() => {
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }, 450);
  }, [isTransitioning, onComplete]);

  // Clean up any pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Video playback initialization
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Attempt muted autoplay
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented by browser policy; user can tap to proceed
          console.warn('Intro video autoplay prevented by browser policy; ready for user tap.');
        });
      }
    }

    // Auto-focus container for keyboard accessibility (Space / Enter)
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Keyboard accessibility: Enter or Space triggers continue
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  const handleVideoEnded = () => {
    setHasEnded(true);
    // Keep final frame visible
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`sevasaathi-intro-overlay ${isTransitioning ? 'fade-out' : ''}`}
      onClick={handleDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleDismiss();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Continue to SevaSaathi AI"
    >
      {/* Background Ambient Glows */}
      <div className="intro-ambient-glow glow-1" />
      <div className="intro-ambient-glow glow-2" />

      {/* Fullscreen Video Wrapper */}
      <div className="intro-video-container">
        <video
          ref={videoRef}
          src="/sevasaathi-intro.mp4"
          className={`intro-video-element ${videoLoaded ? 'loaded' : ''}`}
          autoPlay
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setVideoLoaded(true)}
          onEnded={handleVideoEnded}
          onClick={handleDismiss}
        />

        {/* Brand Watermark / Tag */}
        <div className="intro-brand-header">
          <div className="intro-brand-badge">
            <Sparkles size={14} className="intro-badge-icon" />
            <span>SevaSaathi AI</span>
          </div>
        </div>
      </div>

      {/* Interactive Cue: Tap to Continue */}
      <div className="intro-continue-prompt" onClick={handleDismiss}>
        <div className="intro-continue-pill">
          <span>{hasEnded ? 'Continue to SevaSaathi AI' : 'Tap anywhere to continue'}</span>
          <ArrowRight size={16} className="intro-pill-arrow" />
        </div>
        <p className="intro-accessible-hint">Press Enter or Space</p>
      </div>

      {/* Direct Skip Button (Top Right) */}
      <button
        type="button"
        className="intro-skip-btn"
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        aria-label="Skip intro animation"
      >
        Skip intro
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

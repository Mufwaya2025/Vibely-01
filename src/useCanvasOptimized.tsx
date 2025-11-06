import { useEffect, useRef } from 'react';

export const useCanvasWillReadFrequently = (videoId: string = 'qr-reader-video') => {
  const appliedRef = useRef<boolean>(false);

  useEffect(() => {
    if (appliedRef.current) return;

    const handleSetup = () => {
      const video = document.getElementById(videoId) as HTMLVideoElement | null;
      if (!video) return;

      const canvas = video.parentElement?.querySelector('canvas');
      if (!canvas) return;

      const originalGetContext = canvas.getContext.bind(canvas);
      canvas.getContext = function (...args: any[]) {
        if (args.length > 0 && typeof args[0] === 'string' && args[0].startsWith('2d')) {
          if (!args[1] || typeof args[1] !== 'object') {
            args[1] = { willReadFrequently: true };
          } else if (!('willReadFrequently' in args[1])) {
            args[1] = { ...args[1], willReadFrequently: true };
          }
        }
        return originalGetContext(...args);
      };

      appliedRef.current = true;
    };

    const observer = new MutationObserver(() => handleSetup());
    observer.observe(document.body, { childList: true, subtree: true });
    handleSetup();

    return () => {
      observer.disconnect();
    };
  }, [videoId]);
};


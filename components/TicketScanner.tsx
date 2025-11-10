import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrReader } from 'react-qr-reader';
import { scanTicket } from '../services/ticketService';
import { useCanvasWillReadFrequently } from '../src/useCanvasOptimized';

interface TicketScannerProps {
  eventId: string;
  onTicketScanned?: (ticketId: string) => void;
  onClose: () => void;
}

type CameraAccessState = 'notRequested' | 'requested' | 'granted' | 'denied' | 'unsupported';

type BarcodeDetectionResult = { rawValue: string };
type BarcodeDetectorInstance = {
  detect: (source: CanvasImageSource) => Promise<BarcodeDetectionResult[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
  }
}

const transientScanErrors = new Set(['NotFoundException', 'ChecksumException', 'FormatException']);

const isTransientScanError = (err: unknown) => {
  if (!err) return false;
  const name = (err as { name?: string }).name ?? '';
  if (transientScanErrors.has(name)) return true;

  const message = (err as { message?: string }).message ?? '';
  const serialized = `${err ?? ''}`.toLowerCase();

  return (
    serialized.includes('scanner error') ||
    serialized.trim() === 'e2' ||
    message.toLowerCase().includes('e2') ||
    message.toLowerCase().includes('no code found')
  );
};

const isPermissionError = (err: unknown) => {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { name?: string; message?: string };
  if (anyErr.name === 'NotAllowedError' || anyErr.name === 'PermissionDeniedError') return true;
  const message = (anyErr.message ?? '').toLowerCase();
  return message.includes('denied') || message.includes('permission');
};

const getFacingFromLabel = (label: string): 'environment' | 'user' => {
  const lower = label.toLowerCase();
  if (lower.includes('front') || lower.includes('user') || lower.includes('face')) {
    return 'user';
  }
  if (lower.includes('back') || lower.includes('rear') || lower.includes('environment')) {
    return 'environment';
  }
  return 'environment';
};

const pickDeviceForFacing = (
  devices: MediaDeviceInfo[],
  facing: 'environment' | 'user',
  fallbackId?: string | null
): MediaDeviceInfo | null => {
  if (devices.length === 0) return null;
  if (fallbackId) {
    const existing = devices.find((device) => device.deviceId === fallbackId);
    if (existing) return existing;
  }
  const desired = devices.find((device) => getFacingFromLabel(device.label) === facing);
  return desired ?? devices[0];
};

const TicketScanner: React.FC<TicketScannerProps> = ({ eventId: _eventId, onTicketScanned, onClose }) => {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(true);
  const [cameraAccess, setCameraAccess] = useState<CameraAccessState>('notRequested');
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [detectionMode, setDetectionMode] = useState<'native' | 'fallback'>('native');
  const [isScanningTicket, setIsScanningTicket] = useState<boolean>(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [preferredFacing, setPreferredFacing] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const animationRef = useRef<number | null>(null);
  const requestInFlightRef = useRef<boolean>(false);
  const scanningTicketRef = useRef<boolean>(false);
  const lastScannedRef = useRef<string | null>(null);
  const scanningStateRef = useRef<boolean>(scanning);
  const activeDeviceIdRef = useRef<string | null>(null);

  const updateAvailableDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'videoinput'
      );
      setVideoDevices(devices);
      if (devices.length === 0) {
        setSelectedDeviceId(null);
        return;
      }

      const chosen = pickDeviceForFacing(devices, preferredFacing, selectedDeviceId);
      if (chosen && selectedDeviceId !== chosen.deviceId) {
        setSelectedDeviceId(chosen.deviceId);
        setPreferredFacing((prev) => (selectedDeviceId ? prev : getFacingFromLabel(chosen.label)));
      }
    } catch (err) {
      console.warn('Unable to enumerate video devices', err);
    }
  }, [preferredFacing, selectedDeviceId]);

  const switchCamera = useCallback(() => {
    if (videoDevices.length <= 1) return;
    const currentIndex = selectedDeviceId ? videoDevices.findIndex((device) => device.deviceId === selectedDeviceId) : -1;
    const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length];
    setSelectedDeviceId(nextDevice.deviceId);
    setPreferredFacing(getFacingFromLabel(nextDevice.label));
  }, [selectedDeviceId, videoDevices]);

  const setFacingPreference = useCallback(
    (facing: 'environment' | 'user') => {
      setPreferredFacing(facing);
      const chosen = pickDeviceForFacing(videoDevices, facing, null);
      if (chosen) {
        setSelectedDeviceId(chosen.deviceId);
      }
    },
    [videoDevices]
  );

  const buildVideoConstraints = useCallback(
    (overrideDeviceId?: string | null): MediaTrackConstraints => {
      const deviceId = overrideDeviceId ?? selectedDeviceId;
      if (deviceId) {
        return {
          deviceId: { exact: deviceId },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: preferredFacing, // Add facingMode to help mobile devices choose the right camera
        };
      }
      return {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
      };
    },
    [preferredFacing, selectedDeviceId]
  );

  const stopCamera = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
    scanningTicketRef.current = false;
    setIsScanningTicket(false);
    lastScannedRef.current = null;
    activeDeviceIdRef.current = null;
  }, []);

  const handleDecodedValue = useCallback(
    async (ticketId: string | undefined) => {
      if (!ticketId || scanningTicketRef.current) return;
      if (lastScannedRef.current === ticketId) return;
      scanningTicketRef.current = true;
      lastScannedRef.current = ticketId;
      setScanResult(null);
      setError(null);
      setIsScanningTicket(true);

      try {
        const ticket = await scanTicket(ticketId);

        if (ticket) {
          setScanResult(`Ticket ${ticketId} successfully scanned!`);
          onTicketScanned?.(ticketId);
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError('Failed to scan ticket. Please try again.');
          lastScannedRef.current = null;
        }
      } catch (err) {
        console.error('Error scanning ticket:', err);
        setError(`Error scanning ticket: ${(err as Error).message}`);
        lastScannedRef.current = null;
      } finally {
        scanningTicketRef.current = false;
        setIsScanningTicket(false);
      }
    },
    [onClose, onTicketScanned]
  );

  const scanFrame = useCallback(() => {
    if (!scanningStateRef.current) return;
    animationRef.current = requestAnimationFrame(async () => {
      if (!scanningStateRef.current) return;
      if (!detectorRef.current || !videoRef.current) {
        scanFrame();
        return;
      }

      if (videoRef.current.readyState < 2 || videoRef.current.paused) {
        scanFrame();
        return;
      }

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          await handleDecodedValue(barcodes[0].rawValue);
        }
      } catch (err) {
        if (!isTransientScanError(err)) {
          console.warn('QR detect error:', err);
        }
      }

      scanFrame();
    });
  }, [handleDecodedValue]);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      const existingTrack = streamRef.current.getVideoTracks()[0];
      const existingDeviceId = existingTrack?.getSettings().deviceId ?? null;
      if (selectedDeviceId && existingDeviceId === selectedDeviceId && !videoRef.current?.paused) {
        return;
      }
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      if (videoRef.current?.paused) {
        try {
          await videoRef.current.play();
        } catch (err) {
          console.error('Unable to resume camera video playback.', err);
        }
      }
      if (animationRef.current === null && scanningStateRef.current) {
        scanFrame();
      }
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not supported in this browser.');
    }

    // Try multiple constraint configurations to improve mobile compatibility
    const baseConstraints = buildVideoConstraints();
    const constraintOptions = [
      // Most specific constraints first
      { video: baseConstraints, audio: false },
      // Mobile-optimized constraints
      { 
        video: {
          facingMode: baseConstraints.facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false 
      },
      // Flexible constraints for older mobile browsers
      { 
        video: { facingMode: baseConstraints.facingMode }, 
        audio: false 
      },
      // Last resort: completely flexible
      { video: true, audio: false }
    ];

    let stream: MediaStream | null = null;
    let successfulConstraints: MediaStreamConstraints | null = null;

    // Try each constraint option until one works
    for (const constraints of constraintOptions) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        successfulConstraints = constraints;
        break; // If successful, break out of the loop
      } catch (err) {
        console.warn(`Failed to get camera access with constraints:`, constraints, err);
        continue; // Try the next constraint option
      }
    }

    // If no constraints worked, throw an error
    if (!stream) {
      throw new Error('Unable to access camera with any supported constraints. Please check permissions and try a different browser.');
    }

    if (!scanningStateRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    const activeTrack = stream.getVideoTracks()[0];
    const activeId = activeTrack?.getSettings().deviceId ?? selectedDeviceId ?? null;
    activeDeviceIdRef.current = activeId ?? null;

    if (videoRef.current) {
      // Ensure the video element is ready before setting the stream
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.setAttribute('controls', 'false');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.setAttribute('preload', 'metadata');
      
      // Wait for the video element to be ready
      await new Promise<void>((resolve) => {
        videoRef.current!.onloadedmetadata = () => {
          setVideoReady(true);
          resolve();
        };
        videoRef.current!.oncanplay = () => {
          setVideoReady(true);
          resolve();
        };
        videoRef.current!.onplay = () => {
          setVideoReady(true);
          resolve();
        };
        // Set a timeout as fallback
        setTimeout(() => {
          setVideoReady(true);
          resolve();
        }, 1000);
      });

      try {
        // On mobile browsers, sometimes we need to wait a bit before calling play()
        await new Promise(resolve => setTimeout(resolve, 100));
        await videoRef.current.play();
      } catch (err) {
        console.error('Unable to start camera preview.', err);
        setVideoReady(true); // Still set to true as the video might work without autoplay
      }
    }

    await updateAvailableDevices();

    if (scanningStateRef.current) {
      animationRef.current = requestAnimationFrame(scanFrame);
    }
  }, [buildVideoConstraints, scanFrame, selectedDeviceId, updateAvailableDevices]);

  const requestCameraAccess = useCallback(async () => {
    if (requestInFlightRef.current) {
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraAccess('unsupported');
      setError('Camera access is not supported in this browser.');
      return;
    }

    requestInFlightRef.current = true;
    setCameraAccess('requested');
    setError(null);

    try {
      if (detectionMode === 'native') {
        await startCamera();
      } else {
        // Try to get a minimal stream first to check permissions
        const constraints = buildVideoConstraints();
        // For mobile, try to be more flexible with constraints
        const mobileConstraints: MediaStreamConstraints = {
          video: {
            facingMode: constraints.facingMode,
            width: { ideal: 1024, max: 1920 },
            height: { ideal: 768, max: 1080 }
          },
          audio: false,
        };

        const tempStream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
        tempStream.getTracks().forEach((track) => track.stop());
      }
      setCameraAccess('granted');
      await updateAvailableDevices();
    } catch (err) {
      console.error('Camera permission request failed:', err);
      stopCamera();
      if (isPermissionError(err)) {
        setCameraAccess('denied');
        setError('Camera permission denied. Enable access in your browser settings and try again.');
      } else {
        setCameraAccess('denied');
        // Provide more specific error information for mobile
        const errorMessage = (err as Error).message || String(err);
        if (errorMessage.toLowerCase().includes('over') || errorMessage.toLowerCase().includes('secure')) {
          setError('Camera access requires a secure context (HTTPS). Ensure you are accessing the site via HTTPS.');
        } else if (errorMessage.toLowerCase().includes('constraint')) {
          setError('Camera constraints not supported. Try a different browser or mobile device.');
        } else {
          setError('Unable to access the camera. Ensure no other application is using it and try again.');
        }
      }
    } finally {
      requestInFlightRef.current = false;
    }
  }, [buildVideoConstraints, detectionMode, startCamera, stopCamera, updateAvailableDevices]);

  const toggleScanning = () => {
    setScanning((prev) => {
      const next = !prev;
      if (next) {
        requestCameraAccess();
      } else if (detectionMode === 'native') {
        stopCamera();
      }
      if (!next) {
        lastScannedRef.current = null;
      }
      return next;
    });
  };

  const handleQrReaderResult = useCallback(
    (result: any, error: any) => {
      if (error) {
        if (isPermissionError(error)) {
          setCameraAccess('denied');
          setError('Camera permission denied. Enable access in your browser settings and try again.');
          return;
        }
        if (!isTransientScanError(error)) {
          console.warn('QR decode warning:', error);
          setError('Unable to read the QR code. Try steadying the camera and adjusting the lighting.');
        }
        return;
      }

      if (result) {
        setCameraAccess('granted');
        if (videoDevices.length === 0) {
          updateAvailableDevices();
        }
        const text =
          (result.data as string | undefined) ??
          (typeof result.getText === 'function' ? result.getText() : undefined) ??
          (result.text as string | undefined);
        if (text) {
          handleDecodedValue(text);
        }
      }
    },
    [handleDecodedValue, updateAvailableDevices, videoDevices.length]
  );

  useEffect(() => {
    scanningStateRef.current = scanning;
  }, [scanning]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.BarcodeDetector) {
      setDetectionMode('fallback');
      setCameraAccess('granted');
      return;
    }

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      setDetectionMode('native');
    } catch (err) {
      console.error('Failed to initialise BarcodeDetector:', err);
      setDetectionMode('fallback');
      setCameraAccess('granted');
    }
  }, []);

  useEffect(() => {
    if (!navigator?.mediaDevices?.addEventListener) {
      return;
    }
    const handleDeviceChange = () => {
      updateAvailableDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [updateAvailableDevices]);

  useEffect(() => {
    if (detectionMode !== 'native') {
      stopCamera();
      return;
    }

    requestCameraAccess();
    return () => {
      stopCamera();
    };
  }, [detectionMode, requestCameraAccess, stopCamera]);

  useEffect(() => {
    if (detectionMode === 'fallback') {
      requestCameraAccess();
    }
  }, [detectionMode, requestCameraAccess]);

  useEffect(() => {
    if (detectionMode !== 'native') return;
    if (!scanning) return;
    if (!selectedDeviceId) return;
    if (activeDeviceIdRef.current === selectedDeviceId) return;

    const restart = async () => {
      stopCamera();
      await requestCameraAccess();
    };
    restart();
  }, [detectionMode, requestCameraAccess, scanning, selectedDeviceId, stopCamera]);

  const scanInstructions = scanning
    ? 'Point your camera at the QR code on the ticket to scan it'
    : 'Scanning paused. Click resume to continue';

  const currentDevice = selectedDeviceId ? videoDevices.find((device) => device.deviceId === selectedDeviceId) ?? null : null;
  const hasFrontCamera = videoDevices.some((device) => getFacingFromLabel(device.label) === 'user');
  const hasBackCamera = videoDevices.some((device) => getFacingFromLabel(device.label) === 'environment');

  useCanvasWillReadFrequently('qr-reader-video');

  const renderNativeScanner = () => (
    <>
      {cameraAccess === 'granted' && scanning ? (
        <>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
            autoPlay
            style={{ opacity: videoReady ? 1 : 0, transition: 'opacity 200ms ease-in-out' }}
          />
          {!videoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-400 mb-3"></div>
                <p>Initializing camera feed...</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center p-4">
            <p className="mb-3">
              {cameraAccess === 'unsupported'
                ? 'Camera access is not supported in this browser.'
                : cameraAccess === 'denied'
                ? 'Camera access has been denied. Please enable it in your browser settings and try again.'
                : scanning
                ? 'Waiting for camera permissions...'
                : 'Scanning is paused. Click resume to continue.'}
            </p>
            <p className="text-sm mb-4">Please allow camera permissions when prompted.</p>

            <div className="relative w-64 h-64 mx-auto border-2 border-dashed border-gray-500 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="mb-2 mx-auto">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400">Camera feed will appear here</p>
              </div>
            </div>

            <button
              type="button"
              onClick={requestCameraAccess}
              className="mt-4 inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg"
            >
              Retry Camera Access
            </button>
          </div>
        </div>
      )}
    </>
  );

  const renderFallbackScanner = () => (
    <>
      {scanning ? (
        <QrReader
          key={`${selectedDeviceId ?? preferredFacing}-${scanning ? 'on' : 'off'}`}
          constraints={buildVideoConstraints()}
          videoId="qr-reader-video"
          onResult={handleQrReaderResult}
          scanDelay={150}
          containerStyle={{ width: '100%', height: '100%' }}
          videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
          ViewFinder={() => null}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center p-4">
            <p className="mb-3">Scanning is paused. Click resume to continue.</p>
            <p className="text-sm mb-4">Hold steady and ensure the full QR code is visible when you resume.</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Ticket Scanner</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 bg-gray-50 flex-grow overflow-y-auto max-h-[80vh]">
          <div className="text-center mb-4">
            <p className="text-gray-700">{scanInstructions}</p>
          </div>

          {videoDevices.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              {hasBackCamera && (
                <button
                  type="button"
                  onClick={() => setFacingPreference('environment')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    preferredFacing === 'environment'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Use Back Camera
                </button>
              )}
              {hasFrontCamera && (
                <button
                  type="button"
                  onClick={() => setFacingPreference('user')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    preferredFacing === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Use Front Camera
                </button>
              )}
              {videoDevices.length > 1 && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
                >
                  Switch Camera
                </button>
              )}
              {currentDevice && (
                <span className="text-xs text-gray-500 w-full text-center">
                  Active camera: {currentDevice.label || 'Unnamed device'}
                </span>
              )}
            </div>
          )}

          <div
            className="relative bg-black rounded-lg overflow-hidden mb-4"
            style={{ width: '100%', height: '70vh', maxHeight: '500px', minHeight: '300px' }}
          >
            {detectionMode === 'native' ? renderNativeScanner() : renderFallbackScanner()}

            {isScanningTicket && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                  <p>Scanning ticket...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-4">
            <button
              onClick={toggleScanning}
              className={`px-4 py-2 rounded-lg font-medium ${
                scanning ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {scanning ? 'Pause Scanning' : 'Resume Scanning'}
            </button>

            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-gray-800"
            >
              Close Scanner
            </button>
          </div>

          {scanResult && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg">
              {scanResult}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketScanner;

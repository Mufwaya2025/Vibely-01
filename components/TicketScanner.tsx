import React, { useRef, useState, useEffect } from 'react';
import QrScanner from 'qr-scanner';

export default function TicketScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState('Ready to start camera');
  const [scanner, setScanner] = useState<QrScanner | null>(null);

  const startCamera = async () => {
    try {
      setMessage('Requesting camera permission…');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, // rear camera
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const newScanner = new QrScanner(
        videoRef.current!,
        result => {
          setMessage(`✅ QR Code: ${result.data}`);
          console.log('QR Result:', result.data);
        },
        { returnDetailedScanResult: true }
      );

      await newScanner.start();
      setScanner(newScanner);
      setMessage('Scanning…');
    } catch (err: any) {
      console.error('Camera error:', err);
      setMessage(`❌ ${err.name}: ${err.message}`);
    }
  };

  const stopCamera = () => {
    if (scanner) {
      scanner.stop();
      setMessage('Camera stopped');
    }
  };

  useEffect(() => {
    return () => {
      if (scanner) scanner.stop();
    };
  }, [scanner]);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h2 className="text-lg font-semibold mb-3">🎥 Ticket Scanner</h2>
      <div className="flex gap-3 mb-3">
        <button
          onClick={startCamera}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Start Scan
        </button>
        <button
          onClick={stopCamera}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg"
        >
          Stop
        </button>
      </div>
      <p className="text-sm mb-2">{message}</p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full max-w-md rounded-xl border"
      />
    </div>
  );
}

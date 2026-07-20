import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface SmartQRScannerProps {
  onScanSuccess: (token: string, entityData: any) => void;
  onScanError?: (error: string) => void;
  title?: string;
}

const SmartQRScanner: React.FC<SmartQRScannerProps> = ({ onScanSuccess, onScanError, title }) => {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] },
      /* verbose= */ false
    );
    scannerRef.current = scanner;

    const onScan = async (decodedText: string) => {
      // Pause scanner while validating
      scanner.pause();
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/qr/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: decodedText }),
        });

        if (!response.ok) {
          throw new Error('Invalid QR Code');
        }

        const data = await response.json();
        onScanSuccess(decodedText, data);
        
        // Only clear if successful and parent handles it, or wait for unmount
        // scanner.clear(); 
      } catch (err: any) {
        setError(err.message || t('invalidQR'));
        if (onScanError) onScanError(err.message || 'Invalid QR');
        // Resume on error so they can try again
        setTimeout(() => {
          scanner.resume();
          setLoading(false);
        }, 2000);
      }
    };

    scanner.render(onScan, (_errorMessage) => {
      // Ignore routine scan errors (not finding a QR)
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [onScanSuccess, onScanError, t]);

  return (
    <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        {title || t('scanQR')}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ position: 'relative' }}>
        <div id="qr-reader" style={{ width: '100%' }}></div>
        {loading && (
          <Box 
            sx={{ 
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 10 
            }}
          >
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SmartQRScanner;

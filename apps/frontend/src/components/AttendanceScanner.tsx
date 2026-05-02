import { useEffect, useRef, useState } from 'react';
import {
  Html5QrcodeScanner,
  Html5QrcodeSupportedFormats,
  Html5QrcodeScanType,
} from 'html5-qrcode';
import { attendanceApi } from '../services/attendance';

interface AttendanceScannerProps {
  token: string;
}

export function AttendanceScanner({ token }: AttendanceScannerProps) {
  const scannerContainerIdRef = useRef(`attendance-scanner-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const lastDecodedTokenRef = useRef('');
  const [cameraError, setCameraError] = useState('');
  const [cameraMessage, setCameraMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const submitToken = async (qrToken: string) => {
    if (!qrToken || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setCameraError('');
    setCameraMessage('Memproses QR...');

    try {
      const result = await attendanceApi.scanQrCode(token, qrToken);
      const employeeName = result.employee?.full_name || 'karyawan';
      const lateMinutes = Number(result.attendance?.late_minutes || 0);

      const msg = lateMinutes > 0
        ? `Absensi ${employeeName} dicatat (terlambat ${lateMinutes} menit)`
        : `Absensi ${employeeName} dicatat`;

      setSuccessMessage(msg);
      setShowSuccess(true);
      setCameraMessage('');

      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = window.setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
        successTimerRef.current = null;
      }, 3000);

      try {
        await scannerRef.current?.clear();
      } catch {
        // ignore clear errors after success
      }
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'QR gagal diproses');
      setCameraMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const containerId = scannerContainerIdRef.current;

    const renderScanner = async () => {
      try {
        setCameraError('');
        setCameraMessage('Menyalakan kamera...');

        const scanner = new Html5QrcodeScanner(
          containerId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            disableFlip: false,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          },
          false,
        );

        scannerRef.current = scanner;

        scanner.render(
          async (decodedText) => {
            if (!mounted) {
              return;
            }

            const raw = String(decodedText || '').trim();
            if (!raw || raw === lastDecodedTokenRef.current || isSubmitting) {
              return;
            }

            lastDecodedTokenRef.current = raw;
            await submitToken(raw);
          },
          (errorMessage) => {
            if (!mounted) {
              return;
            }

            const message = String(errorMessage || '').trim();
            if (message) {
              setCameraMessage('Arahkan kamera ke QR absensi admin.');
            }
          },
        );
      } catch (error) {
        if (!mounted) return;
        setCameraMessage('');
        setCameraError(
          error instanceof Error
            ? error.message
            : 'Kamera tidak bisa diaktifkan.',
        );
      }
    };

    void renderScanner();

    return () => {
      mounted = false;
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        void scanner.clear().catch(() => {
          // ignore cleanup errors
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="scanner-card">
      {cameraError && <div className="alert-error">{cameraError}</div>}
      {cameraMessage && <div className="alert-info">{cameraMessage}</div>}

      {showSuccess && (
        <div className="toast toast-success" role="status">
          {successMessage}
        </div>
      )}

      <div className="scanner-preview-wrap">
        <div id={scannerContainerIdRef.current} className="scanner-preview scanner-live-region" />
        <div className="scanner-frame" aria-hidden="true" />
      </div>

      <div className="scanner-hint">
        <p className="subtext">Arahkan QR ke dalam frame untuk scan otomatis.</p>
      </div>

      <div className="scanner-actions">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => window.location.reload()}
          disabled={isSubmitting}
        >
          Mulai Ulang
        </button>
      </div>
    </div>
  );
}

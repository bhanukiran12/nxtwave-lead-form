import { useEffect, useRef, useState } from 'react';
import {
  MSG91_CAPTCHA_RENDER_ID,
  MSG91_SCRIPT_SRC,
  MSG91_TOKEN_AUTH,
  MSG91_WIDGET_ID,
  OTP_SECONDS
} from '../constants/formConstants';

const toMsg91Identifier = (mobile) => {
  const clean = String(mobile || '').replace(/\D/g, '');
  return clean ? `91${clean}` : '';
};

const extractReqId = (data) => (
  data?.reqId || data?.req_id || data?.requestId || data?.request_id || data?.data?.reqId || ''
);

export default function useOtp({ mobile, onOtpAction, onVerified }) {
  console.log('[useOtp] Hook initialized with mobile:', mobile);
  
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState(false);
  const [otpStatus, setOtpStatus] = useState({ message: '', type: 'info' });
  const [resendSeconds, setResendSeconds] = useState(OTP_SECONDS);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpProviderReady, setOtpProviderReady] = useState(false);

  const otpRefs = useRef([]);
  const otpTimerRef = useRef(null);
  const otpVerifyInFlightRef = useRef(false);
  const otpVerifiedRef = useRef(false);
  const reqIdRef = useRef('');

  const clearOtpStatus = () => setOtpStatus({ message: '', type: 'info' });
  const setOtpStatusMessage = (message, type = 'info') => setOtpStatus({ message, type });

  const stopOtpTimer = () => {
    if (otpTimerRef.current) {
      clearInterval(otpTimerRef.current);
      otpTimerRef.current = null;
    }
  };

  const startOtpTimer = () => {
    stopOtpTimer();
    setResendSeconds(OTP_SECONDS);
    otpTimerRef.current = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          stopOtpTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const setOtpRef = (el, idx) => {
    otpRefs.current[idx] = el;
  };

  const focusFirstOtp = () => {
    setTimeout(() => otpRefs.current[0]?.focus(), 30);
  };

  const sendOtpToMobile = async (isResend = false) => {
    const identifier = toMsg91Identifier(mobile);
    console.log('[OTP] Sending to identifier:', identifier, 'isResend:', isResend);
    if (!identifier) {
      console.log('[OTP] No identifier provided');
      setOtpStatusMessage('Please enter a valid mobile number.', 'error');
      return false;
    }
    
    // Check if sendOtp function exists
    if (typeof window.sendOtp !== 'function') {
      console.log('[OTP] sendOtp function not found');
      setOtpStatusMessage('OTP provider is not ready. Please refresh and try again.', 'error');
      return false;
    }

    setVerifyLoading(true);
    setOtpStatusMessage(isResend ? 'Resending OTP...' : 'Sending OTP...', 'info');
    onOtpAction?.('send', { isResend });

    try {
      console.log('[OTP] Calling window.sendOtp...');
      const result = await new Promise((resolve) => {
        // Wrap in try-catch to catch any internal errors in MSG91 library
        try {
          window.sendOtp(
            identifier,
            (data) => {
              console.log('[OTP] sendOtp success:', data);
              resolve({ ok: true, data });
            },
            (error) => {
              console.log('[OTP] sendOtp error:', error);
              resolve({ ok: false, error });
            }
          );
        } catch (err) {
          console.error('[OTP] Exception in sendOtp:', err);
          resolve({ ok: false, error: err });
        }
      });

      if (!result.ok) {
        setOtpStatusMessage('Failed to send OTP. Please try again.', 'error');
        onOtpAction?.('send_failed', { error: result.error?.message || 'send_otp_failed' });
        setVerifyLoading(false);
        return false;
      }

      reqIdRef.current = extractReqId(result.data);
      otpVerifiedRef.current = false;
      setOtpStatusMessage('OTP sent. Enter the 6-digit code.', 'success');
      onOtpAction?.('sent_success');
      setVerifyLoading(false);
      return true;
    } catch (err) {
      console.error('[OTP] Error sending OTP:', err);
      setOtpStatusMessage('Error sending OTP. Please try again.', 'error');
      setVerifyLoading(false);
      return false;
    }
  };

  const verifyOtp = async (otpOverride = '') => {
    if (otpVerifiedRef.current || otpVerifyInFlightRef.current) return false;

    const otp = otpOverride || otpDigits.join('');
    if (otp.length < 6) {
      setOtpError(true);
      clearOtpStatus();
      return false;
    }

    if (typeof window.verifyOtp !== 'function') {
      setOtpStatusMessage('OTP provider is not ready. Please refresh and try again.', 'error');
      return false;
    }

    setOtpError(false);
    clearOtpStatus();
    otpVerifyInFlightRef.current = true;
    setVerifyLoading(true);

    const result = await new Promise((resolve) => {
      window.verifyOtp(
        otp,
        (data) => resolve({ ok: true, data }),
        (error) => resolve({ ok: false, error }),
        reqIdRef.current || undefined
      );
    });

    otpVerifyInFlightRef.current = false;
    setVerifyLoading(false);

    if (!result.ok) {
      setOtpError(true);
      onOtpAction?.('attempt', { success: false, error: result.error?.message || 'verify_otp_failed' });
      return false;
    }

    otpVerifiedRef.current = true;
    setOtpStatusMessage('Mobile number verified successfully.', 'success');
    onOtpAction?.('verified_success');
    stopOtpTimer();
    await onVerified?.();
    return true;
  };

  const initializeOtpFlow = async () => {
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError(false);
    clearOtpStatus();
    startOtpTimer();
    
    // Wait for OTP provider to be ready before sending OTP
    let attempts = 0;
    const waitForProvider = () => {
      return new Promise((resolve) => {
        const check = () => {
          attempts++;
          if (typeof window.sendOtp === 'function' || attempts >= 20) {
            resolve(typeof window.sendOtp === 'function');
          } else {
            setTimeout(check, 250);
          }
        };
        check();
      });
    };
    
    const isReady = await waitForProvider();
    if (!isReady) {
      setOtpStatusMessage('OTP provider is not ready. Please refresh and try again.', 'error');
      setVerifyLoading(false);
      return;
    }
    
    await sendOtpToMobile(false);
    focusFirstOtp();
  };

  const resendOtp = async () => {
    if (resendSeconds > 0) return;
    if (typeof window.retryOtp !== 'function') {
      setOtpStatusMessage('Unable to resend OTP right now. Please refresh and try again.', 'error');
      return;
    }

    setOtpDigits(['', '', '', '', '', '']);
    setOtpError(false);
    clearOtpStatus();
    startOtpTimer();
    setVerifyLoading(true);
    setOtpStatusMessage('Resending OTP...', 'info');
    onOtpAction?.('send', { isResend: true });

    try {
      const result = await new Promise((resolve) => {
        // For SMS channel, use '11' as per MSG91 documentation
        // When using exposeMethods, channel is mandatory
        const channel = '11'; // SMS channel
        window.retryOtp(
          channel,
          (data) => resolve({ ok: true, data }),
          (error) => resolve({ ok: false, error }),
          reqIdRef.current || undefined
        );
      });

      setVerifyLoading(false);

      if (!result.ok) {
        setOtpStatusMessage('Failed to resend OTP. Please try again.', 'error');
        onOtpAction?.('send_failed', { error: result.error?.message || 'retry_otp_failed' });
        return;
      }

      reqIdRef.current = extractReqId(result.data) || reqIdRef.current;
      setOtpStatusMessage('OTP resent. Enter the 6-digit code.', 'success');
      onOtpAction?.('sent_success');
      focusFirstOtp();
    } catch (err) {
      console.error('[OTP] Error resending OTP:', err);
      setVerifyLoading(false);
      setOtpStatusMessage('Failed to resend OTP. Please try again.', 'error');
    }
  };

  const handleOtpInput = (idx, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = clean;
    setOtpDigits(next);
    setOtpError(false);
    clearOtpStatus();

    if (clean && idx < 5) otpRefs.current[idx + 1]?.focus();
    const nextOtp = next.join('');
    if (nextOtp.length === 6) setTimeout(() => verifyOtp(nextOtp), 0);
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const p = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;

    const next = ['', '', '', '', '', ''];
    p.split('').forEach((ch, i) => {
      next[i] = ch;
    });

    setOtpDigits(next);
    otpRefs.current[Math.min(p.length, 5)]?.focus();
    if (p.length >= 6) setTimeout(() => verifyOtp(next.join('')), 0);
  };

  useEffect(() => {
    let mounted = true;

    const initializeMsg91 = () => {
      console.log('[OTP] Initializing MSG91...');
      if (typeof window.initSendOTP !== 'function') {
        console.log('[OTP] initSendOTP not found');
        if (mounted) setOtpProviderReady(false);
        return;
      }

      const configuration = {
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        identifier: '',
        exposeMethods: true,
        captchaRenderId: MSG91_CAPTCHA_RENDER_ID,
        success: (data) => console.log('[OTP] MSG91 success:', data),
        failure: (error) => console.log('[OTP] MSG91 failure:', error)
      };

      try {
        window.initSendOTP(configuration);
        console.log('[OTP] MSG91 initialized successfully');
        if (mounted) setOtpProviderReady(true);
      } catch (err) {
        console.log('[OTP] MSG91 initialization error:', err);
        if (mounted) setOtpProviderReady(false);
      }
    };

    const existingScript = document.querySelector(`script[src="${MSG91_SCRIPT_SRC}"]`);
    if (existingScript) {
      if (typeof window.initSendOTP === 'function') {
        initializeMsg91();
      } else {
        existingScript.addEventListener('load', initializeMsg91, { once: true });
      }
    } else {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = MSG91_SCRIPT_SRC;
      script.async = true;
      script.onload = initializeMsg91;
      script.onerror = () => {
        if (mounted) setOtpProviderReady(false);
      };
      document.body.appendChild(script);
    }

    return () => {
      mounted = false;
      stopOtpTimer();
    };
  }, []);

  return {
    otpDigits,
    otpError,
    otpStatus,
    resendSeconds,
    verifyLoading,
    otpProviderReady,
    setOtpRef,
    handleOtpInput,
    handleOtpKeyDown,
    handleOtpPaste,
    resendOtp,
    verifyOtp,
    initializeOtpFlow,
    stopOtpTimer
  };
}

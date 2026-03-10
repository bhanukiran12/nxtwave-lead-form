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

let msg91ScriptPromise = null;
let msg91Initialized = false;

function waitFor(check, attempts = 20, delayMs = 250) {
  return new Promise((resolve) => {
    let count = 0;

    const poll = () => {
      if (check()) {
        resolve(true);
        return;
      }

      count += 1;
      if (count >= attempts) {
        resolve(false);
        return;
      }

      window.setTimeout(poll, delayMs);
    };

    poll();
  });
}

function loadMsg91Script() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (typeof window.initSendOTP === 'function') return Promise.resolve(true);
  if (msg91ScriptPromise) return msg91ScriptPromise;

  msg91ScriptPromise = new Promise((resolve) => {
    const existingScript = document.querySelector(`script[src="${MSG91_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = MSG91_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return msg91ScriptPromise;
}

export default function useOtp({ mobile, onOtpAction, onVerified }) {
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

  const ensureOtpProviderReady = async () => {
    const scriptReady = await loadMsg91Script();
    if (!scriptReady) {
      setOtpProviderReady(false);
      return false;
    }

    const initReady = await waitFor(() => typeof window.initSendOTP === 'function');
    if (!initReady || typeof window.initSendOTP !== 'function') {
      setOtpProviderReady(false);
      return false;
    }

    if (msg91Initialized && typeof window.sendOtp === 'function') {
      setOtpProviderReady(true);
      return true;
    }

    const captchaContainer = document.getElementById(MSG91_CAPTCHA_RENDER_ID);
    if (!captchaContainer) {
      setOtpProviderReady(false);
      return false;
    }

    const configuration = {
      widgetId: MSG91_WIDGET_ID,
      tokenAuth: MSG91_TOKEN_AUTH,
      identifier: toMsg91Identifier(mobile),
      exposeMethods: true,
      captchaRenderId: MSG91_CAPTCHA_RENDER_ID,
      success: () => {},
      failure: () => {}
    };

    try {
      window.initSendOTP(configuration);
      const methodsReady = await waitFor(
        () => typeof window.sendOtp === 'function' && typeof window.verifyOtp === 'function'
      );

      if (!methodsReady) {
        setOtpProviderReady(false);
        return false;
      }

      msg91Initialized = true;
      setOtpProviderReady(true);
      return true;
    } catch {
      setOtpProviderReady(false);
      return false;
    }
  };

  const sendOtpToMobile = async (isResend = false) => {
    const identifier = toMsg91Identifier(mobile);
    if (!identifier) {
      setOtpStatusMessage('Please enter a valid mobile number.', 'error');
      return false;
    }

    if (typeof window.sendOtp !== 'function') {
      setOtpStatusMessage('OTP provider is not ready. Please refresh and try again.', 'error');
      return false;
    }

    setVerifyLoading(true);
    setOtpStatusMessage(isResend ? 'Resending OTP...' : 'Sending OTP...', 'info');
    onOtpAction?.('send', { isResend });

    try {
      const result = await new Promise((resolve) => {
        try {
          window.sendOtp(
            identifier,
            (data) => resolve({ ok: true, data }),
            (error) => resolve({ ok: false, error })
          );
        } catch (err) {
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

    const isReady = await ensureOtpProviderReady();
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
    } catch {
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

  useEffect(() => () => {
    stopOtpTimer();
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

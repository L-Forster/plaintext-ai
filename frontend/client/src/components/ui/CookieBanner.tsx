import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

// Simple cookie banner to request consent for cookies
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = document.cookie.split('; ').find(row => row.startsWith('cookie_consent='));
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const acceptCookies = () => {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `cookie_consent=true; expires=${expires.toUTCString()}; path=/`;
    setVisible(false);
  };

  const rejectCookies = () => {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `cookie_consent=false; expires=${expires.toUTCString()}; path=/`;
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-theme-card border-t border-theme-border p-4 flex flex-col md:flex-row md:items-center md:justify-between z-50">
      <p className="text-sm text-theme-foreground mb-2 md:mb-0">
        We use cookies to improve your experience. You may accept or reject non-essential cookies.
        Read our <a href="/privacy" className="underline text-primary">Privacy Policy</a> for more details.
      </p>
      <div className="flex space-x-2">
        <Button variant="outline" onClick={acceptCookies}>
          Accept
        </Button>
        <Button variant="ghost" onClick={rejectCookies}>
          Reject
        </Button>
      </div>
    </div>
  );
} 
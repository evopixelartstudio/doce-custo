'use client';

import { useEffect } from 'react';

export function DevOverlayKiller() {
  useEffect(() => {
    function removeBadges() {
      const targets = document.querySelectorAll(
        'nextjs-portal, [data-nextjs-dev-tools-button], [data-nextjs-dev-tools], [data-nextjs-toast]'
      );
      targets.forEach((el) => {
        try {
          el.remove();
        } catch {
          // Ignore
        }
      });
    }

    removeBadges();
    const observer = new MutationObserver(removeBadges);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}


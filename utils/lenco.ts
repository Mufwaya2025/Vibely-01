declare global {
  interface Window {
    LencoPay?: {
      getPaid: (config: Record<string, unknown>) => void;
    };
  }
}

export {};

let widgetPromise: Promise<void> | null = null;

export const ensureLencoWidget = async (widgetUrl: string): Promise<void> => {
  if (typeof window === 'undefined') {
    throw new Error('Lenco widget can only be loaded in a browser environment.');
  }
  if (window.LencoPay) {
    return;
  }
  if (widgetPromise) {
    return widgetPromise;
  }

  widgetPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = widgetUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Lenco widget.'));
    document.body.appendChild(script);
  });

  return widgetPromise;
};

export const getLenco = () => {
  if (typeof window === 'undefined' || !window.LencoPay) {
    throw new Error('Lenco widget is not loaded.');
  }
  return window.LencoPay;
};

export const resetLencoWidget = () => {
  widgetPromise = null;
};

export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        expand?: () => void;
        ready?: () => void;
        showAlert?: (message: string) => void;
        sendData?: (data: string) => void;
      };
    };
  }
}

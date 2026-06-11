import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-semibold px-4 py-2.5 shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>No internet connection — some features may not work</span>
    </div>
  );
}

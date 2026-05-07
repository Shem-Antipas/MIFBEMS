import { useState } from "react";
import type { ReactNode } from "react";

interface AuthScreenProps {
  children: ReactNode;
  maxWidthClassName?: string;
}

const LOGIN_BACKGROUND = "/images/blue-economy/login-background.jpg.jpeg";
const FALLBACK_LOGIN_BACKGROUND = "/images/blue-economy/lake-victoria-fishing-login.jpg";

const AuthScreen = ({ children, maxWidthClassName = "max-w-md" }: AuthScreenProps) => {
  const [backgroundSrc, setBackgroundSrc] = useState(LOGIN_BACKGROUND);

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 p-4">
      <img
        src={backgroundSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setBackgroundSrc(FALLBACK_LOGIN_BACKGROUND)}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-slate-950/20" />
      <div
        className={`relative z-10 w-full ${maxWidthClassName} rounded-2xl border bg-card/95 p-6 shadow-2xl backdrop-blur-md`}
      >
        {children}
      </div>
    </div>
  );
};

export default AuthScreen;

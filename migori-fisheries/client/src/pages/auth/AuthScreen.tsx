import type { ReactNode } from "react";

interface AuthScreenProps {
  children: ReactNode;
  maxWidthClassName?: string;
}

const AuthScreen = ({ children, maxWidthClassName = "max-w-md" }: AuthScreenProps) => {
  return (
    <div
      className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 p-4"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(2, 44, 34, 0.82), rgba(10, 38, 58, 0.44)), url('/images/blue-economy/lake-victoria-fishing-login.jpg')",
        backgroundPosition: "center",
        backgroundSize: "cover"
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(20,184,166,0.24),transparent_34%)]" />
      <div
        className={`relative z-10 w-full ${maxWidthClassName} rounded-2xl border bg-card/95 p-6 shadow-2xl backdrop-blur-md`}
      >
        {children}
      </div>
    </div>
  );
};

export default AuthScreen;

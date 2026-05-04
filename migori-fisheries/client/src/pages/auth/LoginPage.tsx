import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import AuthScreen from "@/pages/auth/AuthScreen";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

type LoginValues = z.infer<typeof loginSchema>;

const getLandingRoute = (role: string): string => {
  if (role === "FARMER") return "/farmer/my-farm";
  if (role === "ADMIN") return "/admin/backups";
  return "/dashboard";
};

const demoAccounts = [
  "director@mifbems.go.ke",
  "officer@mifbems.go.ke",
  "analyst@mifbems.go.ke",
  "farmer@mifbems.go.ke",
  "admin@mifbems.go.ke"
];

const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "director@mifbems.go.ke",
      password: "Password123!"
    }
  });

  const helpers = useMemo(
    () => demoAccounts.map((email) => ({ email, password: "Password123!" })),
    []
  );

  const onSubmit = async (values: LoginValues) => {
    try {
      await login(values);
      const role = useAuthStore.getState().user?.role;
      if (role) {
        navigate(getLandingRoute(role), { replace: true });
      }
      toast.success("Welcome to MiFBeDAS");
    } catch (error) {
      const message = axios.isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? "Login failed")
        : error instanceof Error
          ? error.message
          : "Login failed";
      toast.error(message);
    }
  };

  return (
    <AuthScreen>
      <div className="flex items-center gap-3">
        <img src="/migori-county-logo.png" alt="Migori County Government" className="h-14 w-14 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Migori County</p>
          <h1 className="mt-1 text-2xl font-bold">MiFBeDAS Login</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Migori Fisheries and Blue Economy Data & Analytics System
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <Input {...register("email")} placeholder="you@example.com" />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium">Password</label>
            <Link className="text-xs font-medium text-primary hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <Input {...register("password")} type="password" placeholder="********" />
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="mt-5 border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground">Quick demo accounts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {helpers.map((item) => (
            <button
              key={item.email}
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-secondary"
              onClick={() => {
                setValue("email", item.email);
                setValue("password", item.password);
              }}
            >
              {item.email}
            </button>
          ))}
        </div>
      </div>
    </AuthScreen>
  );
};

export default LoginPage;

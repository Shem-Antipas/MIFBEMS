import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import AuthScreen from "@/pages/auth/AuthScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const getErrorMessage = (error: unknown, fallback: string): string => {
  return axios.isAxiosError<{ error?: string }>(error)
    ? (error.response?.data?.error ?? fallback)
    : error instanceof Error
      ? error.message
      : fallback;
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema)
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    if (!token) {
      toast.error("Password reset link is missing a token");
      return;
    }

    try {
      const response = await authApi.resetPassword({ token, password: values.password });
      toast.success(response.message);
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to reset password"));
    }
  };

  return (
    <AuthScreen>
      <div className="flex items-center gap-3">
        <img src="/migori-county-logo.png" alt="Migori County Government" className="h-14 w-14 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">MiFBeDAS</p>
          <h1 className="mt-1 text-2xl font-bold">Reset Password</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Create a new password for your account.</p>

      {!token ? (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          This reset link is missing a valid token. Request a new password reset link.
        </div>
      ) : null}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium">New Password</label>
          <Input {...register("password")} type="password" placeholder="********" autoComplete="new-password" />
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Confirm Password</label>
          <Input {...register("confirmPassword")} type="password" placeholder="********" autoComplete="new-password" />
          {errors.confirmPassword ? (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link className="font-medium text-primary hover:underline" to="/forgot-password">
          Request new link
        </Link>
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to login
        </Link>
      </div>
    </AuthScreen>
  );
};

export default ResetPasswordPage;

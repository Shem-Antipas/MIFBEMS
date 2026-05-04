import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import AuthScreen from "@/pages/auth/AuthScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email")
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const getErrorMessage = (error: unknown, fallback: string): string => {
  return axios.isAxiosError<{ error?: string }>(error)
    ? (error.response?.data?.error ?? fallback)
    : error instanceof Error
      ? error.message
      : fallback;
};

const ForgotPasswordPage = () => {
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    try {
      const response = await authApi.forgotPassword(values);
      setSubmittedMessage(response.message);
      setResetUrl(response.resetUrl ?? null);
      toast.success("Password reset request submitted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to request password reset"));
    }
  };

  return (
    <AuthScreen>
      <div className="flex items-center gap-3">
        <img src="/migori-county-logo.png" alt="Migori County Government" className="h-14 w-14 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">MiFBeDAS</p>
          <h1 className="mt-1 text-2xl font-bold">Forgot Password</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Enter your account email and we will prepare a secure reset link.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <Input {...register("email")} type="email" placeholder="you@example.com" />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>

      {submittedMessage ? (
        <div className="mt-4 rounded-lg border bg-secondary/70 p-3 text-sm text-secondary-foreground">
          <p>{submittedMessage}</p>
          {resetUrl ? (
            <a className="mt-2 inline-flex font-medium text-primary hover:underline" href={resetUrl}>
              Open development reset link
            </a>
          ) : null}
        </div>
      ) : null}

      <Link className="mt-5 inline-flex text-sm font-medium text-primary hover:underline" to="/login">
        Back to login
      </Link>
    </AuthScreen>
  );
};

export default ForgotPasswordPage;

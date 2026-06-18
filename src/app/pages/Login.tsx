import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAppContext } from "../context/AppContext";

type AuthMode = "sign-in" | "forgot" | "reset";

export function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    login,
    requestPasswordReset,
    resetPassword,
    passwordResetRequests,
  } = useAppContext();

  const resetToken = searchParams.get("resetToken") || "";
  const initialMode: AuthMode = resetToken ? "reset" : "sign-in";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [resetContact, setResetContact] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetRequest = useMemo(
    () => passwordResetRequests.find(request => request.token === resetToken && !request.used),
    [passwordResetRequests, resetToken]
  );

  const resetFeedback = () => {
    setError("");
    setNotice("");
  };

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setIsLoading(true);

    window.setTimeout(async () => {
      const user = await login(email, password);
      if (user) {
        navigate("/app");
      } else {
        setError("Invalid or inactive credentials.");
        setIsLoading(false);
      }
    }, 400);
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setIsLoading(true);

    const request = await requestPasswordReset(resetContact);
    setIsLoading(false);
    if (!request) {
      setError("No active user was found for that email address.");
      return;
    }

    if (request.deliveryStatus === "Sent") {
      setNotice("Password reset instructions were sent from info@luxurytentedcamp.com.");
    } else {
      setError("The reset request was created, but the email could not be sent. Check Zoho SMTP environment variables and try again.");
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!resetRequest) {
      setError("This reset link is invalid or has already been used.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setIsLoading(true);
    const changed = await resetPassword(resetToken, newPassword);
    setIsLoading(false);
    if (!changed.ok) {
      setError(changed.error || "The password could not be changed. Generate a new reset link.");
      return;
    }

    setNotice("Password changed successfully. You can now sign in with the new password.");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSearchParams({});
    setMode("sign-in");
  };

  const goToSignIn = () => {
    resetFeedback();
    setSearchParams({});
    setMode("sign-in");
  };

  return (
    <div className="min-h-screen w-full bg-[#2d2924] px-4 py-8 text-[#f7ead8]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center">
        <div className="mb-6 flex justify-center">
          <img
            src="/assets/brand/kumbukumbu-logo.png"
            alt="Kumbukumbu Luxury Tented Camp"
            className="h-28 w-28 object-contain sm:h-32 sm:w-32"
          />
        </div>

        <div className="w-full max-w-md rounded-lg border border-[#f4c27d]/35 bg-[#181512]/95 p-6 shadow-2xl md:p-8">
          <div className="mb-6 text-center">
            <p className="text-sm font-medium uppercase text-[#f4c27d]">Hospitality Management System</p>
            <h1 className="mt-2 text-5xl font-semibold text-white">KumbuOS</h1>
            {mode !== "sign-in" && (
              <h2 className="mt-8 text-2xl font-semibold text-white">
                {mode === "forgot" && "Recover Access"}
                {mode === "reset" && "Set New Password"}
              </h2>
            )}
          </div>

          {(error || notice) && (
            <div className={`mb-5 rounded-md border p-3 text-sm ${
              error
                ? "border-red-400/30 bg-red-950/40 text-red-100"
                : "border-[#f4c27d]/30 bg-[#c98736]/15 text-[#f7ead8]"
            }`}>
              {error || notice}
            </div>
          )}

          {mode === "sign-in" && (
            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#f7ead8]" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="h-11 border-[#f4c27d]/25 bg-[#2d2924] text-white placeholder:text-[#b8aa96]"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#f7ead8]" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className="h-11 border-[#f4c27d]/25 bg-[#2d2924] pr-11 text-white placeholder:text-[#b8aa96]"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#f4c27d] hover:text-white"
                    onClick={() => setShowPassword(current => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-[#f7ead8]">
                  <input type="checkbox" className="h-4 w-4 rounded border-[#f4c27d]" />
                  Remember me
                </label>
                <button
                  type="button"
                  className="font-medium text-[#f4c27d] hover:text-white"
                  onClick={() => { resetFeedback(); setMode("forgot"); }}
                >
                  Forgot your password?
                </button>
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-[#c98736] text-white hover:bg-[#b67628]"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form className="space-y-5" onSubmit={handleForgotPassword}>
              <div className="rounded-md border border-[#f4c27d]/25 bg-[#c98736]/10 p-3 text-sm text-[#f7ead8]">
                <div className="flex items-center gap-2 font-medium text-white">
                  <Mail size={16} />
                  Password recovery is sent by email only.
                </div>
                <p className="mt-1 text-[#b8aa96]">You will receive a secure reset link from info@luxurytentedcamp.com.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#f7ead8]">
                  Email
                </label>
                <Input
                  value={resetContact}
                  onChange={event => setResetContact(event.target.value)}
                  placeholder="name@company.com"
                  type="email"
                  className="h-11 border-[#f4c27d]/25 bg-[#2d2924] text-white placeholder:text-[#b8aa96]"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 border-[#f4c27d]/40 bg-transparent text-[#f4c27d] hover:bg-[#c98736]/20 hover:text-white" onClick={goToSignIn}>
                  Back
                </Button>
                <Button type="submit" className="flex-1 bg-[#c98736] text-white hover:bg-[#b67628]">
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </form>
          )}

          {mode === "reset" && (
            <form className="space-y-5" onSubmit={handleResetPassword}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#f7ead8]">
                  New password
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  placeholder="Uppercase, lowercase, number, and special character"
                  className="h-11 border-[#f4c27d]/25 bg-[#2d2924] text-white placeholder:text-[#b8aa96]"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#f7ead8]">
                  Confirm password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  placeholder="Repeat new password"
                  className="h-11 border-[#f4c27d]/25 bg-[#2d2924] text-white placeholder:text-[#b8aa96]"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 border-[#f4c27d]/40 bg-transparent text-[#f4c27d] hover:bg-[#c98736]/20 hover:text-white" onClick={goToSignIn}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-[#c98736] text-white hover:bg-[#b67628]">
                  {isLoading ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </form>
          )}

          <p className="mt-8 border-t border-[#f4c27d]/20 pt-5 text-center text-xs text-[#b8aa96]">
            Powered by Kumbukumbu Lodge Limited
          </p>
        </div>
      </div>
    </div>
  );
}

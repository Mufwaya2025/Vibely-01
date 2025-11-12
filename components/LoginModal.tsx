// Fix: Implementing the user login modal with password reset flows.
import React, { useMemo, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import {
  login,
  signup,
  loginWithGoogle,
  requestPasswordReset,
  confirmPasswordReset,
} from '../services/authService';
import { User } from '../types';

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  initialMode?: 'login' | 'signup';
}

type AuthView = 'auth' | 'resetRequest' | 'resetConfirm';

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [view, setView] = useState<AuthView>('auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'attendee' | 'manager'>('attendee');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  const isGoogleEnabled = useMemo(() => Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID), []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (view !== 'auth') return;
    setIsLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const user = await login(email, loginPassword);
        onLoginSuccess(user);
        onClose();
      } else {
        const trimmedName = name.trim();
        if (!trimmedName) {
          setError('Your name is required.');
          setIsLoading(false);
          return;
        }
        if (signupPassword.length < 8) {
          setError('Password must be at least 8 characters.');
          setIsLoading(false);
          return;
        }
        if (signupPassword !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }
        const newUser = await signup({
          name: trimmedName,
          email,
          password: signupPassword,
          role,
        });
        onLoginSuccess(newUser);
        onClose();
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || (mode === 'signup' ? 'Failed to create account.' : 'Failed to sign in.'));
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setView('auth');
    setError('');
    setIsLoading(false);
    setLoginPassword('');
    setSignupPassword('');
    setConfirmPassword('');
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Google sign-in failed. Please try again.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      onLoginSuccess(user);
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || 'Google sign-in failed.');
      } else {
        setError('Google sign-in failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again or use email login.');
    setIsLoading(false);
  };

  const startPasswordReset = () => {
    setView('resetRequest');
    setResetEmail(email);
    setResetInfo(null);
    setError('');
    setIsLoading(false);
  };

  const goBackToLogin = () => {
    setView('auth');
    setMode('login');
    setError('');
    setResetInfo(null);
    setResetTokenInput('');
    setNewPassword('');
    setConfirmResetPassword('');
    setIsLoading(false);
  };

  const goToSignup = () => {
    setView('auth');
    setMode('signup');
    setError('');
    setResetInfo(null);
    setResetTokenInput('');
    setNewPassword('');
    setConfirmResetPassword('');
    setIsLoading(false);
  };

  const handleResetRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setResetInfo(null);
    try {
      const response = await requestPasswordReset(resetEmail);
      setResetInfo(
        response.resetToken ? `${response.message} (Dev token: ${response.resetToken})` : response.message
      );
      if (response.resetToken) {
        setResetTokenInput(response.resetToken);
        setView('resetConfirm');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConfirmSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmResetPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    setError('');
    setResetInfo(null);
    try {
      const result = await confirmPasswordReset(resetTokenInput.trim(), newPassword);
      setResetInfo(result.message ?? 'Password updated successfully.');
      setMode('login');
      setView('auth');
      setLoginPassword('');
      setNewPassword('');
      setConfirmResetPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const headingTitle =
    view === 'auth'
      ? mode === 'login'
        ? 'Welcome Back!'
        : 'Join Vibely'
      : view === 'resetRequest'
      ? 'Reset your password'
      : 'Choose a new password';

  const headingSubtitle =
    view === 'auth'
      ? mode === 'login'
        ? 'Log in to continue to Vibely.'
        : 'Create an account to discover and host events.'
      : view === 'resetRequest'
      ? "Enter your email and we'll send reset instructions."
      : 'Use your reset token to set a new password.';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{headingTitle}</h2>
            <p className="mt-2 text-gray-500">{headingSubtitle}</p>
          </div>

          {view === 'auth' && isGoogleEnabled && mode === 'login' && (
            <div className="space-y-4">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_blue"
                text="continue_with"
                shape="rectangular"
              />
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-gray-200" />
                <span className="mx-4 text-xs uppercase tracking-widest text-gray-400">
                  or sign in with email
                </span>
                <div className="flex-grow border-t border-gray-200" />
              </div>
            </div>
          )}

          {view === 'auth' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="name" className="sr-only">
                    Full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                    placeholder="Full name"
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              {mode === 'login' && (
                <div>
                  <label htmlFor="password-login" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password-login"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                  />
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={startPasswordReset}
                      className="text-sm font-semibold text-purple-600 hover:text-purple-700"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              )}
              {mode === 'signup' && (
                <>
                  <div>
                    <label htmlFor="password-signup" className="sr-only">
                      Password
                    </label>
                    <input
                      id="password-signup"
                      name="password-signup"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                      placeholder="Create a password (min 8 characters)"
                    />
                  </div>
                  <div>
                    <label htmlFor="password-confirm" className="sr-only">
                      Confirm password
                    </label>
                    <input
                      id="password-confirm"
                      name="password-confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                      placeholder="Confirm password"
                    />
                  </div>
                  <div>
                    <label className="sr-only">Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['attendee', 'manager'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setRole(option)}
                          className={`rounded-md border px-3 py-3 text-sm font-semibold ${
                            role === option
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {option === 'attendee' ? 'Attendee' : 'Organizer'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60"
                >
                  {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </div>
            </form>
          )}

          {view === 'resetRequest' && (
            <form onSubmit={handleResetRequestSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="reset-email"
                  name="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-md bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
              >
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => setView('resetConfirm')}
                className="w-full rounded-md border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                I already have a reset token
              </button>
              <button
                type="button"
                onClick={goBackToLogin}
                className="w-full text-sm font-semibold text-purple-600 hover:text-purple-700"
              >
                Back to sign in
              </button>
              <button
                type="button"
                onClick={goToSignup}
                className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Need an account? Create one
              </button>
            </form>
          )}

          {view === 'resetConfirm' && (
            <form onSubmit={handleResetConfirmSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-token" className="sr-only">
                  Reset token
                </label>
                <input
                  id="reset-token"
                  name="reset-token"
                  type="text"
                  required
                  value={resetTokenInput}
                  onChange={(e) => setResetTokenInput(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Paste your reset token"
                />
              </div>
              <div>
                <label htmlFor="reset-password" className="sr-only">
                  New password
                </label>
                <input
                  id="reset-password"
                  name="reset-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="New password"
                />
              </div>
              <div>
                <label htmlFor="reset-password-confirm" className="sr-only">
                  Confirm password
                </label>
                <input
                  id="reset-password-confirm"
                  name="reset-password-confirm"
                  type="password"
                  required
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm password"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-md bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
              >
                {isLoading ? 'Updating...' : 'Update password'}
              </button>
              <div className="flex flex-col gap-2 text-center text-sm">
                <button
                  type="button"
                  onClick={() => setView('resetRequest')}
                  className="font-semibold text-gray-600 hover:text-gray-800"
                >
                  Need a new token?
                </button>
                <button
                  type="button"
                  onClick={goBackToLogin}
                  className="font-semibold text-purple-600 hover:text-purple-700"
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={goToSignup}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Need an account? Create one
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {resetInfo && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {resetInfo}
            </div>
          )}

          {view === 'auth' && (
            <div className="text-center text-sm text-gray-500">
              {mode === 'login' ? (
                <>
                  New to Vibely?{' '}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="font-semibold text-purple-600 hover:text-purple-500"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="font-semibold text-purple-600 hover:text-purple-500"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

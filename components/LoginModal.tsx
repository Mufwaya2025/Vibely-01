// Fix: Implementing the user login modal.
import React, { useMemo, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { login, signup, loginWithGoogle } from '../services/authService';
import { User } from '../types';

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  initialMode?: 'login' | 'signup';
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'attendee' | 'manager'>('attendee');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isGoogleEnabled = useMemo(() => Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const user = await login(email, loginPassword);
        if (user) {
          onLoginSuccess(user);
          onClose();
        } else {
          setError('Invalid credentials. Please try again.');
        }
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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome Back!' : 'Join Vibely'}
            </h2>
            <p className="mt-2 text-gray-500">
              {mode === 'login'
                ? 'Log in to continue to Vibely.'
                : 'Create an account to discover and host events.'}
            </p>
          </div>

          {isGoogleEnabled && (
            <div className="mt-6 space-y-4">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_blue"
                text={mode === 'login' ? 'continue_with' : 'signup_with'}
                shape="rectangular"
              />
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-gray-200" />
                <span className="mx-4 text-xs uppercase tracking-widest text-gray-400">
                  or {mode === 'login' ? 'sign in' : 'sign up'} with email
                </span>
                <div className="flex-grow border-t border-gray-200" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
                  required={mode === 'signup'}
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
                  <label htmlFor="account-type" className="sr-only">
                    Account type
                  </label>
                  <select
                    id="account-type"
                    name="account-type"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'attendee' | 'manager')}
                    className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm bg-white"
                  >
                    <option value="attendee">Attendee</option>
                    <option value="manager">Event manager</option>
                  </select>
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400"
              >
                {isLoading
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
              </button>
            </div>
          </form>

          {mode === 'login' && (
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>Production system - use your registered credentials</p>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <p>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-purple-600 font-medium hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-purple-600 font-medium hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          {isGoogleEnabled && (
            <p className="mt-6 text-center text-xs text-gray-400">
              {mode === 'login'
                ? 'You can also log in with Google using the button above.'
                : 'Prefer not to fill the form? Use the Google button above to sign up instantly.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

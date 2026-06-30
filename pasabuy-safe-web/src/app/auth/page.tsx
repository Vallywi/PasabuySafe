'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Coins,
  User,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Phone,
  Calendar,
  Users,
  Wallet,
  Heart,
} from 'lucide-react';
import { signUp, signIn, signInWithGoogle } from '@/lib/supabase/auth';

const trustStats = [
  { value: '100%', label: 'Refund Protection' },
  { value: '0', label: 'Scams Possible' },
  { value: '5,131', label: 'Bytes of Trust' },
];

// Pre-defined sparkle positions (deterministic — avoids SSR hydration mismatch)
const SPARKLE_POSITIONS = [
  { startX: 15, startY: 20, endX: 80, endY: 30, duration: 10 },
  { startX: 85, startY: 15, endX: 20, endY: 85, duration: 12 },
  { startX: 30, startY: 70, endX: 70, endY: 25, duration: 9 },
  { startX: 60, startY: 40, endX: 40, endY: 75, duration: 11 },
  { startX: 20, startY: 50, endX: 90, endY: 60, duration: 13 },
  { startX: 75, startY: 80, endX: 25, endY: 35, duration: 10 },
  { startX: 50, startY: 25, endX: 15, endY: 70, duration: 14 },
  { startX: 90, startY: 60, endX: 35, endY: 20, duration: 11 },
  { startX: 25, startY: 90, endX: 65, endY: 45, duration: 9 },
  { startX: 70, startY: 10, endX: 10, endY: 55, duration: 12 },
  { startX: 45, startY: 65, endX: 85, endY: 15, duration: 13 },
  { startX: 10, startY: 35, endX: 55, endY: 90, duration: 10 },
];

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

  // Common fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup-only fields
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isLogin) {
      setLoading(true);
      const { error } = await signIn(email, password);
      if (error) {
        // Supabase returns "Invalid login credentials" on wrong password
        if (error.message.includes('Invalid login') || error.message.includes('credentials')) {
          setError('Wrong email or password. Please try again.');
        } else {
          setError(error.message);
        }
      } else {
        router.push('/dashboard');
      }
      setLoading(false);
      return;
    }

    // Signup validation
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      setError('Please enter a valid age (13-120).');
      return;
    }
    if (!gender) {
      setError('Please select your gender.');
      return;
    }
    if (!phone || phone.length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    const { error } = await signUp({
      email,
      password,
      fullName,
      age: ageNum,
      gender,
      phone,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Try signing in instead.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('Account created! Check your email to confirm (or just sign in if email confirmation is disabled).');
      // Reset fields
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsLogin(true);
        setSuccess('');
      }, 3000);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    const { error } = await signInWithGoogle();
    if (error) setError('Google login not enabled yet. Use email signup below.');
  }

  return (
    <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2 bg-amber-50">
      {/* LEFT — Brand Story Panel */}
      <div className="hidden lg:flex bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated background patterns */}
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{ repeat: Infinity, duration: 20, repeatType: 'reverse' }}
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3) 0%, transparent 50%)',
            backgroundSize: '200% 200%',
          }}
        />

        {/* Floating sparkle dots — pre-defined positions to avoid hydration mismatch */}
        {SPARKLE_POSITIONS.map((pos, i) => (
          <motion.div
            key={`sparkle-${i}`}
            initial={{ left: `${pos.startX}%`, top: `${pos.startY}%` }}
            animate={{
              left: [`${pos.startX}%`, `${pos.endX}%`, `${pos.startX}%`],
              top: [`${pos.startY}%`, `${pos.endY}%`, `${pos.startY}%`],
              opacity: [0.3, 0.8, 0.3],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              repeat: Infinity,
              duration: pos.duration,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
            className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"
          />
        ))}

        {/* Large floating shield (background) */}
        <motion.div
          animate={{ y: [0, -25, 0], rotate: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          className="absolute top-20 right-12 opacity-25 pointer-events-none"
        >
          <ShieldCheck className="w-40 h-40 text-slate-900" strokeWidth={1.5} />
        </motion.div>

        {/* Floating coins (multiple) */}
        <motion.div
          animate={{ y: [0, 20, 0], rotate: [0, -12, 0] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
          className="absolute bottom-32 right-20 opacity-25 pointer-events-none"
        >
          <Coins className="w-28 h-28 text-slate-900" strokeWidth={1.5} />
        </motion.div>
        <motion.div
          animate={{ y: [0, -15, 0], rotate: [0, 15, 0] }}
          transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/2 right-32 opacity-15 pointer-events-none"
        >
          <Coins className="w-16 h-16 text-white" strokeWidth={2} />
        </motion.div>

        {/* Lock */}
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, -5, 5, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          className="absolute top-1/3 left-12 opacity-20 pointer-events-none"
        >
          <Lock className="w-24 h-24 text-slate-900" strokeWidth={1.5} />
        </motion.div>

        {/* Heart (love) */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="absolute bottom-32 left-16 opacity-30 pointer-events-none"
        >
          <Heart className="w-16 h-16 text-red-400 fill-red-400" strokeWidth={2} />
        </motion.div>

        {/* Sparkles */}
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          className="absolute top-1/4 right-1/3 opacity-40 pointer-events-none"
        >
          <Sparkles className="w-10 h-10 text-white" strokeWidth={2} />
        </motion.div>
        <motion.div
          animate={{ rotate: -360, scale: [0.8, 1.1, 0.8] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
          className="absolute bottom-1/4 left-1/3 opacity-30 pointer-events-none"
        >
          <Sparkles className="w-8 h-8 text-white" strokeWidth={2} />
        </motion.div>

        {/* Wallet floating */}
        <motion.div
          animate={{ y: [0, 18, 0], x: [0, -8, 0], rotate: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
          className="absolute top-1/2 right-8 opacity-15 pointer-events-none"
        >
          <Wallet className="w-20 h-20 text-slate-900" strokeWidth={1.5} />
        </motion.div>

        {/* Bouncing circles (decorative) */}
        <motion.div
          animate={{ y: [0, -30, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-3 h-3 bg-white rounded-full opacity-50 pointer-events-none"
        />
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
          className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-white rounded-full opacity-60 pointer-events-none"
        />
        <motion.div
          animate={{ y: [0, -25, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
          className="absolute top-1/2 left-1/4 w-4 h-4 bg-yellow-200 rounded-full opacity-70 pointer-events-none"
        />

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="w-7 h-7" strokeWidth={2.5} />
            <span className="font-bold text-xl">PasabuySafe</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 text-slate-900"
        >
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
            Buy together.
            <br />
            Pay securely.
            <br />
            <span className="text-white">100% protection.</span>
          </h1>
          <p className="mt-4 text-slate-800 text-lg max-w-md">
            Your payment is locked on the blockchain. Organizers can&apos;t scam you.
            If they ghost, you get a refund. Period.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative z-10 grid grid-cols-3 gap-4"
        >
          {trustStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="text-slate-900"
            >
              <div className="text-2xl xl:text-3xl font-bold">{stat.value}</div>
              <div className="text-xs text-slate-700 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* RIGHT — Auth Form */}
      <div className="flex items-center justify-center px-4 py-8 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mode toggle */}
          <div className="flex bg-amber-50 rounded-2xl p-1 mb-6 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isLogin ? 'bg-yellow-400 shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                !isLogin ? 'bg-yellow-400 shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'signup'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-3xl font-bold text-slate-900 text-center flex items-center justify-center gap-2">
                {isLogin ? 'Welcome Back' : 'Join the Safe Side'}
                {!isLogin && <Sparkles className="w-6 h-6 text-yellow-400" />}
              </h2>
              <p className="text-slate-500 text-center mt-2">
                {isLogin ? 'Sign in to keep your pasabuys safe' : 'No more scams. Free forever.'}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogle}
            className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all bg-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Continue with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400 uppercase tracking-wider">or with email</span></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  {/* Full Name */}
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Full name (Juan Dela Cruz)"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                      required
                    />
                  </div>

                  {/* Age + Gender row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="number"
                        placeholder="Age"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        min={13}
                        max={120}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                        required
                      />
                    </div>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 appearance-none"
                        required
                      >
                        <option value="">Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non-binary">Non-binary</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      placeholder="Phone (e.g., +63 917 123 4567)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                      required
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="password"
                placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                required
                minLength={6}
              />
            </div>

            {/* Confirm Password (signup only) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                      required={!isLogin}
                      minLength={6}
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 ml-2">Passwords don&apos;t match</p>
                  )}
                  {confirmPassword && password === confirmPassword && password.length >= 6 && (
                    <p className="text-xs text-emerald-600 mt-1 ml-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Passwords match
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error / Success messages */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-emerald-700">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Free Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {isLogin && (
            <p className="text-center text-xs text-slate-400 mt-4">
              Forgot your password? <a href="#" className="text-yellow-700 hover:text-yellow-800">Reset it</a>
            </p>
          )}

          {/* Trust badges */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Encrypted
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Protected
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Free Forever
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

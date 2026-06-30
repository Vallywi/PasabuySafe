'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Wallet,
  Package,
  CheckCircle2,
  Lock,
  Zap,
  Heart,
  ArrowRight,
  X,
  Check,
  Sparkles,
  TrendingUp,
  Coins,
} from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';

const steps = [
  {
    num: '01',
    icon: Wallet,
    title: 'You Pay',
    description: 'Money locked in smart contract. Organizer cannot touch it.',
    iconBg: 'from-yellow-400 to-yellow-500',
    bgColor: 'from-yellow-50 to-white',
  },
  {
    num: '02',
    icon: Package,
    title: 'They Deliver',
    description: 'Organizer ships your order. Money still locked.',
    iconBg: 'from-orange-400 to-orange-500',
    bgColor: 'from-orange-50 to-white',
  },
  {
    num: '03',
    icon: CheckCircle2,
    title: 'You Confirm',
    description: 'Got your item? Click confirm. Money released. Done.',
    iconBg: 'from-emerald-400 to-emerald-500',
    bgColor: 'from-emerald-50 to-white',
  },
];

const stats = [
  { value: 'On-chain', label: 'Every transaction', icon: ShieldCheck },
  { value: '₱0', label: 'Cost to use', icon: Heart },
  { value: '∞', label: 'Trust required', icon: Lock },
];

const testimonials = [
  { name: 'Maria S.', role: 'Pasabuy Organizer', quote: 'Finally I can prove I am legit. Buyers trust me instantly.' },
  { name: 'Juan dela Cruz', role: 'Buyer', quote: 'Got scammed twice before. Never again. PasabuySafe is the way.' },
  { name: 'Ana R.', role: 'Korean Skincare Buyer', quote: 'My money is locked until I receive my order. Sleep peacefully now.' },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.5]);

  return (
    <div ref={containerRef} className="min-h-screen overflow-x-hidden bg-amber-50/30">
      {/* HERO */}
      <motion.section
        style={{ scale: heroScale, opacity: heroOpacity }}
        className="relative pt-12 pb-20 px-4 overflow-hidden"
      >
        {/* Yellow gradient blobs (soft, not solid background) */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
          className="absolute top-10 -left-20 w-96 h-96 bg-yellow-300 rounded-full blur-3xl opacity-50"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
          className="absolute top-20 -right-20 w-96 h-96 bg-amber-200 rounded-full blur-3xl opacity-50"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, 20, 0] }}
          transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
          className="absolute bottom-0 left-1/3 w-80 h-80 bg-yellow-200 rounded-full blur-3xl opacity-40"
        />

        {/* Floating icons (NO heart) */}
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          className="absolute top-16 right-10 opacity-10 pointer-events-none"
        >
          <ShieldCheck className="w-40 h-40 text-yellow-600" strokeWidth={1.5} />
        </motion.div>
        <motion.div
          animate={{ y: [0, 15, 0], rotate: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
          className="absolute bottom-20 right-16 opacity-10 pointer-events-none"
        >
          <Wallet className="w-28 h-28 text-yellow-600" strokeWidth={1.5} />
        </motion.div>
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, -5, 5, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          className="absolute top-1/3 left-8 opacity-10 pointer-events-none"
        >
          <Lock className="w-24 h-24 text-yellow-600" strokeWidth={1.5} />
        </motion.div>
        <motion.div
          animate={{ y: [0, 18, 0], x: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut' }}
          className="absolute bottom-1/3 left-20 opacity-8 pointer-events-none"
        >
          <Package className="w-20 h-20 text-yellow-600" strokeWidth={1.5} />
        </motion.div>

        {/* Coin elements */}
        <motion.div
          animate={{ y: [0, -15, 0], rotate: [0, 15, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          className="absolute top-24 left-1/4 opacity-15 pointer-events-none"
        >
          <Coins className="w-16 h-16 text-yellow-600" strokeWidth={1.5} />
        </motion.div>
        <motion.div
          animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-16 right-1/3 opacity-12 pointer-events-none"
        >
          <Coins className="w-12 h-12 text-yellow-500" strokeWidth={1.5} />
        </motion.div>
        <motion.div
          animate={{ y: [0, -10, 0], x: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut', delay: 2 }}
          className="absolute top-1/2 right-8 opacity-10 pointer-events-none"
        >
          <Coins className="w-10 h-10 text-amber-500" strokeWidth={2} />
        </motion.div>

        {/* Sparkle animations */}
        {[
          { left: '12%', top: '18%', size: 'w-5 h-5', dur: 3, delay: 0 },
          { left: '78%', top: '22%', size: 'w-4 h-4', dur: 2.5, delay: 0.5 },
          { left: '55%', top: '75%', size: 'w-5 h-5', dur: 3.5, delay: 1 },
          { left: '30%', top: '65%', size: 'w-3 h-3', dur: 2.8, delay: 1.5 },
          { left: '85%', top: '60%', size: 'w-4 h-4', dur: 3.2, delay: 0.8 },
          { left: '20%', top: '40%', size: 'w-3 h-3', dur: 2.6, delay: 2 },
          { left: '65%', top: '35%', size: 'w-4 h-4', dur: 3, delay: 0.3 },
          { left: '45%', top: '15%', size: 'w-3 h-3', dur: 2.4, delay: 1.2 },
        ].map((spark, i) => (
          <motion.div
            key={`spark-${i}`}
            animate={{
              scale: [0.5, 1.2, 0.5],
              opacity: [0.2, 0.7, 0.2],
              rotate: [0, 180, 360],
            }}
            transition={{
              repeat: Infinity,
              duration: spark.dur,
              ease: 'easeInOut',
              delay: spark.delay,
            }}
            className={`absolute pointer-events-none ${spark.size}`}
            style={{ left: spark.left, top: spark.top }}
          >
            <Sparkles className="w-full h-full text-yellow-400" strokeWidth={2} />
          </motion.div>
        ))}

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-50 border border-red-200 rounded-full mb-6"
          >
            <motion.span
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2 h-2 bg-red-500 rounded-full"
            />
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Stop Pasabuy Scams</p>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-5xl md:text-7xl font-bold text-slate-900 leading-[1.05] tracking-tight"
          >
            {['Buy', 'together.', 'Pay'].map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="inline-block mr-3"
              >
                {word}
              </motion.span>
            ))}
            <br />
            <motion.span
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="inline-block bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-500 bg-clip-text text-transparent"
            >
              securely.
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto"
          >
            Blockchain-powered escrow for Filipino group buying.
            <br className="hidden sm:inline" />
            <strong className="text-slate-900">No more scammers walking away with your money.</strong>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/auth"
              className="group inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-8 py-3.5 rounded-2xl font-bold shadow-xl shadow-yellow-200 transition-all hover:scale-105"
            >
              <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
              Start for Free
            </Link>
            <WalletButton />
            <Link
              href="/explore"
              className="inline-flex items-center gap-1 text-slate-700 hover:text-yellow-700 font-medium px-4 py-2"
            >
              Browse Pasabuys
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Trust line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500"
          >
            <span className="inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              Instant refunds
            </span>
            <span className="text-slate-700 opacity-50">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-yellow-500" />
              Blockchain proof
            </span>
            <span className="text-slate-700 opacity-50">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-yellow-500" />
              Free forever
            </span>
          </motion.div>
        </div>
      </motion.section>

      {/* HOW IT WORKS */}
      <section className="px-4 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900">
              3 steps. Zero trust.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.6 }}
                  whileHover={{ y: -8 }}
                  className={`relative bg-gradient-to-br ${step.bgColor} border border-slate-100 rounded-3xl p-8 overflow-hidden`}
                >
                  <div className="absolute -top-2 -right-2 text-7xl font-black text-slate-100 select-none">
                    {step.num}
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.iconBg} flex items-center justify-center text-white shadow-lg mb-4 relative z-10`}
                  >
                    <Icon className="w-8 h-8" strokeWidth={2.5} />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-slate-900 relative z-10">{step.title}</h3>
                  <p className="mt-2 text-slate-600 relative z-10">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="px-4 py-20 bg-amber-50/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-3">The Difference</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900">
              Old way vs. PasabuySafe
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Without */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-red-50 border-2 border-red-100 rounded-3xl p-8 relative overflow-hidden"
            >
              <h3 className="font-bold text-red-800 text-xl mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-red-200 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-700" strokeWidth={3} />
                </span>
                Traditional Pasabuy
              </h3>
              <ul className="space-y-3 text-red-800">
                {[
                  'Money sent directly to organizer',
                  'They can block you anytime',
                  'No proof of transaction',
                  'Trust-based — easily abused',
                  'Zero recourse if scammed',
                ].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" strokeWidth={3} />
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* With */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-3xl p-8 relative overflow-hidden"
            >
              <h3 className="font-bold text-yellow-900 text-xl mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-yellow-300 flex items-center justify-center">
                  <Check className="w-5 h-5 text-yellow-900" strokeWidth={3} />
                </span>
                PasabuySafe
              </h3>
              <ul className="space-y-3 text-slate-800">
                {[
                  'Money locked in smart contract',
                  'Only YOU release the payment',
                  'Every action on blockchain',
                  'Math, not trust',
                  'Auto-refund if not delivered',
                ].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" strokeWidth={3} />
                    <span><strong>{item}</strong></span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* STATS BANNER */}
      <section className="px-4 py-16 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-10 text-white text-center relative overflow-hidden"
        >
          <motion.div
            animate={{ rotate: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 8 }}
            className="absolute top-4 right-8 opacity-20"
          >
            <ShieldCheck className="w-24 h-24 text-yellow-400" strokeWidth={1.5} />
          </motion.div>

          <h3 className="text-3xl font-bold">
            Built <span className="text-yellow-400">different.</span>
          </h3>
          <p className="text-slate-300 mt-2">Powered by Stellar Soroban smart contracts</p>

          <div className="grid grid-cols-3 gap-6 mt-8 relative z-10">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Icon className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                  <div className="text-2xl md:text-3xl font-black">{stat.value}</div>
                  <div className="text-xs text-slate-300 mt-1">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-4 py-20 bg-amber-50/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-3">Real Stories</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 flex items-center justify-center gap-3">
              Filipinos love it
              <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-yellow-400" />
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all border border-slate-100"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-slate-900 font-bold text-lg mb-4">
                  {t.name.charAt(0)}
                </div>
                <p className="text-slate-700 italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 py-20 bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="inline-flex w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-500 items-center justify-center mb-6 shadow-2xl shadow-yellow-200"
          >
            <ShieldCheck className="w-12 h-12 text-slate-900" strokeWidth={2.5} />
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight">
            Ready to pasabuy
            <br />
            <span className="bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">
              without fear?
            </span>
          </h2>
          <p className="mt-6 text-lg text-slate-600 max-w-xl mx-auto">
            Join thousands of Filipinos buying safely. Free forever. No catch.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth"
              className="group inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-yellow-200 transition-all hover:scale-105"
            >
              <TrendingUp className="w-5 h-5" strokeWidth={2.5} />
              Start Free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1 text-slate-700 hover:text-yellow-600 px-8 py-4 font-medium text-lg"
            >
              Browse first
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white py-12 border-t border-slate-800 relative overflow-hidden">
        {/* Animated floating dots */}
        {[
          { left: '8%', top: '20%', dur: 4 },
          { left: '92%', top: '30%', dur: 3.5 },
          { left: '25%', top: '70%', dur: 5 },
          { left: '75%', top: '80%', dur: 3.8 },
          { left: '50%', top: '15%', dur: 4.5 },
          { left: '15%', top: '50%', dur: 3.2 },
          { left: '85%', top: '60%', dur: 4.2 },
          { left: '40%', top: '85%', dur: 3.6 },
          { left: '60%', top: '40%', dur: 5.5 },
          { left: '35%', top: '25%', dur: 4.8 },
        ].map((dot, i) => (
          <motion.div
            key={`footer-dot-${i}`}
            animate={{ y: [0, -10, 0], opacity: [0.15, 0.4, 0.15] }}
            transition={{ repeat: Infinity, duration: dot.dur, ease: 'easeInOut', delay: i * 0.3 }}
            className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full pointer-events-none"
            style={{ left: dot.left, top: dot.top }}
          />
        ))}

        {/* Floating sparkle elements */}
        <motion.div
          animate={{ rotate: 360, scale: [0.8, 1.1, 0.8] }}
          transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
          className="absolute top-8 right-12 opacity-10 pointer-events-none"
        >
          <Sparkles className="w-8 h-8 text-yellow-400" strokeWidth={2} />
        </motion.div>
        <motion.div
          animate={{ rotate: -360, scale: [1, 0.8, 1] }}
          transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
          className="absolute bottom-10 left-10 opacity-10 pointer-events-none"
        >
          <Sparkles className="w-6 h-6 text-yellow-400" strokeWidth={2} />
        </motion.div>
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          className="absolute top-1/3 left-1/2 opacity-8 pointer-events-none"
        >
          <Coins className="w-6 h-6 text-yellow-400/30" strokeWidth={1.5} />
        </motion.div>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-6 h-6 text-yellow-400" strokeWidth={2.5} />
                <span className="font-bold text-lg">Pasabuy<span className="text-yellow-400">Safe</span></span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Buy Together. Pay Securely. Anti-scam escrow for Filipino group buying.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-sm text-slate-300 uppercase tracking-wider mb-3">Platform</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/explore" className="hover:text-yellow-400 transition-colors">Explore Pasabuys</Link></li>
                <li><Link href="/dashboard/organizer/create" className="hover:text-yellow-400 transition-colors">Create Pasabuy</Link></li>
                <li><Link href="/dashboard" className="hover:text-yellow-400 transition-colors">Dashboard</Link></li>
                <li><Link href="/auth" className="hover:text-yellow-400 transition-colors">Sign Up Free</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold text-sm text-slate-300 uppercase tracking-wider mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="https://stellar.expert/explorer/testnet/contract/CD5TYW7NH5BGFF4DNXKXTJEDIPPRBIC6MJ7M2STW3LLXKHGCOJRNNYON" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors">Smart Contract ↗</a></li>
                <li><a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors">Get Freighter Wallet ↗</a></li>
                <li><a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors">Stellar Network ↗</a></li>
              </ul>
            </div>

            {/* Trust */}
            <div>
              <h4 className="font-semibold text-sm text-slate-300 uppercase tracking-wider mb-3">Security</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-yellow-400" /> Blockchain-powered</li>
                <li className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-yellow-400" /> Funds locked in escrow</li>
                <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-yellow-400" /> Instant refunds</li>
                <li className="flex items-center gap-2"><Coins className="w-3.5 h-3.5 text-yellow-400" /> XLM on Stellar</li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} PasabuySafe. Built with ❤️ for Filipinos.
            </p>
            <p className="text-xs text-slate-500">
              Powered by{' '}
              <a href="https://stellar.org/soroban" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:text-yellow-300 transition-colors">
                Stellar Soroban
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

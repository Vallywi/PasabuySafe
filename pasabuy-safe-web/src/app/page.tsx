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
        {/* Animated background blobs */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
          className="absolute top-20 -left-20 w-80 h-80 bg-yellow-300 rounded-full blur-3xl opacity-40"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
          className="absolute top-40 -right-20 w-80 h-80 bg-amber-200 rounded-full blur-3xl opacity-40"
        />

        <div className="max-w-5xl mx-auto text-center relative">
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
              className="inline-flex items-center gap-1 text-slate-700 hover:text-yellow-600 font-medium px-4 py-2"
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
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-yellow-500" />
              Blockchain proof
            </span>
            <span className="text-slate-300">•</span>
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
      <footer className="text-center py-10 text-sm text-slate-400 border-t border-slate-100 bg-slate-900 text-white">
        <p className="font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-yellow-400" />
          Built with
          <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" />
          for Filipinos by Filipinos
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Smart contract on Stellar Testnet:{' '}
          <a
            href="https://stellar.expert/explorer/testnet/contract/CD5TYW7NH5BGFF4DNXKXTJEDIPPRBIC6MJ7M2STW3LLXKHGCOJRNNYON"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-yellow-400 transition-colors underline"
          >
            View on Stellar Expert →
          </a>
        </p>
      </footer>
    </div>
  );
}

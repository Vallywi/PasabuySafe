'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldCheck, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'general' | 'buyer' | 'organizer' | 'security';
}

const faqs: FAQItem[] = [
  {
    category: 'general',
    question: 'What is PasabuySafe?',
    answer: 'PasabuySafe is a blockchain-powered escrow platform for group buying (pasabuy) in the Philippines. It protects buyers by locking payments in a smart contract — organizers cannot access the money until the buyer confirms delivery.',
  },
  {
    category: 'general',
    question: 'Is PasabuySafe free to use?',
    answer: 'Yes! Creating an account and browsing pasabuys is completely free. The only cost is the small Stellar network fee (less than ₱1) when making on-chain transactions like depositing or confirming.',
  },
  {
    category: 'general',
    question: 'Do I need to know about crypto or blockchain?',
    answer: 'No! You can sign up with email and browse pasabuys without any crypto knowledge. You only need a Freighter wallet when you want to make actual payments. The blockchain works invisibly in the background to protect your money.',
  },
  {
    category: 'buyer',
    question: 'How does my money stay safe?',
    answer: 'When you pay, your money goes into a smart contract on the Stellar blockchain — NOT to the organizer directly. The organizer physically cannot access your funds until YOU click "Confirm Delivery." If they disappear or don\'t deliver, you get an automatic refund after the deadline.',
  },
  {
    category: 'buyer',
    question: 'What if the organizer scams me?',
    answer: 'They can\'t! The smart contract holds your money. If the organizer never delivers and the deadline passes, you simply click "Refund" and your full payment returns to your wallet instantly. No one can prevent this — not even us.',
  },
  {
    category: 'buyer',
    question: 'What if I receive my order but don\'t confirm?',
    answer: 'To protect organizers from dishonest buyers, there\'s a confirmation window (typically 3 days). If you don\'t confirm or dispute within that time after delivery is marked, the organizer can trigger an auto-release of funds.',
  },
  {
    category: 'buyer',
    question: 'How do I get a refund?',
    answer: 'If the deadline passes and the organizer hasn\'t marked your order as delivered, a "Get Refund" button appears. Click it, sign with your wallet, and your full payment returns instantly. It\'s on-chain — no approval from anyone needed.',
  },
  {
    category: 'organizer',
    question: 'How do I receive payment as an organizer?',
    answer: 'After you deliver the items and mark them as "Delivered" in the system, each buyer must click "Confirm Delivery." Once confirmed, the payment is released from escrow directly to your wallet. If a buyer doesn\'t confirm within the confirmation window, you can auto-release.',
  },
  {
    category: 'organizer',
    question: 'Can buyers scam me by not confirming?',
    answer: 'No. PasabuySafe includes a "confirmation window" (default 3 days). If a buyer receives their order but doesn\'t confirm within that time, you can call "release_expired" to automatically receive your payment. The system protects both sides.',
  },
  {
    category: 'organizer',
    question: 'How do I create a pasabuy?',
    answer: 'Connect your Freighter wallet, go to Dashboard → Create Pasabuy. Fill in the title, category, price, location, deadline, and upload a photo. Share the link with your community. Buyers can join and pay securely through escrow.',
  },
  {
    category: 'security',
    question: 'Where is my money stored?',
    answer: 'Your money is stored in a smart contract on the Stellar blockchain. It\'s not in anyone\'s wallet — not the organizer\'s, not ours. Only cryptographic signatures (your wallet key) can release the funds. This is mathematically guaranteed.',
  },
  {
    category: 'security',
    question: 'Can PasabuySafe steal my money?',
    answer: 'No. We have no access to the funds in the smart contract. The contract code is open source and deployed on-chain — anyone can verify it. Only YOUR wallet signature can release YOUR funds.',
  },
  {
    category: 'security',
    question: 'What is a Freighter wallet?',
    answer: 'Freighter is a free browser extension (like MetaMask but for Stellar). It stores your Stellar keys securely and lets you sign transactions. Get it at freighter.app — it takes 2 minutes to set up.',
  },
  {
    category: 'security',
    question: 'What blockchain does PasabuySafe use?',
    answer: 'PasabuySafe runs on Stellar Soroban — a fast, low-cost blockchain designed for financial applications. Transactions cost less than ₱1 and confirm in 5 seconds.',
  },
];

const categories = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'buyer', label: 'For Buyers' },
  { id: 'organizer', label: 'For Organizers' },
  { id: 'security', label: 'Security' },
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = activeCategory === 'all'
    ? faqs
    : faqs.filter((f) => f.category === activeCategory);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 items-center justify-center mb-4 shadow-lg shadow-yellow-200">
          <HelpCircle className="w-7 h-7 text-slate-900" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Frequently Asked Questions</h1>
        <p className="text-slate-600 mt-2">Everything you need to know about PasabuySafe</p>
      </motion.div>

      {/* Category filter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap justify-center gap-2 mb-8"
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setOpenIndex(null); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-yellow-400 text-slate-900 shadow-md shadow-yellow-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-yellow-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </motion.div>

      {/* FAQ Items */}
      <div className="space-y-3">
        {filtered.map((faq, i) => (
          <motion.div
            key={`${faq.category}-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-yellow-200 transition-colors"
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <span className="font-semibold text-slate-900 pr-4">{faq.question}</span>
              <motion.div
                animate={{ rotate: openIndex === i ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </motion.div>
            </button>

            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-3">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Still have questions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-12 bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-3xl p-8 text-center"
      >
        <ShieldCheck className="w-10 h-10 text-yellow-600 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-900">Still have questions?</h3>
        <p className="text-slate-600 mt-2">
          Your money is always protected by the smart contract. If you&apos;re unsure, try a small amount first.
        </p>
      </motion.div>
    </div>
  );
}

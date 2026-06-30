# PasabuySafe — UX/UI Specification & Supabase Integration Plan

---

## Part 1: UX/UI Design Philosophy

### Design Principle: "Shopee meets Crypto — without the complexity"

The target audience is Filipino online shoppers who join group buys on Facebook, Telegram, and Viber. They're comfortable with e-commerce apps (Shopee, Lazada) but NOT crypto-native. The UX must feel like a shopping app that happens to be secure on blockchain — not a DeFi dashboard.

---

## 1. UX Pillars

| Pillar | Meaning | How We Apply It |
|--------|---------|-----------------|
| **Familiar** | Looks like apps they already use | Card-based layouts, shopping metaphors, progress bars |
| **Trustworthy** | Users feel their money is safe | Green shields, lock icons, real-time status updates, transaction receipts |
| **Engaging** | Users want to come back | Gamification (streaks, badges), social proof, notifications |
| **Simple** | No crypto jargon | "Pay" not "Deposit", "Get refund" not "Invoke refund function" |
| **Mobile-first** | Most users are on phones | Thumb-friendly, bottom navigation, swipe gestures |

---

## 2. Visual Design System

### Brand Identity

PasabuySafe is built around **trust, warmth, and Filipino community**. The visual language uses a sunshine-yellow primary (familiar to Shopee/GCash users) paired with deep midnight slate for serious financial moments. Mint green is reserved exclusively for "money safe" trust signals.

### Color Palette

```
Primary (Sunshine Yellow):
  50:  #FFFBEB  — Soft cream background
  100: #FEF3C7  — Subtle yellow tint
  200: #FDE68A  — Light yellow
  300: #FCD34D  — Medium yellow
  400: #FBBF24  — Warm gold
  500: #FACC15  — BRAND PRIMARY (logo color)
  600: #EAB308  — Marigold (hover states)
  700: #CA8A04  — Deep gold
  800: #854D0E  — Dark gold (text on yellow)
  900: #713F12  — Darkest gold

Secondary (Midnight Slate):
  900: #0F172A  — BRAND DARK (wordmark color, headlines)
  800: #1E293B  — Slate body text
  700: #334155  — Secondary text
  600: #475569  — Muted text
  500: #64748B  — Placeholder text
  400: #94A3B8  — Disabled text
  100: #F1F5F9  — Light slate background

Accent (Sunset Coral):
  500: #FB923C  — Urgency, warnings, secondary CTAs
  600: #EA580C  — Hover state

Trust (Mint Green) — RESERVED for "money safe" moments:
  500: #10B981  — Funds released, deposit confirmed
  600: #059669  — Hover state

Danger (Tomato Red):
  500: #EF4444  — Scam warnings, errors, refund expired
  600: #DC2626  — Hover state

Neutrals:
  Background: #FFFBEB  (Cream — warm white page background)
  Surface:    #FFFFFF  (Pure white — cards, modals)
  Border:     #F3F4F6  (Subtle gray-50 dividers)
  Border-2:   #E5E7EB  (Visible gray-200 borders)
```

### Color Usage Rules

| Element | Color | Why |
|---------|-------|-----|
| Logo & branding | Yellow + Slate | Match official logo |
| Primary CTA buttons | Yellow 500 with Slate 900 text | High contrast, brand-forward |
| Hover states | Yellow 600 | Subtle depth |
| Headlines | Slate 900 | Professional, readable |
| Body text | Slate 700 | Easy on the eyes |
| "Money is safe" badges | Mint 500 | Trust signal — sparingly used |
| Urgent/warning badges | Coral 500 | Attention without alarm |
| Scam/error states | Red 500 | Clear danger |
| Page backgrounds | Cream | Warm, inviting |
| Card backgrounds | Pure white | Clean separation from cream bg |

### Typography
- **Headings**: Plus Jakarta Sans (modern, friendly, readable)
- **Body**: Inter (clean, works at all sizes)
- **Monospace** (addresses/hashes): JetBrains Mono

### Iconography
- Lucide React icons (consistent stroke-width, open source)
- Stroke width: `2` (regular), `2.5` (bold for brand elements)
- Size system: `w-4 h-4` (inline), `w-5 h-5` (buttons), `w-6 h-6` (cards), `w-8 h-8` (heroes)

### Component Library
- Built on shadcn/ui base (accessible, customizable)
- Custom components: EscrowCard, StatusTimeline, WalletButton, BrandLogo

---

## 3. Engagement Features

### 3.1 Gamification

| Feature | Description | Purpose |
|---------|-------------|---------|
| **Trust Score** | Organizers earn points per successful delivery | Builds reputation, encourages reliability |
| **Buyer Badges** | "First Buy", "5 Confirmed", "Loyal Buyer" | Retention, sense of achievement |
| **Streak Counter** | Consecutive successful group buys | Engagement loop |
| **Leaderboard** | Top organizers by completed group buys | Social proof, competition |

### 3.2 Social Features

| Feature | Description |
|---------|-------------|
| **Share Link** | One-tap share to FB/Viber/Telegram with preview card |
| **Group Chat** | Embedded comments per group buy (buyers + organizer) |
| **Referral Code** | Invite friends, earn badge points |
| **Activity Feed** | "Maria just confirmed delivery!" — social proof notifications |

### 3.3 Notifications & Urgency

| Trigger | Notification | Channel |
|---------|-------------|---------|
| New group buy from followed organizer | "🛍️ New pasabuy from @Juan!" | Push + in-app |
| Order marked delivered | "📦 Your order is here! Confirm to release payment" | Push + email |
| Deadline approaching (24h) | "⏰ Deadline tomorrow — confirm or request refund" | Push |
| Refund available | "💰 You can now get your refund" | Push + email |
| Group buy filled | "🎉 All slots taken! Organizer is ordering now" | In-app |

---

## 4. Page-by-Page UX Design

### 4.1 Landing Page

```
┌─────────────────────────────────────────┐
│  [Logo]  Explore  How it Works  Connect │  ← Sticky header
├─────────────────────────────────────────┤
│                                         │
│   🛡️ Group Buy with Confidence          │
│   "Your money is safe until you         │
│    confirm delivery."                   │
│                                         │
│   [Connect Wallet]  [Browse Pasabuys]   │
│                                         │
├─────────────────────────────────────────┤
│   HOW IT WORKS (animated 3 steps)       │
│                                         │
│   💳 Pay → 📦 Receive → ✅ Confirm      │
│   "Funds held    "Organizer   "Money    │
│    in escrow"     delivers"    released"│
│                                         │
├─────────────────────────────────────────┤
│   ACTIVE GROUP BUYS (live cards)        │
│   ┌──────┐ ┌──────┐ ┌──────┐          │
│   │ Buy1 │ │ Buy2 │ │ Buy3 │          │
│   └──────┘ └──────┘ └──────┘          │
│                                         │
├─────────────────────────────────────────┤
│   TRUST STATS                           │
│   "₱2.3M secured • 450 completed •     │
│    98% delivery rate"                   │
│                                         │
├─────────────────────────────────────────┤
│   TESTIMONIALS / SOCIAL PROOF           │
│                                         │
└─────────────────────────────────────────┘
```

### 4.2 Group Buy Card (Reusable Component)

```
┌─────────────────────────────────┐
│  [Image/Thumbnail]              │
│                                 │
│  Korean Skincare Bundle         │
│  by @MariaShopper ⭐ 4.9       │
│                                 │
│  ₱850 per slot                  │
│  ██████████░░ 8/12 slots filled │
│                                 │
│  ⏰ Deadline: July 15, 2026     │
│                                 │
│  [Join This Pasabuy →]          │
└─────────────────────────────────┘
```

### 4.3 Buyer Order View (Status Timeline)

```
┌─────────────────────────────────────┐
│  Korean Skincare Bundle             │
│  Order #: ...XVRMW                  │
│                                     │
│  STATUS TIMELINE:                   │
│                                     │
│  ✅ Paid (June 29) ─────────        │
│  ✅ Order Placed (June 30) ──       │
│  ✅ Delivered (July 5) ──────       │
│  ⬜ Confirm Receipt                 │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📦 Your item has arrived!  │    │
│  │                             │    │
│  │  [✅ Confirm Delivery]      │    │
│  │  [❓ Report Issue]          │    │
│  └─────────────────────────────┘    │
│                                     │
│  💡 Confirming releases ₱850 to     │
│     the organizer                   │
│                                     │
│  [View on Stellar Expert ↗]        │
└─────────────────────────────────────┘
```

### 4.4 Organizer Dashboard

```
┌─────────────────────────────────────────┐
│  My Group Buys                          │
│                                         │
│  ┌─ Active ─────────────────────────┐   │
│  │ Korean Skincare Bundle           │   │
│  │ 8 buyers • ₱6,800 escrowed      │   │
│  │                                  │   │
│  │ BUYERS:                          │   │
│  │ ┌──────────────────────────────┐ │   │
│  │ │ @Ana    ₱850  Deposited  [Mark Delivered] │
│  │ │ @Ben    ₱850  Delivered  [Waiting...]     │
│  │ │ @Carlo  ₱850  Confirmed  ✅               │
│  │ └──────────────────────────────┘ │   │
│  │                                  │   │
│  │ [Mark All Delivered]             │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [+ Create New Pasabuy]                 │
└─────────────────────────────────────────┘
```

### 4.5 Refund Flow (Empathetic UX)

```
┌─────────────────────────────────────┐
│  😔 Sorry this didn't work out      │
│                                     │
│  The deadline has passed and your   │
│  order wasn't delivered.            │
│                                     │
│  You can get your full refund:      │
│                                     │
│  Amount: ₱850                       │
│  Will return to: G...VVH6           │
│                                     │
│  [💰 Get My Refund]                 │
│                                     │
│  ℹ️ This is instant and on-chain.   │
│     No approval needed.             │
└─────────────────────────────────────┘
```

---

## 5. Animation & Motion System

### Animation Philosophy

Motion is not decoration — it's communication. Every animation tells the user "something happened" and guides their eye to what matters next. PasabuySafe should feel alive and responsive, like a premium app.

**Animation Stack:**
- **Framer Motion** — Primary animation library (page transitions, layout animations, gestures)
- **Lottie (via lottie-react)** — Complex illustrated animations (onboarding, success states)
- **GSAP** — Scroll-triggered animations on landing page (parallax, reveals)
- **Rive** — Interactive state-machine animations (escrow vault, coin flows)
- **CSS @keyframes + Tailwind `animate-`** — Lightweight micro-interactions

---

### 5.1 Page Transitions

| Transition | Animation | Duration |
|------------|-----------|----------|
| Page enter | Fade up + scale from 0.95 | 300ms ease-out |
| Page exit | Fade down + scale to 0.98 | 200ms ease-in |
| Tab switch | Horizontal slide (direction-aware) | 250ms spring |
| Modal open | Backdrop blur + sheet slides from bottom | 350ms spring(1, 0.85, 0.5) |
| Modal close | Sheet drops + backdrop fades | 200ms ease-in |

```tsx
// Framer Motion page wrapper
<motion.div
  initial={{ opacity: 0, y: 20, scale: 0.98 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: -10, scale: 0.99 }}
  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
>
  {children}
</motion.div>
```

---

### 5.2 Wallet Connection Sequence

A cinematic 3-second sequence when user connects Freighter:

```
Frame 1 (0ms):    Button pulses with glow effect
Frame 2 (300ms):  Freighter popup opens (browser-handled)
Frame 3 (user signs): Button morphs into success state
Frame 4 (800ms):  Confetti burst (300 particles, gravity, multiple colors)
Frame 5 (1200ms): Wallet address types in character-by-character
Frame 6 (1800ms): Avatar placeholder morphs in with spring bounce
Frame 7 (2200ms): Nav items stagger-animate in (one by one, 80ms delay each)
```

```tsx
// Confetti on wallet connect
import confetti from 'canvas-confetti';

const celebrateConnection = () => {
  confetti({
    particleCount: 300,
    spread: 100,
    origin: { y: 0.4 },
    colors: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'],
    gravity: 0.8,
    ticks: 200
  });
};
```

---

### 5.3 Escrow Vault Animation (Rive Interactive)

A central visual metaphor — an animated vault/safe that responds to contract state:

| State | Vault Animation | Sound (optional) |
|-------|----------------|------------------|
| Empty (no deposits) | Vault door open, idle breathing glow | — |
| Deposits incoming | Coins fly into vault, door partially closes | Coin clink |
| All deposited | Vault locked, pulsing shield glow | Lock click |
| Delivery marked | Package icon appears on vault | — |
| Confirmed | Vault opens, coins fly to organizer | Cash register |
| Refunded | Vault opens, coins fly back to buyer | Whoosh |
| Expired | Vault cracks, red warning pulse | — |

This is built as a **Rive state machine** so it transitions smoothly based on props:

```tsx
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

const EscrowVault = ({ status }) => {
  const { rive, RiveComponent } = useRive({
    src: '/animations/escrow-vault.riv',
    stateMachines: 'VaultState',
    autoplay: true,
  });

  const stateInput = useStateMachineInput(rive, 'VaultState', 'status');

  useEffect(() => {
    if (stateInput) {
      const stateMap = { deposited: 1, delivered: 2, confirmed: 3, refunded: 4 };
      stateInput.value = stateMap[status] || 0;
    }
  }, [status, stateInput]);

  return <RiveComponent className="w-64 h-64" />;
};
```

---

### 5.4 Deposit Flow Animation Sequence

When a buyer clicks "Pay" (deposit):

```
Step 1: Button → Loading
  - Button text fades out
  - Spinner fades in (custom Lottie, not a boring circle)
  - Button width shrinks to circle momentarily

Step 2: Signing (Freighter popup)
  - Pulsing ring around button ("waiting for signature...")
  - Subtle particles float around the button

Step 3: Submitting
  - Progress bar fills under the button (indeterminate → determinate)
  - "Sending to Stellar..." text with typing effect

Step 4: Success!
  - Button explodes into success state (green, checkmark morphs in)
  - Coin animation: 3D coin flies from button → vault illustration
  - Amount counter animates up (₱0 → ₱850, number spring)
  - Status timeline advances with smooth node-fill animation
  - Toast notification slides down from top with spring physics
  - Subtle screen flash (green overlay, 100ms, 5% opacity)
```

```tsx
// Animated number counter
import { useSpring, animated } from '@react-spring/web';

const AnimatedAmount = ({ value }) => {
  const { number } = useSpring({
    from: { number: 0 },
    number: value,
    delay: 200,
    config: { mass: 1, tension: 120, friction: 14 }
  });

  return <animated.span>{number.to(n => `₱${n.toFixed(0)}`)}</animated.span>;
};
```

---

### 5.5 Status Timeline Animation

The order status timeline is a living, breathing component:

```tsx
// Each node animates sequentially
<motion.div className="timeline">
  {steps.map((step, i) => (
    <motion.div
      key={step.id}
      initial={{ scale: 0, opacity: 0 }}
      animate={step.completed ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0.4 }}
      transition={{
        delay: i * 0.15,
        type: 'spring',
        stiffness: 300,
        damping: 20
      }}
    >
      {/* Connector line draws itself */}
      <motion.div
        className="connector-line"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: step.completed ? 1 : 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut', delay: i * 0.15 + 0.1 }}
      />

      {/* Node pulses when it's the current step */}
      {step.current && (
        <motion.div
          className="pulse-ring"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}
    </motion.div>
  ))}
</motion.div>
```

---

### 5.6 Card Animations (Group Buy List)

```tsx
// Staggered card entry on page load
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }}
  initial="hidden"
  animate="show"
>
  {groupBuys.map((buy) => (
    <motion.div
      key={buy.id}
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        show: { opacity: 1, y: 0, scale: 1 }
      }}
      whileHover={{
        y: -8,
        scale: 1.02,
        boxShadow: '0 20px 60px rgba(16, 185, 129, 0.15)',
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      layout  // Smooth reorder animation when filtering
    >
      <GroupBuyCard data={buy} />
    </motion.div>
  ))}
</motion.div>
```

---

### 5.7 Landing Page Scroll Animations (GSAP)

```tsx
// Hero section parallax + reveal
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

useEffect(() => {
  gsap.registerPlugin(ScrollTrigger);

  // Hero text reveals word by word
  gsap.from('.hero-word', {
    y: 100,
    opacity: 0,
    stagger: 0.08,
    duration: 0.8,
    ease: 'power3.out'
  });

  // How-it-works section — steps fly in from sides
  gsap.from('.step-card', {
    scrollTrigger: { trigger: '.how-it-works', start: 'top 80%' },
    x: (i) => (i % 2 === 0 ? -100 : 100),
    opacity: 0,
    stagger: 0.2,
    duration: 0.8,
    ease: 'back.out(1.7)'
  });

  // Stats counter animates when scrolled into view
  gsap.from('.stat-number', {
    scrollTrigger: { trigger: '.stats-section', start: 'top 85%' },
    textContent: 0,
    duration: 2,
    snap: { textContent: 1 },
    ease: 'power1.out'
  });

  // Floating elements (decorative coins, shields)
  gsap.to('.floating-coin', {
    y: -20,
    rotation: 15,
    duration: 3,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut'
  });
}, []);
```

---

### 5.8 Notification Animations

```tsx
// Toast notification with physics
<AnimatePresence>
  {toasts.map((toast) => (
    <motion.div
      key={toast.id}
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 200, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) dismissToast(toast.id);
      }}
    >
      <ToastContent {...toast} />
    </motion.div>
  ))}
</AnimatePresence>
```

---

### 5.9 Skeleton Loading States (Shimmer)

No spinners. Everything has a content-shaped skeleton with a shimmer wave:

```tsx
// Shimmer animation
<div className="animate-pulse space-y-4">
  <div className="h-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 
       bg-[length:200%_100%] animate-shimmer rounded-xl" />
  <div className="h-4 w-3/4 bg-gray-200 rounded animate-shimmer" />
  <div className="h-4 w-1/2 bg-gray-200 rounded animate-shimmer" />
</div>

// tailwind.config.ts
animation: {
  shimmer: 'shimmer 2s infinite linear',
},
keyframes: {
  shimmer: {
    '0%': { backgroundPosition: '200% 0' },
    '100%': { backgroundPosition: '-200% 0' },
  },
},
```

---

### 5.10 Gesture Animations (Mobile)

```tsx
// Swipe to confirm delivery (mobile)
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.1}
  onDragEnd={(_, info) => {
    if (info.offset.x > 150) {
      triggerConfirmDelivery();
    }
  }}
  style={{ x: dragX }}
>
  <div className="relative overflow-hidden rounded-xl">
    {/* Background reveal (green checkmark) */}
    <motion.div
      className="absolute inset-0 bg-emerald-500 flex items-center justify-end pr-6"
      style={{ opacity: dragProgress }}
    >
      <CheckIcon className="w-8 h-8 text-white" />
    </motion.div>

    {/* Card content */}
    <OrderCard />

    {/* Swipe hint arrow */}
    <motion.div
      animate={{ x: [0, 10, 0] }}
      transition={{ repeat: Infinity, duration: 1.5 }}
      className="absolute right-4 top-1/2"
    >
      <ChevronRight />
    </motion.div>
  </div>
</motion.div>
```

---

### 5.11 Animation Performance Rules

| Rule | Why |
|------|-----|
| Only animate `transform` and `opacity` | GPU-accelerated, no layout thrashing |
| Use `will-change: transform` sparingly | Signals browser to optimize, but uses memory |
| `prefers-reduced-motion` media query | Respect accessibility — disable animations for users who need it |
| Lazy-load Lottie/Rive files | Don't block initial page load |
| Max 60fps target, throttle on low-end | Use `navigator.hardwareConcurrency` to detect |
| No animation longer than 3 seconds | Users lose attention after 3s — keep it snappy |

```tsx
// Respect reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const animationConfig = prefersReducedMotion
  ? { duration: 0 }
  : { type: 'spring', stiffness: 300, damping: 20 };
```

---

### 5.12 Required Animation Assets

| Asset | Format | Source | Purpose |
|-------|--------|--------|---------|
| Escrow vault | .riv | Custom (Rive) | Central escrow visualization |
| Confetti | JS library | canvas-confetti | Celebration moments |
| Coin drop | .json (Lottie) | LottieFiles / custom | Deposit success |
| Checkmark burst | .json (Lottie) | LottieFiles / custom | Confirmation success |
| Shield glow | .json (Lottie) | Custom | Trust/security indicator |
| Loading coins | .json (Lottie) | LottieFiles | Transaction pending |
| Onboarding slides | .json (Lottie) | Custom | First-time user walkthrough |
| Empty state | .json (Lottie) | LottieFiles | No orders yet |
| Error/sad face | .json (Lottie) | LottieFiles | Failed transaction |

---

### 5.13 Package Dependencies for Animation

```json
{
  "dependencies": {
    "framer-motion": "^11.0.0",
    "@rive-app/react-canvas": "^4.0.0",
    "lottie-react": "^2.4.0",
    "gsap": "^3.12.0",
    "@react-spring/web": "^9.7.0",
    "canvas-confetti": "^1.9.0"
  }
}
```

---

## 6. Mobile-Specific UX

```
Bottom Navigation Bar (thumb-friendly):
┌────────────────────────────────────┐
│  🏠 Home  🔍 Explore  💼 My Orders  👤 Profile │
└────────────────────────────────────┘
```

- **Swipe gestures**: Swipe right on order card to confirm delivery
- **Pull-to-refresh**: Update order statuses
- **Bottom sheets**: Transaction details, wallet actions
- **Haptic feedback**: On successful transactions (if PWA)
- **Installable PWA**: Add to home screen prompt after 2nd visit

---

## Part 2: Supabase Integration Plan

---

## 7. Why Supabase?

The smart contract handles money and state on-chain, but it doesn't store:
- Group buy titles, descriptions, images
- User display names and avatars
- Chat messages between buyers and organizers
- Notification preferences
- Search/browse indexes

Supabase fills this gap as the off-chain data layer.

---

## 8. Database Schema

### Tables

```sql
-- User profiles (linked to Stellar address)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stellar_address TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  trust_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group buy metadata (off-chain details for the on-chain contract)
CREATE TABLE group_buys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL,              -- Soroban contract address
  organizer_address TEXT NOT NULL,        -- Stellar public key
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,                          -- 'skincare', 'food', 'electronics', etc.
  price_per_slot BIGINT NOT NULL,         -- in stroops
  max_slots INTEGER,
  token_address TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',           -- 'active', 'in_progress', 'completed', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer participation records
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID REFERENCES group_buys(id),
  buyer_address TEXT NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT DEFAULT 'deposited',        -- mirrors on-chain: 'deposited', 'delivered', 'confirmed', 'refunded'
  tx_hash TEXT,                           -- deposit transaction hash
  deposited_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE(group_buy_id, buyer_address)
);

-- Chat messages per group buy
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID REFERENCES group_buys(id),
  sender_address TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  type TEXT NOT NULL,                     -- 'push', 'email'
  endpoint TEXT,                          -- push subscription or email
  enabled BOOLEAN DEFAULT TRUE
);

-- Event log (synced from on-chain events)
CREATE TABLE contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL,
  event_type TEXT NOT NULL,               -- 'deposit', 'deliver', 'release', 'refund'
  buyer_address TEXT NOT NULL,
  amount BIGINT,
  tx_hash TEXT,
  ledger_timestamp BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Users can only edit their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (stellar_address = current_setting('app.user_address'));

-- Anyone can read group buys
CREATE POLICY "Public read group_buys" ON group_buys
  FOR SELECT USING (true);

-- Only organizer can update their group buy
CREATE POLICY "Organizer updates own group_buy" ON group_buys
  FOR UPDATE USING (organizer_address = current_setting('app.user_address'));

-- Messages visible to group buy participants
CREATE POLICY "Participants read messages" ON messages
  FOR SELECT USING (
    group_buy_id IN (
      SELECT group_buy_id FROM participants
      WHERE buyer_address = current_setting('app.user_address')
    )
    OR group_buy_id IN (
      SELECT id FROM group_buys
      WHERE organizer_address = current_setting('app.user_address')
    )
  );
```

---

## 9. Supabase ↔ Smart Contract Sync Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Frontend   │────▶│  Soroban     │────▶│  Stellar RPC     │
│  (Next.js)  │     │  Contract    │     │  (Events)        │
└──────┬──────┘     └──────────────┘     └────────┬─────────┘
       │                                           │
       │  Write metadata                           │  Poll events
       ▼                                           ▼
┌─────────────┐                           ┌──────────────────┐
│  Supabase   │◀──────────────────────────│  Event Syncer    │
│  (Postgres) │                           │  (Edge Function) │
└─────────────┘                           └──────────────────┘
```

### Sync Strategy

**When organizer creates a group buy:**
1. Frontend calls `initialize` on the smart contract
2. On success, frontend writes metadata to Supabase `group_buys` table
3. Contract ID is stored in the Supabase row

**When buyer deposits:**
1. Frontend calls `deposit` on the contract
2. On success, frontend upserts into `participants` table with tx_hash
3. Supabase Realtime notifies the organizer's dashboard

**Background event syncer (Supabase Edge Function, runs every 30s):**
```typescript
// supabase/functions/sync-events/index.ts
import { createClient } from '@supabase/supabase-js';

const RPC_URL = 'https://soroban-testnet.stellar.org:443';

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get last synced ledger
  const { data: lastEvent } = await supabase
    .from('contract_events')
    .select('ledger_timestamp')
    .order('ledger_timestamp', { ascending: false })
    .limit(1)
    .single();

  // Fetch new events from Stellar RPC
  const response = await fetch(RPC_URL, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getEvents',
      params: {
        startLedger: lastEvent?.ledger_timestamp || 0,
        filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }]
      }
    })
  });

  const events = await response.json();

  // Upsert into Supabase
  for (const event of events.result.events) {
    await supabase.from('contract_events').upsert({
      contract_id: CONTRACT_ID,
      event_type: decodeEventType(event.topic),
      buyer_address: decodeAddress(event.topic[1]),
      amount: decodeAmount(event.value),
      tx_hash: event.txHash,
      ledger_timestamp: event.ledger
    });

    // Also update participants table status
    await supabase.from('participants')
      .update({ status: decodeEventType(event.topic) })
      .eq('buyer_address', decodeAddress(event.topic[1]));
  }

  return new Response('OK');
});
```

---

## 10. Authentication with Supabase (Wallet-Based)

No passwords. Auth flow:

```
1. User connects Freighter → get public key
2. Frontend requests a challenge nonce from Supabase Edge Function
3. User signs the nonce with Freighter
4. Frontend sends signature + public key to Supabase Edge Function
5. Edge Function verifies signature → issues a Supabase JWT
6. Frontend uses JWT for all Supabase calls
```

### Edge Function: Verify Wallet Signature
```typescript
// supabase/functions/auth-wallet/index.ts
import { Keypair } from '@stellar/stellar-sdk';
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { publicKey, signature, nonce } = await req.json();

  // Verify the signature matches the public key
  const keypair = Keypair.fromPublicKey(publicKey);
  const isValid = keypair.verify(Buffer.from(nonce), Buffer.from(signature, 'base64'));

  if (!isValid) return new Response('Unauthorized', { status: 401 });

  // Issue a Supabase JWT with the stellar address as user ID
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: `${publicKey}@stellar.local`
  });

  // Upsert profile
  await supabase.from('profiles').upsert({
    stellar_address: publicKey
  }, { onConflict: 'stellar_address' });

  return new Response(JSON.stringify({ token: data.properties.hashed_token }));
});
```

---

## 11. Realtime Updates (Supabase Realtime)

```typescript
// In the organizer dashboard
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to participant changes for my group buy
supabase
  .channel('my-group-buy')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'participants',
    filter: `group_buy_id=eq.${groupBuyId}`
  }, (payload) => {
    // Update UI in real-time when a buyer deposits or confirms
    updateParticipantsList(payload.new);
    showToast(`${payload.new.buyer_address} just joined!`);
  })
  .subscribe();
```

---

## 12. Supabase Storage (Images)

```typescript
// Upload group buy cover image
const { data, error } = await supabase.storage
  .from('group-buy-images')
  .upload(`${groupBuyId}/cover.jpg`, file, {
    cacheControl: '3600',
    upsert: true
  });

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('group-buy-images')
  .getPublicUrl(`${groupBuyId}/cover.jpg`);
```

---

## 13. Full Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                        USER ACTION                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js)                                         │
│                                                             │
│  1. Build Soroban transaction                               │
│  2. Sign with Freighter                                     │
│  3. Submit to Stellar RPC                                   │
│  4. On success → Write metadata to Supabase                 │
│  5. UI updates via Supabase Realtime subscription           │
└───────┬────────────────────────────────┬────────────────────┘
        │                                │
        ▼                                ▼
┌───────────────┐              ┌──────────────────┐
│  Stellar      │              │  Supabase        │
│  Blockchain   │              │                  │
│               │              │  • Postgres DB   │
│  • Contract   │◀── sync ──▶ │  • Edge Functions│
│  • Ledger     │              │  • Realtime      │
│  • Events     │              │  • Storage       │
└───────────────┘              └──────────────────┘

ON-CHAIN (source of truth):     OFF-CHAIN (UX layer):
• Funds                          • Titles, descriptions
• Order status                   • Images
• Authorization                  • Chat messages
• Deadlines                      • Notifications
• Events                         • Search index
```

---

## 14. Key Takeaway

**On-chain = Money & Trust.** The smart contract is the source of truth for funds, status, and authorization. Never trust off-chain data for financial decisions.

**Off-chain = Experience.** Supabase makes the app feel like Shopee — titles, images, chat, notifications, profiles. If Supabase goes down, the money is still safe on Stellar.

This separation means users get an engaging e-commerce-like experience while their funds are protected by the immutable smart contract.

---

## 15. Pasabuy Management Enhancements — UI Surfaces

The surfaces below were introduced by the `pasabuy-management-enhancements` spec. They layer onto the existing routes from Section 4 without changing the visual system from Sections 2 and 5.

---

### 15.1 PasabuyDetailPage — `/pasabuy/[id]`

The public detail page is the shared read-only landing for a single group buy. It is a client component and renders without a connected wallet — Freighter is only prompted when the user activates the join CTA. The page is a four-state machine: `loading`, `not_found`, `error`, and `ready`.

**Layout**

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back to Explore]                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────────┐   Korean Skincare Bundle             │
│   │                  │   Skincare → Korean                  │
│   │   [Cover image   │                                      │
│   │    or placeholder]│  ₱850 / slot  (≈ 30.0000000 XLM)    │
│   │                  │   ▓▓▓▓▓▓▓▓░░  8 / 12 slots filled    │
│   │                  │   ⏰ Deadline: Jul 15, 2026 7:00 PM   │
│   └──────────────────┘   📍 Quezon City                     │
│                          🚚 Meetup at SM North              │
│                          Organizer: Maria S. (GAB…VVH6)     │
│                                                             │
│   Description                                               │
│   Full description text rendered as prose…                  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [Join this pasabuy →]                              │   │
│   │   (or: View my order  /  Cancelled by organizer)    │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**States and copy**

- **Loading.** Skeleton blocks fill the image, title, body, and CTA areas. The page must not render `"Pasabuy not found"` or the error message during loading.
- **Not found.** Renders the page shell with the literal `"Pasabuy not found"` and a link `Back to Explore` pointing at `/explore`.
- **Error.** Renders `"Could not load pasabuy details. Try again."` next to a retry control that re-runs both queries (group_buy + slot count) without a full page reload.
- **Ready.** Renders `title`, `description`, `category` + `subcategory`, the cover image (with a placeholder fallback for null or failed `image_url`), `price_per_slot` shown in both XLM (7 decimals) and PHP via `useExchangeRate`, `max_slots` with a joined-count progress bar, the `deadline` in the viewer's local timezone, `location`, `shipping_method`, `meetup_info`, and the organizer line — display name followed by the truncated address in `4…4` form.

**CTA behavior**

- If the connected wallet already has a `participants` row for this pasabuy, the CTA reads `View my order` and routes to `/dashboard/buyer/{id}`.
- Otherwise the CTA reads `Join this pasabuy` and is gated by `computeJoinability(group_buy, joinedCount, now)`. When the helper returns `{ joinable: false; reason }`, the button is replaced by a disabled chip carrying the reason verbatim using the precedence ladder: `Cancelled by organizer` → `Deadline passed` → `Slots full` → `No longer accepting joins`.
- Clicking `Join this pasabuy` without a connected wallet prompts Freighter first; once connected, `JoinForm` is rendered. The page itself never blocks reads on the wallet.

---

### 15.2 JoinForm

The join form is the only entry point that writes the four per-order delivery fields. It is opened from `PasabuyDetailPage` (modal or inline section) and follows a **deposit-then-insert** order — a `participants` row is never created until the on-chain `deposit` is confirmed.

**Layout**

```
┌─────────────────────────────────────────────────────┐
│  Join: Korean Skincare Bundle                       │
│  ₱850 / slot                                        │
├─────────────────────────────────────────────────────┤
│  Full name *                                        │
│  [_________________________________________]        │
│  Enter a name between 1 and 100 characters.         │
│                                                     │
│  Contact number (PH) *                              │
│  [_________________________________________]        │
│  Enter a valid Philippine phone number.             │
│                                                     │
│  Delivery location *                                │
│  [_________________________________________]        │
│  Enter a delivery location between 1 and 250        │
│  characters.                                        │
│                                                     │
│  Notes for the organizer (optional)                 │
│  [                                          ]       │
│  [                                          ]       │
│  Notes must be 500 characters or fewer.             │
│                                                     │
│  [Pay ₱850 and join →]                              │
└─────────────────────────────────────────────────────┘
```

**Fields and validation**

All four inputs initialize as empty strings — values are never pre-filled from the profile, to avoid stale cross-pasabuy data. Validation runs on submit and reactively for already-touched fields. The exact required messages are:

- `buyer_name` — `"Enter a name between 1 and 100 characters."`
- `buyer_contact` — `"Enter a valid Philippine phone number."` (regex `^(\+63|0)[0-9 \-]{7,14}$`)
- `buyer_location` — `"Enter a delivery location between 1 and 250 characters."`
- `buyer_note` — `"Notes must be 500 characters or fewer."`

These strings live in `src/lib/utils/validation.ts` so the form, the DB CHECK constraints, and the docs share one source.

**Submit button**

The button label includes the PHP price (`Pay ₱{price} and join`). It is disabled whenever the form phase is `validating`, `depositing`, or `recording`, and re-enabled on any error completion so the user can retry without re-typing.

**Phase animations**

Phases follow the same vocabulary as Section 5.4:

- `idle → validating`: field-level error messages fade in next to offending inputs.
- `validating → depositing`: button morphs into the loading state (spinner, then "Waiting for Freighter…").
- `depositing → recording`: progress bar advances; copy switches to `"Sending to Stellar…"` then `"Saving your order…"`.
- `recording → success`: brief checkmark burst (Lottie), then route to `/dashboard/buyer/{groupBuyId}`.
- Any error returns the form to `idle` with the user's values intact and the mapped error from `mapSorobanError` rendered above the submit button.

---

### 15.3 ParticipantList

Renders the organizer-only roster of buyers for a single pasabuy, including the protected contact columns. The strict RLS policy on `participants` ensures only the organizer and the buyer themself see their own contact fields; this component is what surfaces those fields to the organizer.

**Per-row layout**

```
┌─────────────────────────────────────────────────────────────────┐
│ GAB…VVH6  ·  Maria Santos                                       │
│ 📞 0917-555-1234  [📋 Copy]   📍 Quezon City, QC                │
│ Note: Please pack with bubble wrap.                             │
│ 30.0000000 XLM (₱850)  ·  Status: Deposited                     │
│                                              [Mark Delivered]   │
└─────────────────────────────────────────────────────────────────┘
```

**Field rendering rules**

- Truncated buyer address renders as `4…4` (e.g., `GAB…VVH6`) and is the row anchor.
- When a single contact field (`buyer_name`, `buyer_contact`, `buyer_location`, `buyer_note`) is null, the cell renders the literal em-dash `"—"`.
- When **all four** contact fields are null on the same row, the four cells collapse into one and render the summary message `"No contact information provided"`.

**Copy-to-clipboard**

Adjacent to a non-null `buyer_contact`, a small copy-icon button is rendered. Clicking calls `navigator.clipboard.writeText(buyer_contact)`:

- Success → toast `"Copied"` for 2000 ms.
- Failure → error toast for 3000 ms; the `"Copied"` toast is suppressed.

The copy button is hidden entirely when `buyer_contact` is null.

**MarkDeliveredButton placement**

The `Mark Delivered` action is anchored to the row's right edge and is rendered only when `status === 'deposited'`. While `actioningBuyer === buyer_address` the button is disabled and shows a spinner; on error completion the button is re-enabled so the organizer can retry.

---

### 15.4 TransactionHistory

The organizer section that aggregates on-chain `contract_events` with the three off-chain synthesized streams (`participant_joined`, `order_cancelled`, `pasabuy_cancelled`) into one timeline. It is a three-state component: `loading`, `error`, `ready` — where `ready` further branches into empty and non-empty.

**Section layout**

```
┌─ Transaction history ─────────────────────────────┐
│                                                   │
│  Deposit       GAB…VVH6   30.00 XLM  ₱850         │
│                tx 9f3a…b21c  · Jul 02, 7:14 PM    │
│                                                   │
│  Mark delivered  GAB…VVH6  —          —           │
│                tx 4c81…0e99  · Jul 05, 9:02 AM    │
│                                                   │
│  Confirm delivery  GAB…VVH6  30.00 XLM  ₱850      │
│                tx 1d6c…77f0  · Jul 06, 11:42 AM   │
│                                                   │
│  Participant joined  GAB…VVH6  —          —       │
│                —          · Jul 02, 7:14 PM       │
└───────────────────────────────────────────────────┘
```

**States and copy**

- **Section header.** Reads `Transaction history`. The header is always visible (loading, error, empty, and ready all keep it on screen).
- **Loading.** Skeleton rows fill the body. The empty message `"No transactions yet."` and the error message are not shown during loading.
- **Error.** Renders the container, the message `"Could not load transaction history"`, and a `Retry` control that calls `useTransactionHistory.retry()` without a full page reload.
- **Empty (ready, zero rows).** Renders `"No transactions yet."` centered in the section.
- **Ready (non-empty).** Renders rows in the deterministic order from `compareHistoryEntries` (timestamp DESC nullsLast, then by event-type tiebreak).

**Row layout**

Each row shows, in order:

1. **Event type** label — one of `Deposit`, `Mark delivered`, `Confirm delivery`, `Refund`, `Participant joined`, `Order cancelled`, `Pasabuy cancelled`.
2. **Actor address** — truncated `4…4` (e.g., `GAB…VVH6`).
3. **Amount** — XLM to 7 decimals + PHP equivalent via `useExchangeRate` (60 s cache). Off-chain entries render `—`.
4. **Tx hash** — truncated `6…6` rendered as `<a href="${STELLAR_EXPERT_URL}/tx/${tx_hash}" target="_blank" rel="noopener noreferrer">`. Off-chain entries render `—` for the hash column.
5. **Timestamp** — ISO 8601 in the viewer's local timezone.

---

### 15.5 CancelOrderDialog

The buyer-side cancel confirmation. The dialog is only opened when the signed-in buyer's row has `status === 'deposited'`. Its body forks on whether the pasabuy's deadline has passed.

**Pre-deadline branch**

```
┌─────────────────────────────────────────────────┐
│  Cancel your order?                             │
├─────────────────────────────────────────────────┤
│  Funds will not be released until the deadline. │
│  You can return after the deadline to claim     │
│  your refund.                                   │
│                                                 │
│  [Keep order]   [Cancel order]                  │
└─────────────────────────────────────────────────┘
```

On confirm, no on-chain call is made. The dialog writes `participants.status='cancelled'`, `cancelled_at=now()`, `refund_required=TRUE` and closes. The buyer page surfaces a banner telling them to return after the deadline to claim the refund.

**Post-deadline branch**

```
┌─────────────────────────────────────────────────┐
│  Refund your order                              │
├─────────────────────────────────────────────────┤
│  The deadline has passed. Confirm to send the   │
│  refund transaction on Stellar.                 │
│                                                 │
│  Amount: 30.0000000 XLM (₱850)                  │
│  Returns to: GAB…VVH6                           │
│                                                 │
│  [Back]   [Confirm refund]                      │
└─────────────────────────────────────────────────┘
```

`Confirm refund` invokes `invokeContractWithStatus('refund', [buyer], publicKey)`. On confirmed success the dialog writes `status='refunded'`, `refunded_at=now()`, `refund_required=FALSE`, `tx_hash_confirm=<hash>` and inserts a `contract_events` row of type `refund`. Errors are surfaced via `mapSorobanError(err, 'refund')`. The confirm button is disabled while in flight and re-enabled on error.

---

### 15.6 CancelPasabuyDialog

The organizer-side cancel confirmation. The dialog computes a `CancellationGate` from the current participants and renders one of four branches.

**Branch 1 — `allowed_simple` (zero deposited or delivered participants)**

```
┌─────────────────────────────────────────────────┐
│  Cancel this pasabuy?                           │
├─────────────────────────────────────────────────┤
│  No one has joined yet. Cancelling will remove  │
│  this pasabuy from Explore.                     │
│                                                 │
│  [Keep pasabuy]   [Cancel pasabuy]              │
└─────────────────────────────────────────────────┘
```

On confirm, calls the `cancel_group_buy` RPC; the pasabuy's status flips to `cancelled` with `cancelled_at` and `cancelled_by` populated.

**Branch 2 — `allowed_with_refund`, post-deadline**

```
┌─────────────────────────────────────────────────┐
│  Cancel this pasabuy?                           │
├─────────────────────────────────────────────────┤
│  These buyers can claim their refund on-chain:  │
│                                                 │
│   • GAB…VVH6                                    │
│   • GCD…M4Z2                                    │
│   • GEF…7QXP                                    │
│                                                 │
│  [Keep pasabuy]   [Cancel pasabuy]              │
└─────────────────────────────────────────────────┘
```

On confirm, the RPC marks every affected `deposited` participant with `refund_required=TRUE`; each buyer's `Claim refund` button becomes active.

**Branch 3 — `allowed_with_refund`, pre-deadline**

```
┌─────────────────────────────────────────────────┐
│  Cancel this pasabuy?                           │
├─────────────────────────────────────────────────┤
│  Funds cannot be returned on-chain until the    │
│  deadline. Affected buyers will be marked so    │
│  they can claim a refund after the deadline.    │
│                                                 │
│  Affected buyers:                               │
│   • GAB…VVH6                                    │
│   • GCD…M4Z2                                    │
│                                                 │
│  ☐ I understand buyers cannot claim until the   │
│     deadline passes.                            │
│                                                 │
│  [Keep pasabuy]   [Cancel pasabuy]              │
└─────────────────────────────────────────────────┘
```

The `Cancel pasabuy` button stays disabled until the explicit confirmation checkbox is ticked. On confirm, the same RPC path runs.

**Branch 4 — `blocked_has_delivered`**

```
┌─────────────────────────────────────────────────┐
│  Can't cancel right now                         │
├─────────────────────────────────────────────────┤
│  This pasabuy has orders marked delivered.      │
│  Wait for buyers to confirm or refund before    │
│  cancelling.                                    │
│                                                 │
│                                       [Close]   │
└─────────────────────────────────────────────────┘
```

The branch renders only the error message and a `Close` button; no mutation runs. The error copy matches the spec verbatim.

---

### 15.7 ClaimRefundButton

A buyer-side button distinct from the pre-existing `RefundButton`. It surfaces only the post-cancellation, post-deadline claim path so the visibility predicate is easy to reason about.

**Visibility predicate**

The button is rendered if and only if all three of the following hold for the signed-in buyer's `participants` row:

- `status === 'cancelled'`
- `refund_required === true`
- `deadline <= now()` (i.e., the deadline has passed)

When `refund_required === true` but the deadline is still in the future, the buyer page replaces the button with a banner telling the buyer to return after the deadline.

**Button copy and behavior**

The button label reads `Claim refund`. Clicking it invokes `invokeContractWithStatus('refund', [buyer], publicKey)`. On confirmed success, the row is updated to `status='refunded'`, `refund_required=FALSE`, `refunded_at=now()`, `tx_hash_confirm=<hash>` and a `contract_events` row of type `refund` is inserted. Errors are routed through `mapSorobanError(err, 'refund')`, with `Error(Contract, #6)` mapping to `"Refund is not yet available. Try again after the deadline."` and `Error(Contract, #4)` mapping to `"No deposit found for this order. It may have already been refunded."`. The button is disabled while the call is in flight and re-enabled on error.

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  User,
  Phone,
  Calendar,
  Users,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Link as LinkIcon,
  Save,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useWallet } from '@/lib/hooks/useWallet';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { truncateAddress } from '@/lib/utils/format';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  stellar_address: string | null;
  trust_score: number;
  total_buys: number;
  total_organized: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { publicKey, isConnected } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setDisplayName(data.display_name || '');
        setAge(data.age?.toString() || '');
        setGender(data.gender || '');
        setPhone(data.phone || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
    }
    fetchProfile();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSuccess('');
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        display_name: displayName,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        phone: phone || null,
        bio: bio || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess('Profile saved!');
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }

  async function linkWallet() {
    if (!publicKey || !profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        stellar_address: publicKey,
        wallet_linked_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
    if (error) setError(error.message);
    else {
      setProfile({ ...profile, stellar_address: publicKey });
      setSuccess('Wallet linked successfully!');
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-600">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Edit Profile</h1>
          <p className="text-slate-500 mt-1">Update your information and avatar</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 border border-slate-100"
          >
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ImageUpload
                bucket="avatars"
                folder={profile.id}
                currentUrl={avatarUrl}
                onUploaded={setAvatarUrl}
                label="Upload avatar"
                maxSizeMB={2}
                shape="circle"
              />
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-slate-900">{fullName || 'Your name'}</h2>
                <p className="text-sm text-slate-500 mt-1">{profile.email}</p>
                <div className="flex gap-2 mt-3 flex-wrap justify-center sm:justify-start">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    ⭐ Trust score: {profile.trust_score}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">
                    🛍️ {profile.total_buys} buys
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    🎯 {profile.total_organized} organized
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Personal Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-6 border border-slate-100 space-y-4"
          >
            <h3 className="font-semibold text-slate-900 mb-4">Personal Information</h3>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1.5 block flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1.5 block">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1.5 block flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Age
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  min={13}
                  max={120}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1.5 block flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1.5 block flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 mb-1.5 block flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Email (read-only)
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 mb-1.5 block">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell people about yourself..."
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900 placeholder:text-slate-400 resize-none"
              />
            </div>
          </motion.div>

          {/* Wallet Linking */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-6 border border-slate-100"
          >
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-yellow-600" />
              Stellar Wallet
            </h3>
            <p className="text-sm text-slate-500 mb-4">Link your Freighter wallet to make on-chain transactions</p>

            {profile.stellar_address ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-900">Wallet linked</p>
                  <p className="text-xs font-mono text-emerald-700 truncate">{profile.stellar_address}</p>
                </div>
              </div>
            ) : isConnected && publicKey ? (
              <button
                type="button"
                onClick={linkWallet}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-xl font-medium text-sm transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
                Link {truncateAddress(publicKey)}
              </button>
            ) : (
              <p className="text-sm text-amber-600">Connect your Freighter wallet first using the header button</p>
            )}
          </motion.div>

          {/* Messages */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-700">{success}</p>
            </motion.div>
          )}

          {/* Save button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={saving}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Profile</>}
          </motion.button>

          {/* Sign out */}
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="w-full text-red-600 hover:bg-red-50 border border-red-200 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </motion.div>
    </div>
  );
}

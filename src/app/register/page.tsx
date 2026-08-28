'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  School, 
  Phone, 
  Mail, 
  Crown, 
  Sparkles, 
  ArrowLeft, 
  Loader2, 
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { registerSchema, RegisterInput } from '@/lib/schemas';
import { EVENT_CONFIG } from '@/config/event';

export default function Register() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [portalClosed, setPortalClosed] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Photo uploading states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // 1. Check registration portal status on mount
  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setPortalClosed(!res.data.open);
        }
      })
      .catch(err => console.error('Error reading portal status:', err))
      .finally(() => setCheckingStatus(false));
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type.toLowerCase())) {
      setPhotoError('Please select a valid image file (JPG, JPEG, or PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress using Canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); // Compress to 70% quality JPEG
          setPhotoPreview(compressedBase64);
          setPhotoBase64(compressedBase64);
          setPhotoMimeType('image/jpeg');
          setValue('photo_path', 'prepared');
          setPhotoError(null);
        } else {
          // Fallback if canvas context fails
          setPhotoPreview(event.target?.result as string);
          setPhotoBase64(event.target?.result as string);
          setPhotoMimeType(file.type);
          setValue('photo_path', 'prepared');
          setPhotoError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 2. Initialize React Hook Form with Zod Resolver
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      school_name: "School of Computing and Artificial Intelligence",
      modeling: "No",
      photo_path: "",
    }
  });

  // 3. Handle Form Submission
  const onSubmit = async (data: RegisterInput) => {
    if (!photoBase64) {
      setPhotoError('Please upload your photo before checking out.');
      return;
    }

    setSubmitting(true);
    setServerError(null);
    setPhotoUploading(true);

    try {
      // 1. Upload photo to secure storage bucket
      const uploadResponse = await fetch('/api/register/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: photoBase64,
          mimeType: photoMimeType
        })
      });

      const uploadRes = await uploadResponse.json();
      setPhotoUploading(false);

      if (!uploadResponse.ok || !uploadRes.success) {
        setServerError(uploadRes.error?.message || 'Failed to upload photo. Please try again.');
        setSubmitting(false);
        return;
      }

      const photoPath = uploadRes.data.photo_path;

      // 2. Submit registration
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          photo_path: photoPath
        }),
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        setServerError(res.error?.message || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      // Success: Redirect to payment page with registration ID
      const registrationId = res.data.id;
      router.push(`/payment?id=${registrationId}`);

    } catch (err) {
      console.error('Registration submission error:', err);
      setServerError('Network error. Please check your internet connection.');
      setSubmitting(false);
      setPhotoUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative">
      <div className="absolute top-[10%] left-[5%] w-[60px] h-[60px] bg-purple-500/10 rounded-full blur-lg animate-float-slow pointer-events-none" />
      
      {/* Back button and My Ticket link */}
      <div className="w-full max-w-2xl mb-6 flex justify-between items-center">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Event
        </Link>
        <Link 
          href="/my-ticket" 
          className="text-xs font-semibold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors"
        >
          My Ticket
        </Link>
      </div>


      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl glass-card rounded-2xl p-8 relative overflow-hidden"
      >
        {/* Glow border overlay */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        {checkingStatus ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Verifying Portal Status...</p>
          </div>
        ) : portalClosed ? (
          <div className="py-12 text-center flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="p-4 rounded-full bg-slate-800 border border-slate-700 text-slate-400 mb-6">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold font-outfit text-white mb-2">Registration Closed</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Registrations for <strong>ALGO-RHYTHM 2K26</strong> are currently closed. If you have any inquiries or have paid but did not receive a ticket, contact coordinators immediately.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider text-white"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-white font-outfit tracking-tight flex items-center gap-2">
                Register for <span className="text-gradient-purple-pink">ALGO-RHYTHM 2K26</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1">Complete your details to secure your entry ticket.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit, (errs) => console.warn('[Register] Form validation errors:', errs))} className="space-y-6">
              
              {/* Form Validation Alert */}
              {Object.keys(errors).length > 0 && !serverError && (
                <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex gap-3 items-center">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Please check the form: Some required fields are missing or invalid.</span>
                </div>
              )}

              {/* Server Error Message */}
              <AnimatePresence>
                {serverError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-3 items-start"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <span className="font-bold">Error:</span> {serverError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Registration Number */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block">Registration No. *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 122XXXXX"
                      className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors uppercase outline-none"
                      {...register('registration_number')}
                    />
                  </div>
                  {errors.registration_number && (
                    <p className="text-[10px] text-red-400 font-semibold">{errors.registration_number.message}</p>
                  )}
                </div>

                {/* 2. Full Name */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block">Full Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
                      {...register('full_name')}
                    />
                  </div>
                  {errors.full_name && (
                    <p className="text-[10px] text-red-400 font-semibold">{errors.full_name.message}</p>
                  )}
                </div>

                {/* 3. Year */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block">Year *</label>
                  <select
                    className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-slate-300 transition-colors outline-none cursor-pointer appearance-none"
                    {...register('year')}
                  >
                    <option value="" className="bg-[#0f0a24] text-slate-400">Select Year</option>
                    <option value="1st Year" className="bg-[#0f0a24] text-white">1st Year</option>
                    <option value="2nd Year" className="bg-[#0f0a24] text-white">2nd Year</option>
                  </select>
                  {errors.year && (
                    <p className="text-[10px] text-red-400 font-semibold">{errors.year.message}</p>
                  )}
                </div>

                {/* 4. Modeling Enrollment */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block flex items-center gap-1.5">
                    Enroll for Modeling? *
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                  </label>
                  <select
                    className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-slate-300 transition-colors outline-none cursor-pointer appearance-none"
                    {...register('modeling')}
                  >
                    <option value="No" className="bg-[#0f0a24] text-white">No</option>
                    <option value="Yes" className="bg-[#0f0a24] text-white">Yes</option>
                  </select>
                  {errors.modeling && (
                    <p className="text-[10px] text-red-400 font-semibold">{errors.modeling.message}</p>
                  )}
                </div>

                {/* 5. Phone Number */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block">Phone Number *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
                      {...register('phone')}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[10px] text-red-400 font-semibold">{errors.phone.message}</p>
                  )}
                </div>

                {/* 6. Email Address */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block">Email Address *</label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[10px] text-red-400 font-semibold">{errors.email.message}</p>
                  )}
                </div>

                {/* 7. School Name (Full Width spans 2 columns) */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block">School Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. School of Computing and Artificial Intelligence"
                      className="w-full bg-black/30 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors outline-none"
                      {...register('school_name')}
                    />
                  </div>
                  {errors.school_name && (
                    <p className="text-[10px] text-red-400 font-semibold">{errors.school_name.message}</p>
                  )}
                </div>

                {/* 8. Photo Upload Field */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-400 block">Upload Your Photo *</label>
                  <div className="relative">
                    {!photoPreview ? (
                      <div className="border-2 border-dashed border-white/10 hover:border-purple-500/30 rounded-xl p-6 transition-all text-center flex flex-col items-center justify-center gap-2 relative">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handlePhotoChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          required
                        />
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">Click or Drag to Upload Photo</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">JPG, JPEG, or PNG accepted</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center relative shrink-0">
                          <img
                            src={photoPreview}
                            alt="Student photo preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-center sm:text-left space-y-2">
                          <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-start">
                            <CheckCircle2 className="w-4 h-4" />
                            Photo Prepared Successfully
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoPreview(null);
                              setPhotoBase64(null);
                              setPhotoMimeType(null);
                              setValue('photo_path', '');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Remove / Replace Photo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {(photoError || errors.photo_path?.message) && (
                    <p className="text-[10px] text-red-400 font-semibold">{photoError || errors.photo_path?.message}</p>
                  )}
                </div>

              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <span className="text-[10px] text-slate-500 tracking-wider">Fields marked with (*) are mandatory | <a href="/admin/login" className="hover:text-slate-300 transition-colors">Staff Portal</a></span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 disabled:from-purple-800/50 disabled:to-pink-800/50 text-white font-bold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 transition-all outline-none text-xs uppercase tracking-wider cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Registration...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Proceed to Checkout
                    </>
                  )}
                </button>
              </div>

            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
export const dynamic = 'force-dynamic';

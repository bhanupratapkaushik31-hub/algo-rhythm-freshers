'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  CreditCard, 
  Users, 
  Crown, 
  Music, 
  Gamepad2, 
  Gift, 
  Sparkles, 
  Utensils, 
  PlusCircle, 
  Phone,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EVENT_CONFIG } from '@/config/event';

export default function Home() {
  const [isRegOpen, setIsRegOpen] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isEventStarted, setIsEventStarted] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Live Countdown Timer Logic
  useEffect(() => {
    const targetDate = new Date(EVENT_CONFIG.date).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setIsEventStarted(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setIsEventStarted(false);
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days: d, hours: h, minutes: m, seconds: s });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    // Fetch registration status
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setIsRegOpen(res.data.open);
        }
      })
      .catch(err => console.error('Error fetching settings:', err))
      .finally(() => setLoading(false));

    return () => clearInterval(interval);
  }, []);

  const scrollToInfo = () => {
    document.getElementById('explore-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
  };

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Dynamic Ambient Background Element */}
      <div className="absolute top-[20%] left-[5%] w-[80px] h-[80px] bg-purple-500/10 rounded-full blur-xl animate-float-slow hidden md:block" />
      <div className="absolute top-[50%] right-[5%] w-[120px] h-[120px] bg-pink-500/10 rounded-full blur-2xl animate-float-medium hidden md:block" />

      {/* Subtle Floating Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex justify-between items-center relative z-20">
        <Link href="/" className="font-extrabold tracking-wide text-lg text-gradient-indigo-purple font-outfit select-none">
          ALGO-RHYTHM
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition-colors">
            Home
          </Link>
          {isRegOpen && (
            <Link href="/register" className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition-colors">
              Register
            </Link>
          )}
          <Link href="/my-ticket" className="text-xs font-semibold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors">
            My Ticket
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 pt-16 pb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          {/* Tagline Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-950/20 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {EVENT_CONFIG.hostedBy}
          </motion.div>

          {/* Large Event Title */}
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-2 font-outfit select-none">
            <span className="text-gradient-indigo-purple drop-shadow-md">ALGO</span>
            <span className="text-[#f8fafc]">-</span>
            <span className="text-gradient-purple-pink drop-shadow-md">RHYTHM</span>
          </h1>

          <p className="text-2xl md:text-3xl font-semibold tracking-wide text-purple-200 mb-6 font-outfit">
            CSE Fresher Party 2026 🎉
          </p>

          <p className="text-lg md:text-xl text-slate-300 max-w-xl mx-auto mb-10 leading-relaxed font-light">
            {EVENT_CONFIG.tagline}
            <br />
            {EVENT_CONFIG.description}
          </p>

          {/* CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            {isRegOpen ? (
              <Link 
                href="/register" 
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full shadow-lg hover:shadow-purple-500/20 transform hover:-translate-y-0.5 transition-all duration-200 text-sm tracking-wider uppercase"
              >
                Register Now — ₹{EVENT_CONFIG.registrationFee}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <div className="px-8 py-4 bg-slate-800 border border-slate-700 text-slate-400 font-bold rounded-full text-sm tracking-wider uppercase">
                Registrations Closed
              </div>
            )}
            
            <button 
              onClick={scrollToInfo}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-[#f8fafc] font-semibold rounded-full hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-sm tracking-wider uppercase"
            >
              Explore Event
            </button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.button
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          onClick={scrollToInfo}
          className="absolute bottom-6 p-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.button>
      </section>

      {/* Countdown Timer Section */}
      <section className="py-12 bg-black/30 border-y border-white/5 relative">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-6 font-semibold">
            {isEventStarted ? "Status" : "Countdown to Algorithmic Beats"}
          </h3>

          <AnimatePresence mode="wait">
            {isEventStarted ? (
              <motion.div
                key="started"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-2xl md:text-3xl font-extrabold font-outfit text-gradient-purple-pink py-4 tracking-wider uppercase"
              >
                THE EVENT HAS STARTED 🎉
              </motion.div>
            ) : (
              <motion.div
                key="timer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-4 gap-4 md:gap-8 max-w-xl mx-auto"
              >
                {/* Days */}
                <div className="flex flex-col items-center p-3 md:p-4 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                  <span className="text-3xl md:text-5xl font-bold font-outfit text-[#f8fafc] tracking-tight">{timeLeft.days}</span>
                  <span className="text-[10px] md:text-xs uppercase text-slate-400 mt-1 font-semibold">Days</span>
                </div>
                {/* Hours */}
                <div className="flex flex-col items-center p-3 md:p-4 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                  <span className="text-3xl md:text-5xl font-bold font-outfit text-[#f8fafc] tracking-tight">{timeLeft.hours}</span>
                  <span className="text-[10px] md:text-xs uppercase text-slate-400 mt-1 font-semibold">Hours</span>
                </div>
                {/* Minutes */}
                <div className="flex flex-col items-center p-3 md:p-4 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                  <span className="text-3xl md:text-5xl font-bold font-outfit text-[#f8fafc] tracking-tight">{timeLeft.minutes}</span>
                  <span className="text-[10px] md:text-xs uppercase text-slate-400 mt-1 font-semibold">Mins</span>
                </div>
                {/* Seconds */}
                <div className="flex flex-col items-center p-3 md:p-4 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                  <span className="text-3xl md:text-5xl font-bold font-outfit text-[#f8fafc] tracking-tight text-pink-500">{timeLeft.seconds}</span>
                  <span className="text-[10px] md:text-xs uppercase text-slate-400 mt-1 font-semibold">Secs</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Event Information Section */}
      <section id="explore-section" className="py-24 px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-outfit">Event Details</h2>
          <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full" />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* Card 1: Date */}
          <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="p-4 rounded-xl bg-purple-500/10 text-purple-400 mb-6">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Date</h3>
            <p className="text-lg font-bold font-outfit text-white">{EVENT_CONFIG.displayDate}</p>
          </motion.div>

          {/* Card 2: Time */}
          <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="p-4 rounded-xl bg-pink-500/10 text-pink-400 mb-6">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Time</h3>
            <p className="text-lg font-bold font-outfit text-white">{EVENT_CONFIG.displayTime}</p>
          </motion.div>

          {/* Card 3: Venue */}
          <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="p-4 rounded-xl bg-indigo-500/10 text-indigo-400 mb-6">
              <MapPin className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Venue</h3>
            <p className="text-lg font-bold font-outfit text-white leading-tight">{EVENT_CONFIG.venue}</p>
          </motion.div>

          {/* Card 4: Fee */}
          <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-bl-3xl border-b border-l border-amber-500/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-amber-500 font-outfit tracking-tighter">REQ</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 text-amber-500 mb-6 group-hover:scale-105 transition-transform duration-200">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Entry Fee</h3>
            <p className="text-lg font-bold font-outfit text-amber-500 text-gradient-gold">₹{EVENT_CONFIG.registrationFee}</p>
            <span className="text-[10px] text-amber-500/80 font-medium tracking-wide uppercase mt-1">Registration Mandatory</span>
          </motion.div>
        </motion.div>
      </section>

      {/* What to Expect Section */}
      <section className="py-24 px-4 bg-black/20 w-full relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-outfit">What To Expect</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto">Get ready for an adrenaline-fueled day of music, games, dance, and crown titles!</p>
            <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full mt-4" />
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* 1. Meet & Greet */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start">
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 mb-5">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit">Meet & Greet</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Break the ice and build connections with seniors and peers in our networking slots.</p>
            </motion.div>

            {/* 2. Pageant Titles */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start relative overflow-hidden">
              <div className="absolute top-2 right-2 text-amber-500/30 animate-pulse">
                <Crown className="w-16 h-16 rotate-12" />
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500 mb-5 relative z-10">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit relative z-10">Mr. & Ms. Fresher</h3>
              <p className="text-slate-400 text-sm leading-relaxed relative z-10">Showcase your charm and intelligence to grab the prestigious crowns and titles.</p>
            </motion.div>

            {/* 3. DJ Evening */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start">
              <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 mb-5">
                <Music className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit">DJ Evening</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Vibe to beats dropped by professional DJs, transforming the arena into a dance zone.</p>
            </motion.div>

            {/* 4. Games */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start">
              <div className="p-3 rounded-lg bg-pink-500/10 text-pink-400 mb-5">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit">Activities & Games</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Engage in rapid-fire challenges and team games to trigger laughter and friendly rivalries.</p>
            </motion.div>

            {/* 5. Goodies */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start">
              <div className="p-3 rounded-lg bg-red-500/10 text-red-400 mb-5">
                <Gift className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit">Goodies to Win</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Participate in audience tasks and quizzes to win cool custom merch and hampers.</p>
            </motion.div>

            {/* 6. Music & Dance */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start">
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 mb-5">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit">Music & Dance</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Watch special stage performances by CSE artists who are ready to light up the floor.</p>
            </motion.div>

            {/* 7. Refreshments */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start">
              <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 mb-5">
                <Utensils className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit">Delicious Refreshments</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Fuel up with delicious starters, main meals, and beverages to keep your energy high.</p>
            </motion.div>

            {/* 8. Much More */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col items-start">
              <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400 mb-5">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-outfit">And Much More!</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Lots of hidden surprises, photo spots, and memories are waiting for you at Mittal Unipolis.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24 px-4 max-w-4xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-outfit">Have Questions?</h2>
          <p className="text-slate-400 text-sm md:text-base">Reach out to our event student coordinators for help with registration or entry details.</p>
          <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full mt-4" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {EVENT_CONFIG.contacts.map((contact, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card rounded-2xl p-6 flex items-center gap-4 hover:border-purple-500/30 transition-colors"
            >
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white font-outfit">{contact.name}</h4>
                <p className="text-xs text-slate-400 mb-1">Student Coordinator</p>
                <a 
                  href={`tel:${contact.phone.replace(/\s+/g, '')}`} 
                  className="text-sm font-semibold text-purple-300 hover:text-purple-200 transition-colors inline-flex items-center gap-1.5"
                >
                  {contact.phone}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-black/45 border-t border-white/5 mt-auto text-center px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
          <div className="font-extrabold tracking-wide text-lg text-gradient-indigo-purple font-outfit">
            ALGO-RHYTHM 2K26
          </div>
          
          <div className="text-xs text-slate-400 max-w-sm leading-relaxed">
            {EVENT_CONFIG.title} <br />
            {EVENT_CONFIG.displayDate} &bull; {EVENT_CONFIG.displayTime} <br />
            {EVENT_CONFIG.venue} <br />
            Hosted by <strong>{EVENT_CONFIG.hostedBy}</strong>
          </div>

          <div className="w-16 h-px bg-white/10" />

          <div className="text-[10px] text-slate-500">
            &copy; 2026 School of Computing and Artificial Intelligence. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
export const dynamic = 'force-dynamic';

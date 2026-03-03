'use client';

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, ShieldCheck, Mail } from 'lucide-react';

export default function AttemptDone() {
  const params = useParams();
  const attemptId = params.attemptId as string;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden p-6">

      {/* Decorative Ornaments */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-sky-100/50 to-transparent pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-100/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-200/30 rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="bg-white p-8 sm:p-12 rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-200/60 max-w-lg w-full text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="w-24 h-24 bg-emerald-50 rounded-full flex flex-col items-center justify-center mx-auto mb-8 border-4 border-emerald-100 shadow-sm"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </motion.div>

        <h1 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Assessment Submitted</h1>

        <p className="text-slate-600 text-base leading-relaxed mb-8">
          Your video recording, audio transcript, and responses have been successfully uploaded and processed. Your instructor has been notified.
        </p>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-800">Securely Stored</p>
              <p className="text-xs text-slate-500 mt-0.5">Your submission is securely linked to the attempt ID below.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-800">Pending Review</p>
              <p className="text-xs text-slate-500 mt-0.5">Your instructor will review your oral responses and final AI score.</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attempt Reference</p>
          <p className="text-sm font-mono text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 w-full sm:w-auto overflow-hidden text-ellipsis whitespace-nowrap">
            {attemptId}
          </p>
        </div>

        <p className="text-sm font-medium text-slate-500">
          You may now safely close this window.
        </p>
      </motion.div>
    </div>
  );
}

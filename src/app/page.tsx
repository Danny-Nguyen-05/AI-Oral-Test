'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { GraduationCap, Mic, Brain, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Decorators */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-300/30 rounded-full blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <header className="w-full px-6 py-4 flex justify-between items-center z-10 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-sky-600 p-2 rounded-lg text-white">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">OralCheck</span>
        </div>
        <Link
          href="/teacher/login"
          className="text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
        >
          Teacher Login
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            Next generation assessments
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            AI-powered <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-700">oral technical</span> assessments
          </h1>

          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Automate technical interviews and grading. Provide students with instant, intelligent feedback using advanced vocal AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/teacher/login"
              className="group flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-8 py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-sky-600/20 hover:shadow-sky-600/40 hover:-translate-y-0.5"
            >
              Get Started as Teacher
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <div className="text-slate-500 text-sm">
              Students: use the link shared by your teacher
            </div>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-20 max-w-4xl mx-auto"
        >
          <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/60 shadow-sm text-left flex items-start gap-4">
            <div className="bg-sky-100 p-3 rounded-xl text-sky-600">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Voice-First Interaction</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Simulate real technical interviews with fluid voice interactions, preparing students for professional environments.</p>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/60 shadow-sm text-left flex items-start gap-4">
            <div className="bg-sky-100 p-3 rounded-xl text-sky-600">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Intelligent Grading</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Customizable rubrics that evaluate understanding, reasoning, edge cases, and communication skills automatically.</p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-slate-400 text-sm z-10">
        © {new Date().getFullYear()} OralCheck. Built for educators.
      </footer>
    </div>
  );
}

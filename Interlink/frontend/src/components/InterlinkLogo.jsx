import React from "react";

export default function InterlinkLogo({
    size = "md",
    showText = true,
    light = false,
    className = "",
    textClassName = "",
    subtitle = "ENTERPRISE"
}) {
    // Size mapping
    const sizes = {
        sm: { icon: "w-7 h-7", text: "text-lg", mark: "h-7 w-7" },
        md: { icon: "w-9 h-9", text: "text-xl", mark: "h-9 w-9" },
        lg: { icon: "w-11 h-11", text: "text-2xl", mark: "h-11 w-11" },
        xl: { icon: "w-14 h-14", text: "text-3xl", mark: "h-14 w-14" },
    };

    const s = sizes[size] || sizes.md;

    return (
        <div className={`flex items-center gap-2.5 select-none ${className}`}>
            {/* SVG Logo Mark */}
            <div className={`relative ${s.mark} shrink-0 transition-transform duration-300 hover:scale-105`}>
                <svg
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full drop-shadow-[0_2px_10px_rgba(0,86,207,0.35)]"
                >
                    <defs>
                        <linearGradient id="ilG1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0056cf" />
                            <stop offset="50%" stopColor="#0284c7" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                        <linearGradient id="ilG2" x1="100%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="50%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                    </defs>

                    {/* Dark curved badge container */}
                    <rect width="48" height="48" rx="13" fill="#071328" />
                    <rect width="48" height="48" rx="13" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                    {/* Interconnected link paths */}
                    <path
                        d="M19 14 H15 C10.58 14 7 17.58 7 22 C7 26.42 10.58 30 15 30 H19 C23.42 30 27 26.42 27 22"
                        stroke="url(#ilG1)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <path
                        d="M29 34 H33 C37.42 34 41 30.42 41 26 C41 21.58 37.42 18 33 18 H29 C24.58 18 21 21.58 21 26"
                        stroke="url(#ilG2)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <path
                        d="M19 14 H21 C24.5 14 27 16.5 27 20"
                        stroke="url(#ilG1)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />

                    {/* Center node pulse */}
                    <circle cx="24" cy="24" r="2.5" fill="#38bdf8" />
                </svg>
            </div>

            {/* Brand Typography */}
            {showText && (
                <div className="flex flex-col">
                    <span className={`font-black tracking-tight leading-none ${s.text} ${textClassName || (light ? "text-white" : "text-slate-900")}`}>
                        Inter<span className="bg-gradient-to-r from-blue-500 via-sky-400 to-teal-400 bg-clip-text text-transparent">link</span>
                    </span>
                    {subtitle && (
                        <span className="text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase mt-0.5">
                            {subtitle}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

import React from 'react';

interface LogoProps {
    size?: number;
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 40, className = '' }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="folderBlue" x1="20" y1="4" x2="20" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#60A5FA" />
                    <stop offset="1" stopColor="#2563EB" />
                </linearGradient>
                <linearGradient id="folderOrange" x1="20" y1="10" x2="20" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FB923C" />
                    <stop offset="1" stopColor="#EA580C" />
                </linearGradient>
                <linearGradient id="drawerGray" x1="20" y1="22" x2="20" y2="38" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#E2E8F0" />
                    <stop offset="1" stopColor="#94A3B8" />
                </linearGradient>
                <filter id="shadow" x="-4" y="0" width="48" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
                </filter>
            </defs>

            <g filter="url(#shadow)">
                {/* Back Folder (Blue) */}
                <path
                    d="M8 8 C8 6.89543 8.89543 6 10 6 H18 L20 8 H30 C31.1046 8 32 8.89543 32 10 V 26 H 8 V 8 Z"
                    fill="url(#folderBlue)"
                />

                {/* Front Folder (Orange) */}
                <path
                    d="M8 14 C8 12.8954 8.89543 12 10 12 H16 L18 14 H30 C31.1046 14 32 14.8954 32 16 V 28 H 8 V 14 Z"
                    fill="url(#folderOrange)"
                />

                {/* Drawer Box */}
                <path
                    d="M6 22 H34 V 34 C34 36.2091 32.2091 38 30 38 H 10 C 7.79086 38 6 36.2091 6 34 V 22 Z"
                    fill="url(#drawerGray)"
                />

                {/* Drawer Handle */}
                <path
                    d="M16 30 H 24"
                    stroke="#475569"
                    strokeWidth="3"
                    strokeLinecap="round"
                />

                {/* Side Rails (Visual Detail) */}
                <rect x="4" y="10" width="2" height="24" rx="1" fill="#334155" />
                <rect x="34" y="10" width="2" height="24" rx="1" fill="#334155" />
            </g>
        </svg>
    );
};

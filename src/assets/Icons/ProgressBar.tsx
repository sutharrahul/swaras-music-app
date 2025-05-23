import React from "react";

export default function ProgressBar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      //   width="490"
      //   height="35"
      viewBox="0 0 490 35"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line
        x1="3"
        y1="18.4286"
        x2="237"
        y2="18.4286"
        stroke="url(#paint0_linear_328_318)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1="233"
        y1="18.4286"
        x2="487"
        y2="18.4286"
        stroke="#F6F6F6"
        strokeOpacity="0.5"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <ellipse
        cx="235.714"
        cy="17.1429"
        rx="11.4286"
        ry="12.8571"
        fill="#250000"
      />
      <path
        d="M252.857 17.1429C252.857 26.6107 244.542 34.2858 234.286 34.2858C224.029 34.2858 215.714 26.6107 215.714 17.1429C215.714 7.67518 224.029 6.10352e-05 234.286 6.10352e-05C244.542 6.10352e-05 252.857 7.67518 252.857 17.1429ZM224.688 17.1429C224.688 22.0357 228.985 26.0021 234.286 26.0021C239.586 26.0021 243.883 22.0357 243.883 17.1429C243.883 12.2502 239.586 8.28378 234.286 8.28378C228.985 8.28378 224.688 12.2502 224.688 17.1429Z"
        fill="#F6F6F6"
      />
      <defs>
        <linearGradient
          id="paint0_linear_328_318"
          x1="0"
          y1="21.4286"
          x2="240"
          y2="21.4286"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#800000" />
          <stop offset="0.439992" stopColor="#F00000" />
          <stop offset="1" stopColor="#B40000" />
        </linearGradient>
      </defs>
    </svg>
  );
}

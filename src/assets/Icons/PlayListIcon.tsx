import React, { useId } from 'react';

export default function PlayListIcon() {
  // See HomeIcon.tsx: NavContent mounts twice at once (desktop + mobile
  // drawer), so a hardcoded gradient id collided between the two copies and
  // mobile WebKit failed to resolve the fill, rendering nothing.
  const gradientId = useId();
  const gradient0 = `${gradientId}-0`;
  const gradient1 = `${gradientId}-1`;

  return (
    <svg width="25" height="21" viewBox="0 0 25 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.2917 15.9292C13.2917 18.2661 15.1924 20.1668 17.5293 20.1668C19.8662 20.1668 21.7669 18.2661 21.7669 15.9292C21.7669 15.7153 21.7343 15.5099 21.7029 15.3045H21.75V3.25016H24.1667V0.833496H20.5417C20.2212 0.833496 19.9139 0.960802 19.6872 1.18741C19.4606 1.41402 19.3333 1.72136 19.3333 2.04183V12.1109C18.7707 11.8386 18.1543 11.6957 17.5293 11.6928C16.4059 11.6937 15.3288 12.1404 14.5343 12.9346C13.7399 13.7288 13.2929 14.8058 13.2917 15.9292V15.9292ZM0 2.04183H16.9167V4.4585H0V2.04183Z"
        fill={`url(#${gradient0})`}
      />
      <path
        d="M0 6.875H16.9167V9.29167H0V6.875ZM0 11.7083H10.875V14.125H0V11.7083ZM0 16.5417H10.875V18.9583H0V16.5417Z"
        fill={`url(#${gradient1})`}
      />
      <defs>
        <linearGradient
          id={gradient0}
          x1="12.0833"
          y1="0.833496"
          x2="28.923"
          y2="14.1539"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--brand-strong)" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
        <linearGradient
          id={gradient1}
          x1="8.45833"
          y1="6.875"
          x2="19.1948"
          y2="16.3869"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--brand-strong)" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

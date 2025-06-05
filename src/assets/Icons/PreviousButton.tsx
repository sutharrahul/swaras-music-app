import React from "react";

type Prop = {
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
};

export default function PreviousButton({
  onClick,
  onKeyDown,
  className,
}: Prop) {
  return (
    <button onClick={onClick} onKeyDown={onKeyDown}>
      <svg
        className={className}
        // width="42"
        // height="42"
        viewBox="0 0 42 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13.2359 19.4435L37.7571 2.59559C39.7043 1.29174 41.3009 2.24835 41.3009 4.72328V37.4352C41.3009 39.9034 39.7043 40.86 37.7571 39.5629L13.2359 22.7082C13.2359 22.7082 12.2861 22.0308 12.2861 21.081C12.2861 20.1278 13.2359 19.4435 13.2359 19.4435ZM7.25791 0.651733H3.85361C1.97103 0.651733 0.449303 0.81514 0.449303 2.69432V39.4608C0.449303 41.34 1.97103 41.5034 3.85361 41.5034H7.25791C9.14049 41.5034 10.6622 41.34 10.6622 39.4608V2.69432C10.6622 0.81514 9.14049 0.651733 7.25791 0.651733Z"
          fill="#F6F6F6"
        />
      </svg>
    </button>
  );
}

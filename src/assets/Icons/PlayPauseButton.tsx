import React from "react";

export default function PlayPauseButton(props: React.SVGProps<SVGSVGElement>) {
  return (
    <button>
      <svg
        // width="63"
        // height="63"
        viewBox="0 0 63 63"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <rect
          width="62.7812"
          height="62.7812"
          rx="10"
          fill="url(#paint0_linear_328_319)"
        />
        <path
          d="M18.9014 48.043C18.5333 48.043 18.1804 47.8968 17.9201 47.6365C17.6599 47.3763 17.5137 47.0233 17.5137 46.6553V16.126C17.5137 15.8848 17.5766 15.6479 17.6961 15.4384C17.8156 15.229 17.9877 15.0543 18.1952 14.9316C18.4028 14.8089 18.6388 14.7424 18.8799 14.7387C19.121 14.735 19.359 14.7941 19.5702 14.9104L47.3241 30.175C47.5417 30.2948 47.7232 30.4708 47.8495 30.6846C47.9759 30.8984 48.0425 31.1423 48.0425 31.3906C48.0425 31.639 47.9759 31.8828 47.8495 32.0966C47.7232 32.3105 47.5417 32.4865 47.3241 32.6063L19.5702 47.8709C19.3653 47.9837 19.1353 48.0429 18.9014 48.043Z"
          fill="#F6F6F6"
        />
        <defs>
          <linearGradient
            id="paint0_linear_328_319"
            x1="-0.353961"
            y1="62.9898"
            x2="62.771"
            y2="-0.0102274"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#800000" />
            <stop offset="0.439992" stopColor="#F00000" />
            <stop offset="1" stopColor="#B40000" />
          </linearGradient>
        </defs>
      </svg>
    </button>
  );
}

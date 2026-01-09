import { SignIn } from '@clerk/nextjs';
import React from 'react';

export default function Signin() {
  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-[#000000]">
      <SignIn
        appearance={{
          variables: {
            colorBackground: '#141414',
            colorText: 'white',
            colorPrimary: '#C0F03A',
            colorInputBackground: '#262626',
            colorInputText: 'white',
          },
          elements: {
            card: {
              backgroundColor: '#141414',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              border: 'none',
            },
            headerTitle: {
              color: 'white',
              fontSize: '24px',
              fontWeight: '700',
              textAlign: 'center',
            },
            headerSubtitle: {
              color: '#a0a0a0',
              textAlign: 'center',
            },
            formButtonPrimary: {
              background: 'linear-gradient(to right, #800000, #B40000)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              borderRadius: '8px',
              '&:hover': {
                background: 'linear-gradient(to right, #900000, #C40000)',
              },
            },
            input: {
              backgroundColor: '#262626',
              borderRadius: '8px',
              color: 'white',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid transparent',
              '&:focus': {
                borderColor: '#C0F03A',
                boxShadow: '0 0 0 2px rgba(192, 240, 58, 0.2)',
              },
              '&::placeholder': {
                color: '#808080',
              },
            },
            label: {
              color: 'white',
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '8px',
            },
            footerActionText: {
              color: 'white',
              fontSize: '14px',
            },
            footerActionLink: {
              color: '#C0F03A',
              fontWeight: '600',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
                color: 'white',
              },
            },
            dividerLine: {
              backgroundColor: 'rgba(192, 240, 58, 0.3)',
            },
            dividerText: {
              color: '#C0F03A',
              fontSize: '14px',
            },
            socialButtonsBlockButton: {
              backgroundColor: '#262626',
              border: '1px solid rgba(192, 240, 58, 0.3)',
              borderRadius: '8px',
              color: 'white',
              padding: '8px',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#333333',
              },
            },
            formResendCodeLink: {
              color: '#C0F03A',
            },
            backLink: {
              color: '#C0F03A',
            },
          },
        }}
      />
    </div>
  );
}

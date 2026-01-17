import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return  <div className="flex items-center justify-center h-full">
        <SignIn
        signUpUrl='/sign-up'
        appearance={{
          variables: {
            colorBackground: '#141414',
            colorText: 'white',
            colorPrimary: '#B40000',
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
                borderColor: '#B40000',
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
              color: '#B40000',
              fontWeight: '600',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
                color: '#900000',
              },
            },
            dividerLine: {
              backgroundColor: 'rgba(192, 240, 58, 0.3)',
            },
            dividerText: {
              color: '#ffffff',
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

            backLink: {
              color: '#B40000',
            },
          },
        }}
        />
      </div>
}
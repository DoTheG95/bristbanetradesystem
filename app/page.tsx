'use client';

import { useState } from 'react';
import FacebookLogin from '@greatsumini/react-facebook-login';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex min-h-screen items-center justify-center font-sans"
      style={{
        backgroundImage: "url('/digivice.png')",
        backgroundPosition: 'center 0% ',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <main className="flex w-full max-w-3xl flex-col items-center justify-center py-32 px-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <FacebookLogin
            appId="512306471565792"
            onSuccess={(response) => {
              console.log('Login Success!', response);
              setIsLoggedIn(true);
            }}
            onFail={(error) => {
              console.log('Login Failed!', error);
            }}
            onProfileSuccess={(response) => {
              console.log('Get Profile Success!', response);
            }}
            render={({ onClick }) => (
              <button
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '13px 18px',
                  background: isHovered ? '#1a77f2' : '#1877F2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                  boxShadow: isHovered
                    ? '0 4px 16px rgba(24,119,242,0.45)'
                    : '0 2px 8px rgba(24,119,242,0.25)',
                  transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  minWidth: '220px',
                  justifyContent: 'center',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="white"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                </svg>
                Continue with Facebook
              </button>
            )}
          />
        </div>
      </main>
    </div>
  );
}
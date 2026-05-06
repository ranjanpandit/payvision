import './globals.css';

export const metadata = {
  title: 'PayVision - Merchant Platform',
  description: 'PayVision Payment Gateway - secure, fast merchant portal',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
        <link rel="shortcut icon" href="/favicon.svg"/>
      </head>
      <body>{children}</body>
    </html>
  );
}

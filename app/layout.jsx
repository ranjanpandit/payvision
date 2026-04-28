import './globals.css';

export const metadata = {
  title: 'PayVision',
  description: 'PayVision Merchant Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}

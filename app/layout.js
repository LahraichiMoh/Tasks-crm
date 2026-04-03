import './globals.css';

export const metadata = {
  title: 'CRM Pro - SaaS CRM Platform',
  description: 'Professional CRM platform for lead management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

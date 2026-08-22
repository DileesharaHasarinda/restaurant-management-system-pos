import type {
  Metadata,
  Viewport,
} from 'next';

import './globals.css';

export const metadata:
  Metadata = {
  title: {
    default:
      'Restaurant',

    template:
      '%s | Restaurant',
  },

  description:
    'Restaurant menu and table ordering.',
};

export const viewport:
  Viewport = {
  width:
    'device-width',

  initialScale:
    1,

  maximumScale:
    1,

  viewportFit:
    'cover',

  themeColor:
    '#183f23',
};

export default function RootLayout(
  {
    children,
  }: Readonly<{
    children:
    React.ReactNode;
  }>,
) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
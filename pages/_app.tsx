import type { AppProps } from 'next/app'
// @ts-ignore: allow importing CSS module without type declarations
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

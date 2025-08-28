# Mythos Quotes — PWA

A mythical, dopamine-smart quotes PWA with merch previews + PayPal subscription placeholders.

## Features
- Daily “summoning” ritual for quotes with rune animation
- Vault (free: 10 saves; paid: unlimited)
- Streaks with “blessing” milestones
- Forge: preview a quote on mug/T-shirt mockups
- Export print-ready PNG (2400×1600) for providers like Printify
- PayPal subscription button (configure your link in `app.js`)
- Fancy Add-to-Home-Screen prompt with iOS help
- Haptics (via `navigator.vibrate`) for taps/special quotes
- Offline support via Service Worker + manifest

## Quick start
1. Host the folder (e.g., GitHub Pages). Ensure the files are at the web root or adjust `manifest.webmanifest > start_url`.
2. Open the site. On first open you’ll see the install prompt. On iOS, follow the “Share → Add to Home Screen” instructions.
3. Tap **🔮 Summon** to reveal the daily quote. Save to Vault. Try **Forge** to preview and **Download Print PNG**.
4. Configure PayPal: edit `app.js`, set `PAYPAL_CONFIG.subscriptionLink` to your live PayPal link.
5. (Later) Plug in your print provider. Use the exported PNG as the design file.

## Notes
- Haptics require device support; some iOS versions may ignore `navigator.vibrate`.
- Paywall is client-side for demo. For production, add auth and webhook validation.
- Fonts load from Google Fonts; you can self-host fonts for stricter offline needs.

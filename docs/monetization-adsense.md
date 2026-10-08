# AdSense website activation — October 2026

- Verified separately: Sin Pelos has *AdSense for YouTube*, which does NOT establish website approval.
- Do not reuse any YouTube publisher ID for web ads or `ads.txt` unless Google authorizes it in the website AdSense product.
- Site URL: https://www.sinpelosenelmicrofono.com
- Before registration/approval: review editorial ownership, consent/ads policy, privacy, and sensitive news pages.
- Owner action: AdSense > Sites > + New site > enter domain > get AdSense website publisher/verification code.
- When verified, configure `ADSENSE_CONTENT_PUBLISHER_ID=pub-xxxxxxxxxxxxxxxx` as a server-only production environment variable. This safely turns on /ads.txt and nothing more.
- Google review/activation and account/tax/identity steps belong to owner. Do not insert a fake publisher ID.
- After approval, explicitly add the verified Google code to approved public placements only; keep /admin/ and sensitive content excluded.
- Do not add unnecessary third-party paid services. Review Google policies and consent obligations first.

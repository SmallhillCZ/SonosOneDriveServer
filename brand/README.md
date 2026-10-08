# Brand assets

Generated assets for the Sonos developer portal (Brand Assets section).

| File | Portal field | Spec |
|------|--------------|------|
| `assets/service-logo/service-logo-{20,40,80,112,200,400}.png` | Service logo (PNG) | 72 DPI, solid `#3346C2` background, no transparency |
| `assets/service-logo/service-logo-{40,400}.svg` | Service logo (SVG) | SVG Basic 1.1, paths only |
| `assets/full-logo.svg` | Full logo (Now Playing) | 20 px high, under 180 px wide, white on transparent |
| `assets/badge.svg` | Content attribution badge | 40×40, white on transparent |
| `assets/support-banner.{svg,png}` | Support banner logo | 200 px high, under 800 px wide, white background |

Regenerate (requires `fonttools` and `cairosvg`, uses the Inter Bold font):

```bash
pip install fonttools cairosvg
python3 brand/generate.py --wordmark "Cloud Music"
```

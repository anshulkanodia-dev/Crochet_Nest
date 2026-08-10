# CrochetNest

A static online catalogue / marketplace for **CrochetNest**, a handmade crochet studio.
Built to be hosted entirely on **GitHub Pages** — no server required.

- **Visitors** browse the catalogue by category, open product pages, add pieces to a
  cart (stored in the browser), and send a booking **enquiry via WhatsApp or Instagram**.
- **Custom requests** — the *Customise* page lets a visitor pick or drag in reference
  photos, fill in size / colour / deadline, and send "Is it possible to make this?"
  over WhatsApp or Instagram.
- **Admin** signs in with a one-time code (OTP) emailed to the studio address and can
  **add / edit / delete** products, **set the WhatsApp / Instagram contacts**, and
  **add / delete categories**; changes are published back to `data/products.json` and
  `data/settings.json`.
- **Real catalogue** — 38 products use lightly cropped and web-optimized photographs from
  the supplied CrochetNest gallery screenshots; pricing and timelines are confirmed by enquiry.

## Project structure

```
index.html            Home
shop.html             Catalogue with category filters + sorting
product.html          Product detail (?id=<product-id>)
customise.html        Custom request form (photo picker + prefilled message)
admin.html            Admin OTP login
admin-dashboard.html  Admin product management
assets/
  styles.css          Theme (dark charcoal + mint, from the logo)
  app.js              Storefront: catalogue, cart, enquiry, custom requests
  admin.js            Admin: OTP login + product CRUD + GitHub publish
  config.js           Site configuration (safe to commit — NO secrets)
  logo.png            CrochetNest logo
  products/            Optimized real product photographs
data/
  products.json       Product catalogue (the site's data source)
  settings.json       Admin-managed contacts + category list
robots.txt            Crawler rules (+ sitemap link)
sitemap.xml           URL list for search engines
```

## Configure

Most day-to-day settings are managed by the **admin in the dashboard** (Settings tab)
and stored in `data/settings.json` — no code editing needed:

- **WhatsApp number** — country code + number, digits only (e.g. `9198XXXXXXXX`).
- **Instagram handle** — username, without the `@`.
- **Categories** — the list used by the shop filters and the add/edit product form.

`assets/config.js` holds the remaining, less-frequently changed settings (and fallback
defaults used if `settings.json` is missing):

- `admin.email` — the address that receives OTP codes.
- `admin.emailjs` / `admin.devMode` — OTP email delivery (see below).
- `github` — repository target for publishing edits.
- `currencySymbol` — currency used across the site.

### Admin OTP email (EmailJS)

GitHub Pages has no backend, so OTP emails are sent client-side via
[EmailJS](https://www.emailjs.com) (free). Create an account, a service and a template,
then fill in `admin.emailjs` (`publicKey`, `serviceId`, `templateId`) in `config.js`
and set `admin.devMode` to `false`.

> While `admin.devMode` is `true`, the code is shown in the browser instead of emailed —
> handy for local testing. Turn it off for production.

### Publishing admin edits (GitHub token)

To let the admin save changes to the live site, the admin dashboard writes
`data/products.json` through the GitHub API. On the dashboard, paste a GitHub
**fine-grained Personal Access Token** with **Contents: Read & write** on this repo.
The token is kept only in that browser tab (`sessionStorage`) and is **never committed**.
Without a token you can still edit locally and use **Download JSON** to update the file
manually.

> Security note: a purely static OTP + browser-held token is a lightweight gate, not
> server-grade authentication. It is appropriate for a small portfolio/catalogue site.

## Run locally

```bash
python3 -m http.server 8099
# open http://localhost:8099
```

(The catalogue is loaded with `fetch`, so open it over HTTP, not `file://`.)

## Deploy (GitHub Pages)

Repo **Settings → Pages → Build and deployment → Deploy from a branch**, choose the
branch and `/ (root)`. The site is served at `https://<user>.github.io/<repo>/`.

## SEO

- Per-page `<title>` + meta description, Open Graph + Twitter Card tags, and canonical URLs.
- JSON-LD structured data: `Organization` on the home page and `Product` on each product
  page; an `Offer` is included only when a real product price has been supplied.
- `robots.txt` (admin pages disallowed) and `sitemap.xml`.

The canonical / Open Graph URLs use `https://anshulkanodia-dev.github.io/Crochet_Nest`.
If you deploy under a different URL (custom domain, different repo), update those absolute
URLs in the page `<head>`s, in `assets/app.js` (`SITE`), `robots.txt` and `sitemap.xml`.

# ElevateX Marketing website

Static multi-page website for ElevateX Marketing (trading name of Logan Ecom Ltd, SC884354). Plain HTML + one shared CSS file. No build step, no framework. Deployed on Vercel.

## Structure
- `index.html` – home (overview + links to each service)
- `meta-ads.html` – Meta & Instagram ads management (core service)
- `lead-follow-up.html` – instant enquiry replies + monthly reporting
- `social-content.html` – social content and ad creative
- `websites.html` – websites and landing pages
- `timesheets.html` – digital timesheet app (demo: https://demo-timesheets.vercel.app)
- `contact.html` – contact details
- `assets/styles.css` – all styles (colour + font tokens at the top in `:root`)
- `assets/main.js` – mobile menu toggle, enquiry form submission, scroll fade-in
- `assets/hero-demo.js` – animated enquiry/reply demo in the home page hero (example data only)

## Enquiry form
`contact.html` has the enquiry form; every "Book a free chat" button links to `contact.html#enquiry`. It posts to Web3Forms, which emails each enquiry to the business inbox. The inbox address is deliberately NOT shown anywhere on the site (replies are sent personally from it). The `access_key` hidden field is the only link to it and is safe to be public.

The header, nav and footer are repeated in every page. When adding a page or changing the nav/footer, update ALL pages.

## Brand
- Navy / white / electric blue. Use the CSS tokens in `:root`, never new hex values.
- Fonts: Archivo (headings), Figtree (body), JetBrains Mono (small labels).
- Brand-only voice ("we"), no personal photos. Plain, direct UK English.
- Don't invent client names, testimonials or results.

## Legal
Footer must keep: trading name, Logan Ecom Ltd, registered in Scotland, company no. SC884354, registered office address.

## To do
- Add a favicon / logo image.
- Business may be renamed (another UK business uses "ElevateX") – brand name appears in titles, header and footer of every page.

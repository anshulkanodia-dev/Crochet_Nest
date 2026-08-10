/*
 * CrochetNest site configuration.
 * Public fallback values only; admin-managed values live in data/settings.json.
 * This file is safe to commit — it must NOT contain any secret tokens.
 */
window.CN_CONFIG = {
  // Contact / enquiry channels + categories are managed by the ADMIN at runtime
  // and stored in data/settings.json. The values below are only fallback defaults
  // used if settings.json is missing.
  whatsappNumber: "", // set in Admin Settings (country code + number, digits only)
  instagramHandle: "crochetnest1201", // without the @ (fallback)
  contactEmail: "kanodiaanshul26@gmail.com",

  // Currency
  currencySymbol: "\u20b9", // ₹

  // Fallback categories (the live list lives in data/settings.json, editable in admin)
  categories: ["Rakhi", "Dream Catchers", "Bouquets", "Flowers & Plants", "Hairbands", "Hair Accessories", "Purses", "Keychains", "Jewellery", "Photo Frames", "Stationery", "Home Décor", "Gifts & Keepsakes"],

  // Admin OTP login
  admin: {
    email: "kanodiaanshul26@gmail.com",
    otpTtlMinutes: 10,
    // DEV fallback: when true, the OTP is shown in the browser (alert + console)
    // instead of requiring EmailJS. Set to false in production.
    devMode: true,
    // EmailJS (client-side email). Create a free account at https://www.emailjs.com
    // These keys are public by design. Leave blank to use devMode.
    emailjs: {
      publicKey: "",
      serviceId: "",
      templateId: ""
    }
  },

  // GitHub persistence for admin edits (writes data/products.json via the GitHub API).
  // The admin pastes a fine-grained Personal Access Token at runtime — it is kept
  // only in this browser tab (sessionStorage) and is NEVER committed here.
  github: {
    owner: "anshulkanodia-dev",
    repo: "Crochet_Nest",
    branch: "main",
    productsPath: "data/products.json",
    settingsPath: "data/settings.json"
  }
};

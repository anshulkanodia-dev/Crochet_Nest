/*
 * CrochetNest site configuration.
 * Edit the placeholder values below with your real details.
 * This file is safe to commit — it must NOT contain any secret tokens.
 */
window.CN_CONFIG = {
  // Contact / enquiry channels
  whatsappNumber: "911234567890", // country code + number, digits only (placeholder)
  instagramHandle: "crochetnest", // without the @ (placeholder)
  contactEmail: "kanodiaanshul26@gmail.com",

  // Currency
  currencySymbol: "\u20b9", // ₹

  // Product categories (used by shop filters + admin form)
  categories: ["Amigurumi", "Wearables", "Home Decor", "Bags", "Accessories"],

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
    productsPath: "data/products.json"
  }
};

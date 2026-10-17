// tools/stitch-import.js tarafından üretilir; elle değiştirmeyin.
tailwind.config = {
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "background": "rgb(var(--c-background) / <alpha-value>)",
        "cut": "rgb(var(--c-cut) / <alpha-value>)",
        "error": "rgb(var(--c-error) / <alpha-value>)",
        "error-container": "rgb(var(--c-error-container) / <alpha-value>)",
        "fill": "rgb(var(--c-fill) / <alpha-value>)",
        "guide-near": "rgb(var(--c-guide-near) / <alpha-value>)",
        "guide-on": "rgb(var(--c-guide-on) / <alpha-value>)",
        "header-bg": "rgb(var(--c-header-bg) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--c-inverse-on-surface) / <alpha-value>)",
        "inverse-primary": "rgb(var(--c-inverse-primary) / <alpha-value>)",
        "inverse-surface": "rgb(var(--c-inverse-surface) / <alpha-value>)",
        "menu-aplikasyon": "rgb(var(--c-menu-aplikasyon) / <alpha-value>)",
        "menu-cogo": "rgb(var(--c-menu-cogo) / <alpha-value>)",
        "menu-dengeleme": "rgb(var(--c-menu-dengeleme) / <alpha-value>)",
        "menu-dosya": "rgb(var(--c-menu-dosya) / <alpha-value>)",
        "menu-is": "rgb(var(--c-menu-is) / <alpha-value>)",
        "menu-kurp": "rgb(var(--c-menu-kurp) / <alpha-value>)",
        "menu-olcum": "rgb(var(--c-menu-olcum) / <alpha-value>)",
        "menu-sam": "rgb(var(--c-menu-sam) / <alpha-value>)",
        "menu-ters-hesap": "rgb(var(--c-menu-ters-hesap) / <alpha-value>)",
        "menu-yol": "rgb(var(--c-menu-yol) / <alpha-value>)",
        "on-background": "rgb(var(--c-on-background) / <alpha-value>)",
        "on-error": "rgb(var(--c-on-error) / <alpha-value>)",
        "on-error-container": "rgb(var(--c-on-error-container) / <alpha-value>)",
        "on-primary": "rgb(var(--c-on-primary) / <alpha-value>)",
        "on-primary-container": "rgb(var(--c-on-primary-container) / <alpha-value>)",
        "on-primary-fixed": "rgb(var(--c-on-primary-fixed) / <alpha-value>)",
        "on-primary-fixed-variant": "rgb(var(--c-on-primary-fixed-variant) / <alpha-value>)",
        "on-secondary": "rgb(var(--c-on-secondary) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--c-on-secondary-container) / <alpha-value>)",
        "on-secondary-fixed": "rgb(var(--c-on-secondary-fixed) / <alpha-value>)",
        "on-secondary-fixed-variant": "rgb(var(--c-on-secondary-fixed-variant) / <alpha-value>)",
        "on-success": "rgb(var(--c-on-success) / <alpha-value>)",
        "on-success-container": "rgb(var(--c-on-success-container) / <alpha-value>)",
        "on-surface": "rgb(var(--c-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--c-on-surface-variant) / <alpha-value>)",
        "on-tertiary": "rgb(var(--c-on-tertiary) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--c-on-tertiary-container) / <alpha-value>)",
        "on-tertiary-fixed": "rgb(var(--c-on-tertiary-fixed) / <alpha-value>)",
        "on-tertiary-fixed-variant": "rgb(var(--c-on-tertiary-fixed-variant) / <alpha-value>)",
        "on-warning-container": "rgb(var(--c-on-warning-container) / <alpha-value>)",
        "outline": "rgb(var(--c-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--c-outline-variant) / <alpha-value>)",
        "primary": "rgb(var(--c-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--c-primary-container) / <alpha-value>)",
        "primary-fixed": "rgb(var(--c-primary-fixed) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--c-primary-fixed-dim) / <alpha-value>)",
        "sat-beidou": "rgb(var(--c-sat-beidou) / <alpha-value>)",
        "sat-galileo": "rgb(var(--c-sat-galileo) / <alpha-value>)",
        "sat-glonass": "rgb(var(--c-sat-glonass) / <alpha-value>)",
        "sat-gps": "rgb(var(--c-sat-gps) / <alpha-value>)",
        "sat-qzss": "rgb(var(--c-sat-qzss) / <alpha-value>)",
        "sat-sbas": "rgb(var(--c-sat-sbas) / <alpha-value>)",
        "sat-unused": "rgb(var(--c-sat-unused) / <alpha-value>)",
        "secondary": "rgb(var(--c-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--c-secondary-container) / <alpha-value>)",
        "secondary-fixed": "rgb(var(--c-secondary-fixed) / <alpha-value>)",
        "secondary-fixed-dim": "rgb(var(--c-secondary-fixed-dim) / <alpha-value>)",
        "success": "rgb(var(--c-success) / <alpha-value>)",
        "success-container": "rgb(var(--c-success-container) / <alpha-value>)",
        "surface": "rgb(var(--c-surface) / <alpha-value>)",
        "surface-bright": "rgb(var(--c-surface-bright) / <alpha-value>)",
        "surface-container": "rgb(var(--c-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--c-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--c-surface-container-highest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--c-surface-container-low) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--c-surface-container-lowest) / <alpha-value>)",
        "surface-dim": "rgb(var(--c-surface-dim) / <alpha-value>)",
        "surface-tint": "rgb(var(--c-surface-tint) / <alpha-value>)",
        "surface-variant": "rgb(var(--c-surface-variant) / <alpha-value>)",
        "tertiary": "rgb(var(--c-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--c-tertiary-container) / <alpha-value>)",
        "tertiary-fixed": "rgb(var(--c-tertiary-fixed) / <alpha-value>)",
        "tertiary-fixed-dim": "rgb(var(--c-tertiary-fixed-dim) / <alpha-value>)",
        "warning-container": "rgb(var(--c-warning-container) / <alpha-value>)"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "space-xs": "0.25rem",
        "space-lg": "1rem",
        "gutter": "0.75rem",
        "space-sm": "0.5rem",
        "margin": "1rem",
        "space-xl": "1.5rem",
        "space-md": "0.75rem"
      },
      "fontFamily": {
        "readout-xl": [
          "Inter"
        ],
        "body-lg": [
          "Inter"
        ],
        "body-md": [
          "Inter"
        ],
        "title-md": [
          "Inter"
        ],
        "label-lg": [
          "Inter"
        ],
        "headline-lg": [
          "Inter"
        ],
        "headline-md": [
          "Inter"
        ],
        "readout-lg": [
          "Inter"
        ],
        "label-sm": [
          "Inter"
        ],
        "readout-md": [
          "Inter"
        ],
        "label-md": [
          "Inter"
        ]
      },
      "fontSize": {
        "readout-xl": [
          "36px",
          {
            "lineHeight": "40px",
            "fontWeight": "700"
          }
        ],
        "body-lg": [
          "17px",
          {
            "lineHeight": "25px",
            "fontWeight": "400"
          }
        ],
        "body-md": [
          "15px",
          {
            "lineHeight": "22px",
            "fontWeight": "400"
          }
        ],
        "title-md": [
          "17px",
          {
            "lineHeight": "23px",
            "fontWeight": "600"
          }
        ],
        "label-lg": [
          "16px",
          {
            "lineHeight": "20px",
            "fontWeight": "600"
          }
        ],
        "headline-lg": [
          "24px",
          {
            "lineHeight": "30px",
            "fontWeight": "700"
          }
        ],
        "headline-md": [
          "20px",
          {
            "lineHeight": "26px",
            "fontWeight": "600"
          }
        ],
        "readout-lg": [
          "22px",
          {
            "lineHeight": "26px",
            "fontWeight": "600"
          }
        ],
        "label-sm": [
          "12px",
          {
            "lineHeight": "16px",
            "fontWeight": "500"
          }
        ],
        "readout-md": [
          "16px",
          {
            "lineHeight": "21px",
            "fontWeight": "500"
          }
        ],
        "label-md": [
          "13px",
          {
            "lineHeight": "17px",
            "letterSpacing": "0.01em",
            "fontWeight": "600"
          }
        ]
      }
    }
  },
  "plugins": [
    function ({ addBase }) { addBase(window.FORMS_BASE || {}); }
  ]
};

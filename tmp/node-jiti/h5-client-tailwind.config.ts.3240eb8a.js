"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _tailwindconfig = require('@path-seeker/tailwind-config'); var _tailwindconfig2 = _interopRequireDefault(_tailwindconfig);

exports. default = {
  presets: [_tailwindconfig2.default ],
  content: [
    "./index.html",
    "./src/**/*.{vue,ts}",
    "../../packages/ui/src/**/*.{vue,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Noto Serif SC"', "STSong", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
} 
 /* v7-2cfb2e498f26a012 */
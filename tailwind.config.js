/** @type {import('tailwindcss').Config} */
import { colors } from "./src/constants/colors";
const fonts = require("./src/constants/fonts");
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/constants/**/*.{js,jsx,ts,tsx}",
    "./src/hooks/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: colors,
      fontFamily: fonts,
    },
  },
  plugins: [],
};

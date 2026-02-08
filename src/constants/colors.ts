export const rgba = (hex: any, opacity: any) => {
  const hexValue = hex.replace("#", "");
  const r = parseInt(hexValue.substring(0, 2), 16);
  const g = parseInt(hexValue.substring(2, 4), 16);
  const b = parseInt(hexValue.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const colors = {
  primary: "#3C71D1",
  secondary: "#BAD795",
  red: "#ef4444",
  green: "#1DD75B",
  yellow: "#FFD700",
  purple: "#593BD6",
  orange: "#F7A23B",
  pie: {
    1: "#4A6BFF",
  },
} as const;

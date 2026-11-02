import { Be_Vietnam_Pro, Saira as FontSaira } from "next/font/google";

// Be Vietnam Pro hỗ trợ đầy đủ dấu tiếng Việt (Poppins của template thì không).
export const BeVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
});

export const Saira = FontSaira({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-saira",
});

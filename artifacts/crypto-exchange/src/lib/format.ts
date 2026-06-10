import { format } from "date-fns";

export function formatUsdt(amount: string | number | undefined | null): string {
  if (!amount) return "0.0000";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0.0000";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function truncateAddress(address: string | undefined | null): string {
  if (!address) return "";
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "";
  try {
    return format(new Date(dateString), "MMM d, yyyy HH:mm:ss");
  } catch (e) {
    return dateString;
  }
}

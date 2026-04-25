import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "$0";
  return "$" + parseFloat(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
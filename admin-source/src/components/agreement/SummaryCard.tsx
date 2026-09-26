
import { formatIndianCurrency, amountInTeluguWords } from "@/utils/amountInWords";

interface SummaryCardProps { totalPrice: number; finalPrice: number; amountPaid: number; discount: number; balance: number; }

export default function SummaryCard({ totalPrice, finalPrice, amountPaid, discount, balance }: SummaryCardProps) {
  return (
    <div className="rounded-xl bg-gray-50 border p-4 text-sm space-y-2">
      <div className="flex justify-between"><span>Total Plot Value</span><strong>₹{formatIndianCurrency(totalPrice)}</strong></div>
      {discount > 0 && (<div className="flex justify-between text-green-700"><span>Discount</span><strong>- ₹{formatIndianCurrency(discount)}</strong></div>)}
      <div className="flex justify-between"><span>Final Amount</span><strong>₹{formatIndianCurrency(finalPrice)}</strong></div>
      <div className="flex justify-between"><span>Amount Paid</span><strong>₹{formatIndianCurrency(amountPaid)}</strong></div>
      <div className="mt-3 border-t pt-3 flex justify-between text-base">
        <span className="font-semibold">Balance</span><strong className="text-red-700">₹{formatIndianCurrency(balance)}</strong>
      </div>
      {balance > 0 && <p className="text-xs text-gray-600 italic mt-1">{amountInTeluguWords(balance)}</p>}
    </div>
  );
}


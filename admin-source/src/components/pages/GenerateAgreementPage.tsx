
"use client";

import { useMemo, useState, useCallback } from "react";
import Input from "@/components/agreement/Input";
import TextArea from "@/components/agreement/TextArea";
import SectionHeader from "@/components/agreement/SectionHeader";
import SummaryCard from "@/components/agreement/SummaryCard";
import AgreementPreview from "@/components/agreement/AgreementPreview";
import { DEFAULT_SELLER } from "@/constants/defaultSeller";
import { useTransliteratedForm } from "@/hooks/useTransliteratedForm";

export interface FormData {
  customerName: string; customerFatherName: string; customerAge: string; customerAddress: string; customerAadhaar: string; customerPhone: string;
  sellerName: string; sellerFatherName: string; sellerAge: string; sellerAddress: string; sellerAadhaar: string;
  projectName: string; district: string; mandal: string; village: string; surveyNumber: string; rsNumber: string; plotNumber: string; plotSize: string;
  eastBoundary: string; westBoundary: string; northBoundary: string; southBoundary: string;
  pricePerCent: string; discount: string; amountPaid: string;
  agreementDate: string; registrationDate: string;
}

interface FormErrors { [key: string]: string; }

const initialForm: FormData = {
  customerName: "", customerFatherName: "", customerAge: "", customerAddress: "", customerAadhaar: "", customerPhone: "",
  sellerName: DEFAULT_SELLER.name, sellerFatherName: DEFAULT_SELLER.father, sellerAge: DEFAULT_SELLER.age, sellerAddress: DEFAULT_SELLER.address, sellerAadhaar: DEFAULT_SELLER.aadhaar,
  projectName: "Vijaya Sandalwood Farm", district: "Palnadu", mandal: "Bollapalli", village: "Bollapalli", surveyNumber: "", rsNumber: "", plotNumber: "", plotSize: "",
  eastBoundary: "", westBoundary: "", northBoundary: "", southBoundary: "",
  pricePerCent: "", discount: "0", amountPaid: "",
  agreementDate: new Date().toISOString().split("T")[0], registrationDate: "",
};

export default function GenerateAgreementPage() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [useDefaultSeller, setUseDefaultSeller] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const teluguTranslations = useTransliteratedForm(form);

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }, [errors]);

  const handleSellerToggle = useCallback((isDefault: boolean) => {
    setUseDefaultSeller(isDefault);
    if (isDefault) setForm((prev) => ({ ...prev, sellerName: DEFAULT_SELLER.name, sellerFatherName: DEFAULT_SELLER.father, sellerAge: DEFAULT_SELLER.age, sellerAddress: DEFAULT_SELLER.address, sellerAadhaar: DEFAULT_SELLER.aadhaar }));
    else setForm((prev) => ({ ...prev, sellerName: "", sellerFatherName: "", sellerAge: "", sellerAddress: "", sellerAadhaar: "" }));
  }, []);

  const calculations = useMemo(() => {
    const plotSize = Number(form.plotSize) || 0; const pricePerCent = Number(form.pricePerCent) || 0; const amountPaid = Number(form.amountPaid) || 0; const discount = Number(form.discount) || 0;
    const totalPrice = plotSize * pricePerCent; const finalPrice = Math.max(totalPrice - discount, 0); const balance = Math.max(finalPrice - amountPaid, 0);
    return { totalPrice, finalPrice, amountPaid, discount, balance };
  }, [form.plotSize, form.pricePerCent, form.amountPaid, form.discount]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!form.customerName) newErrors.customerName = "Required"; if (!form.customerFatherName) newErrors.customerFatherName = "Required";
    if (!form.customerAge) newErrors.customerAge = "Required"; if (!form.customerAddress) newErrors.customerAddress = "Required";
    if (form.customerAadhaar && !/^\d{12}$/.test(form.customerAadhaar)) newErrors.customerAadhaar = "Must be 12 digits";
    if (form.customerPhone && !/^\d{10}$/.test(form.customerPhone)) newErrors.customerPhone = "Must be 10 digits";
    if (!useDefaultSeller) { if (!form.sellerName) newErrors.sellerName = "Required"; if (!form.sellerFatherName) newErrors.sellerFatherName = "Required"; if (!form.sellerAddress) newErrors.sellerAddress = "Required"; }
    if (!form.projectName) newErrors.projectName = "Required"; if (!form.plotNumber) newErrors.plotNumber = "Required"; if (!form.plotSize) newErrors.plotSize = "Required"; if (!form.pricePerCent) newErrors.pricePerCent = "Required";
    if (!form.agreementDate) newErrors.agreementDate = "Required"; if (!form.registrationDate) newErrors.registrationDate = "Required";
    if (form.agreementDate && form.registrationDate && form.agreementDate > form.registrationDate) newErrors.registrationDate = "Must be after Agreement Date";
    setErrors(newErrors); return Object.keys(newErrors).length === 0;
  }, [form, useDefaultSeller]);

  const handlePrint = useCallback(() => {
    if (validateForm()) return;
    const printContent = document.getElementById("agreement-document"); if (!printContent) return;
    const iframe = document.createElement("iframe"); iframe.style.position = "absolute"; iframe.style.top = "-10000px"; iframe.style.left = "-10000px"; iframe.style.width = "0px"; iframe.style.height = "0px"; document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document; if (!doc) return;
    doc.open(); doc.write(`<html><head><style>@page { size: A4 portrait; margin: 15mm 5mm 15mm 5mm; } body { margin:0; padding:0; font-family:'Noto Sans Telugu','Nirmala UI',Arial,sans-serif; line-height:2; font-size:18px; color:#000; } .agreement-content { border:none!important; box-shadow:none!important; padding:0!important; margin:0!important; background:transparent!important; } p { margin-top:0; margin-bottom:0; }</style></head><body>${printContent.innerHTML}</body></html>`); doc.close();
    setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  }, [validateForm]);

  const resetForm = useCallback(() => { setForm(initialForm); setUseDefaultSeller(true); setErrors({}); }, []);
  const defaultSellerPreview = useMemo(() => ({ name: DEFAULT_SELLER.nameTelugu, father: DEFAULT_SELLER.fatherTelugu, address: DEFAULT_SELLER.addressTelugu }), []);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#202020]">
      <div className="mx-auto max-w-7xl">
        {/* HEADER - Responsive Flex */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-0 md:mb-8">
          <div>
            <p className="text-sm font-medium text-red-700">VGG INFRA DEVELOPERS</p>
            <h1 className="mt-1 text-xl md:text-3xl font-semibold">Telugu Agreement Generator</h1>
            <p className="mt-1 text-xs md:text-sm text-gray-500">Powered by Google Transliteration API</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={resetForm} className="flex-1 sm:flex-none rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 transition">Reset</button>
            <button onClick={handlePrint} className="flex-1 sm:flex-none rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 transition">Print / PDF</button>
          </div>
        </div>

        {/* Responsive Grid: 1 Col on Mobile, 2 Col on Desktop */}
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] p-4 md:p-0">
          
          {/* FORM - Scrollable on Mobile */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm overflow-auto max-h-[80vh] lg:max-h-[90vh]">
            <div className="space-y-6">
              <div><SectionHeader title="Customer Details" /><div className="space-y-3">
                <Input label="Customer Name" value={form.customerName} onChange={(v) => updateField("customerName", v)} placeholder="E.g. Bhanu Teja" required error={errors.customerName} />
                <Input label="Father/Husband Name" value={form.customerFatherName} onChange={(v) => updateField("customerFatherName", v)} placeholder="E.g. Kolapalli Madhuri" required error={errors.customerFatherName} />
                <Input label="Age" value={form.customerAge} onChange={(v) => updateField("customerAge", v)} type="number" required error={errors.customerAge} showTransliteration={false} />
                <TextArea label="Address" value={form.customerAddress} onChange={(v) => updateField("customerAddress", v)} placeholder="E.g. Hyderabad" required error={errors.customerAddress} />
                <Input label="Aadhaar" value={form.customerAadhaar} onChange={(v) => updateField("customerAadhaar", v)} placeholder="12-digits" error={errors.customerAadhaar} showTransliteration={false} />
                <Input label="Phone" value={form.customerPhone} onChange={(v) => updateField("customerPhone", v)} placeholder="10-digits" error={errors.customerPhone} showTransliteration={false} />
              </div></div>

              <div><SectionHeader title="Seller Details" />
                <div className="flex gap-4 mb-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={useDefaultSeller} onChange={() => handleSellerToggle(true)} className="w-4 h-4 text-red-600" /> Use Default</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={!useDefaultSeller} onChange={() => handleSellerToggle(false)} className="w-4 h-4 text-red-600" /> Create New</label>
                </div>
                <div className="space-y-3">
                  <Input label="Seller Name" value={form.sellerName} onChange={(v) => updateField("sellerName", v)} disabled={useDefaultSeller} required error={useDefaultSeller ? "" : errors.sellerName} />
                  {useDefaultSeller && <p className="text-xs text-gray-500 italic -mt-2 mb-2">{defaultSellerPreview.name}</p>}
                  <Input label="Father Name" value={form.sellerFatherName} onChange={(v) => updateField("sellerFatherName", v)} disabled={useDefaultSeller} required error={useDefaultSeller ? "" : errors.sellerFatherName} />
                  {useDefaultSeller && <p className="text-xs text-gray-500 italic -mt-2 mb-2">{defaultSellerPreview.father}</p>}
                  <Input label="Age" value={form.sellerAge} onChange={(v) => updateField("sellerAge", v)} disabled={useDefaultSeller} type="number" showTransliteration={false} />
                  <TextArea label="Address" value={form.sellerAddress} onChange={(v) => updateField("sellerAddress", v)} disabled={useDefaultSeller} required error={useDefaultSeller ? "" : errors.sellerAddress} />
                  {useDefaultSeller && <p className="text-xs text-gray-500 italic -mt-2 mb-2">{defaultSellerPreview.address}</p>}
                  <Input label="Aadhaar" value={form.sellerAadhaar} onChange={(v) => updateField("sellerAadhaar", v)} disabled={useDefaultSeller} error={useDefaultSeller ? "" : errors.sellerAadhaar} showTransliteration={false} />
                </div></div>

              <div><SectionHeader title="Property Details" /><div className="space-y-3">
                <Input label="Project Name" value={form.projectName} onChange={(v) => updateField("projectName", v)} required error={errors.projectName} />
                <div className="grid grid-cols-2 gap-3"><Input label="District" value={form.district} onChange={(v) => updateField("district", v)} /><Input label="Mandal" value={form.mandal} onChange={(v) => updateField("mandal", v)} /></div>
                <Input label="Village" value={form.village} onChange={(v) => updateField("village", v)} />
                <div className="grid grid-cols-2 gap-3"><Input label="Survey No." value={form.surveyNumber} onChange={(v) => updateField("surveyNumber", v)} showTransliteration={false} /><Input label="R.S. No." value={form.rsNumber} onChange={(v) => updateField("rsNumber", v)} showTransliteration={false} /></div>
                <div className="grid grid-cols-2 gap-3"><Input label="Plot No." value={form.plotNumber} onChange={(v) => updateField("plotNumber", v)} required error={errors.plotNumber} showTransliteration={false} /><Input label="Size (Cents)" value={form.plotSize} onChange={(v) => updateField("plotSize", v)} type="number" required error={errors.plotSize} showTransliteration={false} /></div>
                <div className="grid grid-cols-2 gap-3"><Input label="East" value={form.eastBoundary} onChange={(v) => updateField("eastBoundary", v)} /><Input label="West" value={form.westBoundary} onChange={(v) => updateField("westBoundary", v)} /></div>
                <div className="grid grid-cols-2 gap-3"><Input label="North" value={form.northBoundary} onChange={(v) => updateField("northBoundary", v)} /><Input label="South" value={form.southBoundary} onChange={(v) => updateField("southBoundary", v)} /></div>
              </div></div>

              <div><SectionHeader title="Payment Details" /><div className="space-y-3">
                <Input label="Price Per Cent (₹)" value={form.pricePerCent} onChange={(v) => updateField("pricePerCent", v)} type="number" required error={errors.pricePerCent} showTransliteration={false} />
                <Input label="Amount Paid (₹)" value={form.amountPaid} onChange={(v) => updateField("amountPaid", v)} type="number" showTransliteration={false} />
                <Input label="Discount (₹)" value={form.discount} onChange={(v) => updateField("discount", v)} type="number" showTransliteration={false} />
                <SummaryCard {...calculations} />
              </div></div>

              <div><SectionHeader title="Dates" /><div className="space-y-3">
                <Input label="Agreement Date" value={form.agreementDate} onChange={(v) => updateField("agreementDate", v)} type="date" required error={errors.agreementDate} showTransliteration={false} />
                <Input label="Registration Date" value={form.registrationDate} onChange={(v) => updateField("registrationDate", v)} type="date" required error={errors.registrationDate} showTransliteration={false} />
              </div></div>
            </div>
          </section>

          {/* PREVIEW - Stacks below on Mobile, Scrollable */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 md:p-5">
              <div><h2 className="text-lg font-semibold">Live Telugu Preview</h2><p className="text-xs md:text-sm text-gray-500">Updates instantly as you type</p></div>
            </div>
            <div className="bg-gray-100 p-4 md:p-6 overflow-auto max-h-[80vh] lg:max-h-[90vh]">
              <AgreementPreview form={form} calculations={calculations} teluguTranslations={teluguTranslations} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}


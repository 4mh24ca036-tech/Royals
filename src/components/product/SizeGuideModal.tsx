import React, { useState } from 'react';
import { X, Ruler, Sparkles, Check } from 'lucide-react';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ isOpen, onClose }) => {
  const [unit, setUnit] = useState<'inches' | 'cm'>('inches');
  const [activeTab, setActiveTab] = useState<'women' | 'men'>('women');

  if (!isOpen) return null;

  const womenSizes = [
    { size: 'XS (32)', bust: '32-33', waist: '26-27', hip: '36-37', lehengaLength: '42' },
    { size: 'S (34)', bust: '34-35', waist: '28-29', hip: '38-39', lehengaLength: '42' },
    { size: 'M (36)', bust: '36-37', waist: '30-31', hip: '40-41', lehengaLength: '43' },
    { size: 'L (38)', bust: '38-39', waist: '32-33', hip: '42-43', lehengaLength: '43' },
    { size: 'XL (40)', bust: '40-41', waist: '34-35', hip: '44-45', lehengaLength: '44' },
    { size: 'XXL (42)', bust: '42-44', waist: '36-38', hip: '46-48', lehengaLength: '44' },
    { size: 'Custom Fit', bust: 'Bespoke', waist: 'Bespoke', hip: 'Bespoke', lehengaLength: 'Tailored' }
  ];

  const menSizes = [
    { size: '36 (S)', chest: '36-37', waist: '30-31', shoulder: '17.5', length: '44' },
    { size: '38 (M)', chest: '38-39', waist: '32-33', shoulder: '18.0', length: '45' },
    { size: '40 (L)', chest: '40-41', waist: '34-35', shoulder: '18.5', length: '45' },
    { size: '42 (XL)', chest: '42-43', waist: '36-37', shoulder: '19.0', length: '46' },
    { size: '44 (XXL)', chest: '44-45', waist: '38-39', shoulder: '19.5', length: '46' },
    { size: 'Custom Fit', chest: 'Bespoke', waist: 'Bespoke', shoulder: 'Bespoke', length: 'Tailored' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E8DFD8] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#E8DFD8] flex items-center justify-between bg-[#F5EFEB]">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-[#C5A880]" />
            <div>
              <h3 className="text-xl font-serif font-bold text-[#121212]">
                ROYALS Sizing & Measurement Guide
              </h3>
              <p className="text-xs text-[#706B65]">
                Precision measurements for imperial bridal and couture silhouettes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#4A4540] hover:text-[#121212] rounded-full hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 sm:p-6 border-b border-[#E8DFD8] flex flex-wrap items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-2 bg-[#F5EFEB] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('women')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'women' ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-[#4A4540]'
              }`}
            >
              Women's Bridal & Sarees
            </button>
            <button
              onClick={() => setActiveTab('men')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'men' ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-[#4A4540]'
              }`}
            >
              Men's Sherwanis & Achkans
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#706B65]">
            <span>Unit:</span>
            <div className="inline-flex rounded-lg border border-[#D8CCC2] p-0.5 bg-[#FAF8F5]">
              <button
                onClick={() => setUnit('inches')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                  unit === 'inches' ? 'bg-[#C5A880] text-black' : 'text-[#706B65]'
                }`}
              >
                Inches (in)
              </button>
              <button
                onClick={() => setUnit('cm')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                  unit === 'cm' ? 'bg-[#C5A880] text-black' : 'text-[#706B65]'
                }`}
              >
                Centimeters (cm)
              </button>
            </div>
          </div>
        </div>

        {/* Sizing Table */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'women' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#1A1A1A] text-[#FAF8F5]">
                    <th className="p-3 font-semibold rounded-l-lg">Standard Size</th>
                    <th className="p-3 font-semibold">Bust</th>
                    <th className="p-3 font-semibold">Waist</th>
                    <th className="p-3 font-semibold">Hip</th>
                    <th className="p-3 font-semibold rounded-r-lg">Skirt Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFD8]">
                  {womenSizes.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-[#F5EFEB]/50' : 'bg-white'}>
                      <td className="p-3 font-bold text-[#121212]">{row.size}</td>
                      <td className="p-3 text-[#4A4540]">{row.bust} {row.bust !== 'Bespoke' ? unit : ''}</td>
                      <td className="p-3 text-[#4A4540]">{row.waist} {row.waist !== 'Bespoke' ? unit : ''}</td>
                      <td className="p-3 text-[#4A4540]">{row.hip} {row.hip !== 'Bespoke' ? unit : ''}</td>
                      <td className="p-3 text-[#4A4540]">{row.lehengaLength} {row.lehengaLength !== 'Tailored' ? unit : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#1A1A1A] text-[#FAF8F5]">
                    <th className="p-3 font-semibold rounded-l-lg">Size (Chest)</th>
                    <th className="p-3 font-semibold">Chest</th>
                    <th className="p-3 font-semibold">Waist</th>
                    <th className="p-3 font-semibold">Shoulder</th>
                    <th className="p-3 font-semibold rounded-r-lg">Achkan Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFD8]">
                  {menSizes.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-[#F5EFEB]/50' : 'bg-white'}>
                      <td className="p-3 font-bold text-[#121212]">{row.size}</td>
                      <td className="p-3 text-[#4A4540]">{row.chest} {row.chest !== 'Bespoke' ? unit : ''}</td>
                      <td className="p-3 text-[#4A4540]">{row.waist} {row.waist !== 'Bespoke' ? unit : ''}</td>
                      <td className="p-3 text-[#4A4540]">{row.shoulder} {row.shoulder !== 'Bespoke' ? unit : ''}</td>
                      <td className="p-3 text-[#4A4540]">{row.length} {row.length !== 'Tailored' ? unit : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bespoke Note */}
          <div className="mt-6 p-4 rounded-xl bg-[#F5EFEB] border border-[#E8DFD8] flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#C5A880] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-[#59524A]">
              <p className="font-semibold text-[#121212]">
                Complimentary Bespoke Tailoring & Custom Bridal Measurements
              </p>
              <p>
                After placing your order with "Custom Bridal Fit", our master stylist will reach out on WhatsApp (+91 8000461784) for custom blouse neckline, choli padding, and kali flare adjustments.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F5EFEB] border-t border-[#E8DFD8] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#1A1A1A] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#333] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

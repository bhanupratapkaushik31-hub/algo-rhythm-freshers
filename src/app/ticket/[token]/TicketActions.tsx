'use client';

import React, { useState } from 'react';
import { Download, Image as ImageIcon, Printer, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TicketActionsProps {
  ticketId: string;
}

export default function TicketActions({ ticketId }: TicketActionsProps) {
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const getTicketElement = (): HTMLElement | null => {
    return document.getElementById('event-ticket');
  };

  // 1. Download Ticket as Image (PNG)
  const downloadImage = async () => {
    const element = getTicketElement();
    if (!element) return;

    setDownloadingImage(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // Safe scale for both desktop and mobile memory limits
        useCORS: true,
        allowTaint: false, // Must be false to prevent security error on toDataURL
        backgroundColor: '#0c0724', // deep navy purple matching element
        logging: false,
        scrollX: 0,
        scrollY: 0
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `ALGO_RHYTHM_Ticket_${ticketId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Image export failed:', err);
      alert('Failed to generate high-quality image. Please try taking a screenshot.');
    } finally {
      setDownloadingImage(false);
    }
  };

  // 2. Download Ticket as PDF
  const downloadPdf = async () => {
    const element = getTicketElement();
    if (!element) return;

    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // Match high quality
        useCORS: true,
        allowTaint: false, // Must be false to prevent security error on toDataURL
        backgroundColor: '#0c0724',
        logging: false,
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL('image/png');

      // Create PDF matching the high-quality canvas dimensions exactly
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`ALGO_RHYTHM_Ticket_${ticketId}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Please download as an image or use print.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // 3. Trigger Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-4">
      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
        {/* PDF */}
        <button
          onClick={downloadPdf}
          disabled={downloadingPdf || downloadingImage}
          className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-[#a855f7]/15 border border-[#a855f7]/30 hover:bg-[#a855f7]/25 text-purple-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
        >
          {downloadingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PDF
            </>
          )}
        </button>

        {/* Image */}
        <button
          onClick={downloadImage}
          disabled={downloadingPdf || downloadingImage}
          className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-[#ec4899]/15 border border-[#ec4899]/30 hover:bg-[#ec4899]/25 text-pink-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
        >
          {downloadingImage ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Image...
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              Download Image
            </>
          )}
        </button>

        {/* Print */}
        <button
          onClick={handlePrint}
          disabled={downloadingPdf || downloadingImage}
          className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print Ticket
        </button>
      </div>

      {/* Navigation options */}
      <div className="text-center pt-2 print:hidden">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-200 font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
